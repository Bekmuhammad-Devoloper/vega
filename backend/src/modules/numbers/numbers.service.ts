import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { NumberOrderStatus, ProviderKind} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { ProvidersService } from '../providers/providers.service';
import { WalletService } from '../wallet/wallet.service';
import { UploadsService } from '../uploads/uploads.service';
import { TenantBotService } from '../telegram-bot/tenant-bot.service';

/// Raqam-buyurtma oqimi: reseller ulgurji to'laydi -> provayderdan raqam ->
/// mijoz retail to'laydi -> SMS poll -> kod yetkaziladi.
@Injectable()
export class NumbersService {
  private readonly logger = new Logger(NumbersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly providers: ProvidersService,
    private readonly wallet: WalletService,
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
    private readonly uploads: UploadsService,
    private readonly tenantBot: TenantBotService,
  ) {}

  /**
   * Mijoz BALANS to'ldirish so'rovi (karta + chek). Chek sotuvchi kanaliga
   * (global @Vega_uzbot orqali) tugmalar bilan boradi; tasdiqlansa balans oshadi.
   */
  async requestBalanceTopup(params: {
    tenantId: string;
    userId: string;
    amount: number;
    receipt: Buffer;
  }): Promise<{ ok: boolean }> {
    const { tenantId, userId, amount, receipt } = params;
    if (!Number.isFinite(amount) || amount < 1000) {
      throw new BadRequestException("Summa noto'g'ri (kamida 1 000 so'm)");
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { manualCardNumber: true, manualPaymentChannelId: true },
    });
    if (!tenant?.manualCardNumber || !tenant?.manualPaymentChannelId) {
      throw new BadRequestException(
        "Bu do'konda karta orqali to'ldirish sozlanmagan",
      );
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, username: true },
    });

    const saved = await this.uploads.saveImage(receipt);
    const topup = await this.prisma.balanceTopup.create({
      data: { tenantId, userId, amount, receiptUrl: saved.mediumUrl, status: 'PENDING' },
    });

    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const money = amount.toLocaleString('ru-RU').replace(/,/g, ' ');
    const who = user?.username
      ? `@${user.username}`
      : esc(user?.firstName ?? 'Mijoz');
    const caption =
      `💰 <b>Balans to'ldirish so'rovi</b>\n\n` +
      `👤 Mijoz: <b>${who}</b>\n` +
      `💵 Summa: <b>${money} so'm</b>\n\n` +
      `Chekni tekshirib, tasdiqlang yoki rad eting.`;
    try {
      await this.tenantBot.sendBalanceTopupToChannel(
        tenantId,
        receipt,
        caption,
        topup.id,
      );
    } catch {
      // yuborilmadi — so'rov PENDING qoladi (sotuvchi keyin ko'radi)
    }
    return { ok: true };
  }

  private get usdToUzs(): number {
    // XAVFSIZ PARSE: `Number('')` = 0! USD_TO_UZS bo'sh string bo'lsa kurs 0
    // bo'lib, raqamlar deyarli TEKINGA sotilardi. NaN/manfiy ham rad etiladi.
    const n = Number(this.config.get('USD_TO_UZS'));
    return Number.isFinite(n) && n > 0 ? n : 12000;
  }

  /**
   * Holat o'zgarganda hodisalarni tarqatish — BITTA joydan:
   *  - order.status_changed  -> admin panel socket + kanal kartochkasi tahriri
   *    + MIJOZGA BOT ORQALI XABAR (kod kelganda "Kod keldi!" DM'i shu orqali).
   *    Ilgari provayder oqimi (markReceived/cancel/expire) BUNI EMIT QILMASDI —
   *    mijoz kodni bot orqali HECH QACHON olmasdi, faqat webapp'ni ochsa ko'rardi.
   *  - user.order.status_changed -> mijoz WebApp real-time (socket xonasi).
   */
  private emitStatusChanged(o: {
    id: string;
    status: NumberOrderStatus;
    tenantId: string;
    userId: string;
    orderNumber: string;
  }): void {
    this.events.emit('order.status_changed', {
      orderId: o.id,
      status: o.status,
      tenantId: o.tenantId,
    });
    this.events.emit('user.order.status_changed', {
      userId: o.userId,
      orderId: o.id,
      status: o.status,
      orderNumber: o.orderNumber,
    });
  }

  /**
   * Kanaldagi "Bekor qilish" tugmasi shu hodisani yuboradi. Ilgari listener
   * DB'ga TO'G'RIDAN-TO'G'RI status yozardi: mijoz puli QAYTARILMASDI (xabar
   * esa "Mablag' qaytarildi" der edi — yolg'on) va provayderda bekor
   * qilinmasdi. Endi to'liq cancel oqimi (refund + guard'lar) ishlaydi.
   */
  @OnEvent('order.cancel_requested', { async: true })
  async onCancelRequested(payload: { orderId: string }): Promise<void> {
    try {
      await this.cancel(payload.orderId, undefined, 'Kanal tugmasi: bekor qilindi');
    } catch (e) {
      this.logger.warn(`cancel_requested ${payload.orderId}: ${String(e)}`);
    }
  }
  private uzs(usd: number): number {
    return Math.round((usd * this.usdToUzs) / 100) * 100;
  }

  /**
   * Reseller do'konidagi takliflar (mijoz storefront'i).
   * Provayderda AYNI PAYTDA zaxirasi yo'q yo'nalishlar CHIQARIB TASHLANADI —
   * aks holda mijoz botda ko'rib, bosgach "mavjud emas" xatosini olardi.
   * Zaxira ma'lumoti 3 daqiqa keshlanadi, shuning uchun bu qo'shimcha
   * so'rovlarga olib kelmaydi.
   */
  async storefront(tenantId: string) {
    const offers = await this.prisma.resellerOffer.findMany({
      where: { tenantId, isActive: true },
      include: { service: true, country: true },
      orderBy: [{ service: { position: 'asc' } }, { country: { position: 'asc' } }],
    });
    if (offers.length === 0) return offers;

    // Zaxira ma'lumotini HAR TAKLIF UCHUN emas, BIR MARTA olamiz. Ilgari har
    // taklif alohida `isAvailable()` chaqirardi va kesh sovuq bo'lganda
    // o'nlab so'rov bir vaqtda provayderga urilib, vitrina sekinlashardi yoki
    // butunlay "Xatolik yuz berdi" bo'lib qolardi.
    const needsSpider = offers.some((o) => o.service.telegramOnly);
    const needsHero = offers.some((o) => !o.service.telegramOnly);

    const [spiderIso, heroMap] = await Promise.all([
      needsSpider
        ? this.providers.spiderSupportedIso2().catch(() => null)
        : Promise.resolve(null),
      needsHero
        ? this.providers.heroAvailableMap().catch(() => null)
        : Promise.resolve(null),
    ]);

    return offers.filter((o) => {
      if (o.service.telegramOnly) {
        // Provayder javob bermadi — yo'nalishni YASHIRMAYMIZ (xarid paytida
        // baribir tekshiriladi). Vitrina bo'sh qolgandan ko'ra shu yaxshi.
        if (!spiderIso || spiderIso.size === 0) return true;
        const iso = (o.country.iso2 ?? '').toUpperCase();
        return iso ? spiderIso.has(iso) : false;
      }
      if (!heroMap || heroMap.size === 0) return true;
      const c = o.country.heroCode;
      const sv = o.service.heroCode;
      if (!c || !sv) return false;
      return heroMap.get(c)?.has(sv) ?? false;
    });
  }

  /** Mijozning buyurtmalari. */
  myOrders(tenantId: string, userId: string, take = 30) {
    return this.prisma.numberOrder.findMany({
      where: { tenantId, userId },
      include: { service: true, country: true },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async getOrder(id: string, userId?: string) {
    const o = await this.prisma.numberOrder.findUnique({
      where: { id },
      include: { service: true, country: true },
    });
    if (!o || (userId && o.userId !== userId)) {
      throw new NotFoundException('Buyurtma topilmadi');
    }
    return o;
  }

  /** Raqam sotib olish. */
  async createOrder(params: {
    tenantId: string;
    userId: string;
    serviceId: string;
    countryId: string;
  }) {
    const { tenantId, userId, serviceId, countryId } = params;

    // Free sinov (10 kun) tugagan bo'lsa — do'kon sotolmaydi (tarif kerak).
    await this.catalog.assertCanSell(tenantId);

    const offer = await this.prisma.resellerOffer.findUnique({
      where: {
        tenantId_serviceId_countryId: { tenantId, serviceId, countryId },
      },
      include: { service: true, country: true },
    });
    if (!offer || !offer.isActive) {
      throw new NotFoundException("Bu xizmat do'konda mavjud emas");
    }

    // Jonli ulgurji: tan narxi (provayder + markup + kurs) + free-tarif ustamasi.
    // Router va free/paid ustama shu yerda (bir manba — offer sheet ham shuni ko'radi).
    const quote = await this.catalog.quoteFor(tenantId, serviceId, countryId);
    if (!quote) throw new BadRequestException("Bu yo'nalish hozircha mavjud emas");

    const retailUzs = Number(offer.retailPrice);
    const wholesaleUzs = quote.totalUzs; // tan narxi + ustama (reseller shu miqdorni to'laydi)

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    // Oldindan tekshiruv — provayderdan bekorga raqam sotib olmaslik uchun.
    // Yakuniy (poygaga chidamli) tekshiruv quyida, tranzaksiya ichida.
    if (Number(user.balance) < retailUzs) {
      const uzs = (n: number) => n.toLocaleString('uz-UZ') + " so'm";
      throw new BadRequestException(
        `Balansingizda mablag' yetarli emas. Kerak: ${uzs(retailUzs)}, balansingiz: ${uzs(Number(user.balance))}. Balansni to'ldiring.`,
      );
    }

    // Mijoz o'z balansidan sotib oladi. Reseller ulgurji hamyoni MIJOZ BALANSINI
    // to'ldirishda yechilgan — shuning uchun xaridda hamyondan QAYTA yechilmaydi.

    // Provayderdan raqam (tarmoq — DB tranzaksiyasidan tashqarida)
    const bought = await this.providers.buy(quote.provider, {
      serviceSlug: offer.service.slug,
      serviceHeroCode: offer.service.heroCode,
      countrySlug: offer.country.slug,
      countryIso2: offer.country.iso2,
      countryHeroCode: offer.country.heroCode,
    });
    // IZ QOLDIRAMIZ: shu nuqtadan keyin jarayon o'lsa/DB yiqilsa raqam DB'da
    // bo'lmaydi — bu log ulgurji pul qayerga ketganini topishning yagona yo'li.
    this.logger.log(
      `buy ok: ${quote.provider} ${bought.providerId} ${bought.phone} (tenant ${tenantId})`,
    );
    // Provayder haqiqatda undirgan narx kesh-narxdan sezilarli farq qilsa —
    // platforma jimgina zarar ko'rmasligi uchun ogohlantirish.
    if (bought.costUsd > 0 && Math.abs(bought.costUsd - quote.costUsd) > quote.costUsd * 0.1) {
      this.logger.warn(
        `narx farqi: kesh $${quote.costUsd} vs provayder $${bought.costUsd} (${offer.country.slug})`,
      );
    }

    // 3) Mijoz balansidan retail + order yaratish (atomik)
    const profit = retailUzs - wholesaleUzs;
    const orderNumber = 'V' + Date.now().toString(36).toUpperCase();
    const order = await this.prisma.$transaction(async (tx) => {
      // SHARTLI yechish: `update` o'rniga `updateMany` + `balance >= retail`.
      // Oddiy `update` faqat yuqoridagi o'qishga tayanadi — mijoz ikki marta
      // bossa yoki ikki qurilmadan bir vaqtda xarid qilsa, ikkalasi ham
      // tekshiruvdan o'tib balansni MANFIYGA tushirardi. Endi ikkinchisi
      // count=0 qaytaradi va xarid rad etiladi (raqam esa quyida provayderda
      // bekor qilinadi — pul ham, raqam ham yo'qolmaydi).
      const debited = await tx.user.updateMany({
        where: { id: userId, balance: { gte: retailUzs } },
        data: { balance: { decrement: retailUzs } },
      });
      if (debited.count !== 1) {
        throw new BadRequestException(
          "Balansingizda mablag' yetarli emas. Balansni to'ldiring.",
        );
      }
      const o = await tx.numberOrder.create({
        data: {
          orderNumber,
          tenantId,
          userId,
          serviceId,
          countryId,
          provider: quote.provider,
          providerId: bought.providerId,
          phone: bought.phone,
          status: NumberOrderStatus.WAITING_CODE,
          wholesalePrice: wholesaleUzs,
          retailPrice: retailUzs,
          profit,
          paidAt: new Date(),
          expiresAt: bought.expiresAt,
        },
        include: { service: true, country: true },
      });
      await tx.numberOrderEvent.create({
        data: {
          orderId: o.id,
          status: NumberOrderStatus.WAITING_CODE,
          comment: 'Raqam olindi',
        },
      });
      await tx.tenant.update({
        where: { id: tenantId },
        data: { totalOrders: { increment: 1 } },
      });
      return o;
    }).catch(async (err) => {
      // Raqam allaqachon provayderdan olingan. Tranzaksiya yiqilsa uni
      // bekor qilmasak, pul provayderda qolib ketadi (sof zarar).
      // DIQQAT: SPIDER'da cancel action YO'Q (no-op) — u yerda ulgurji pul
      // qaytmaydi; HeroSMS'da esa cancel ishlaydi. Ikkala holatda ham xatoni
      // JIM yutmaymiz — admin logdan providerId bo'yicha qo'lda hal qiladi.
      await this.providers
        .cancel(quote.provider, bought.providerId)
        .catch((cancelErr) => {
          this.logger.error(
            `KOMPENSATSIYA YIQILDI: ${quote.provider} ${bought.providerId} ` +
              `bekor qilinmadi (${String(cancelErr)}) — ulgurji pul provayderda qoldi!`,
          );
        });
      throw err;
    });

    // Buyurtma kartochkasi do'konning O'Z kanaliga tushishi uchun. Kanal
    // sozlanmagan bo'lsa hech narsa yuborilmaydi (opt-in), shu bois bu
    // hodisa xavfsiz. Mijozga xabar ham shu listenerda beriladi.
    this.events.emit('order.created', { orderId: order.id, tenantId });

    return order;
  }

  /** SMS kodni tekshirish (webapp poll / bot). */
  async check(id: string, userId?: string) {
    const o = await this.getOrder(id, userId);
    if (o.status !== NumberOrderStatus.WAITING_CODE) return o;
    const res = await this.providers.check(o.provider, o.providerId);
    if (res.status === 'RECEIVED' && res.code) {
      return this.markReceived(o.id, res.code, res.text);
    }
    if (res.status === 'CANCELLED') {
      return this.cancel(o.id, o.userId, 'Provayder bekor qildi');
    }
    return o;
  }

  private async markReceived(id: string, code: string, text: string | null) {
    // ATOMIK BAND QILISH: faqat WAITING_CODE -> RECEIVED. Bu metod IKKI yo'ldan
    // bir vaqtda chaqirilishi mumkin (cron har 20s + webapp/bot poll) — oddiy
    // `update` bo'lsa ikkalasi ham o'tib: totalRevenue IKKI marta oshardi,
    // kanalga IKKITA e'lon ketardi, va eng yomoni — CANCELLED/EXPIRED (pul
    // allaqachon qaytarilgan) holat RECEIVED bilan USTIDAN yozilib, mijozga
    // ham refund, ham kod tekin qolardi.
    // Band qilish + yon ta'sirlar BITTA tranzaksiyada — claim'dan keyin
    // jarayon o'lsa daromad/hodisa yozuvi yo'qolib qolmasin.
    const { o, won } = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.numberOrder.updateMany({
        where: { id, status: NumberOrderStatus.WAITING_CODE },
        data: {
          status: NumberOrderStatus.RECEIVED,
          code,
          smsText: text ?? code,
          receivedAt: new Date(),
        },
      });
      const ord = await tx.numberOrder.findUnique({
        where: { id },
        include: { service: true, country: true },
      });
      if (!ord) throw new NotFoundException('Buyurtma topilmadi');
      if (claimed.count !== 1) return { o: ord, won: false };

      // reseller foydasi endi tasdiqlanadi
      await tx.tenant.update({
        where: { id: ord.tenantId },
        data: { totalRevenue: { increment: Number(ord.profit) } },
      });
      await tx.numberOrderEvent.create({
        data: { orderId: id, status: NumberOrderStatus.RECEIVED, comment: 'Kod keldi' },
      });
      return { o: ord, won: true };
    });

    // Band qilish bizniki bo'lmasa (boshqa yo'l allaqachon yakunlagan yoki
    // buyurtma bekor bo'lgan) — hodisalarni QAYTARMAYMIZ.
    if (!won) return o;

    // Mijozga "Kod keldi!" DM'i + admin panel + webapp real-time.
    this.emitStatusChanged(o);
    // Sotuv yakunlandi — otziv kanaliga e'lon (ijtimoiy isbot) joylanishi uchun hodisa
    this.events.emit('sale.completed', { orderId: o.id, kind: 'NUMBER' });
    return o;
  }

  /** Bekor qilish — mijozga retail qaytariladi (hamyon xaridda yechilmagan). */
  async cancel(id: string, userId?: string, reason = 'Bekor qilindi') {
    const o = await this.getOrder(id, userId);
    if (o.status === NumberOrderStatus.RECEIVED) {
      throw new BadRequestException("Kod kelgan — bekor qilib bo'lmaydi");
    }
    // FAQAT WAITING_CODE bekor qilinadi. Ilgari shart "CANCELLED emas" edi —
    // ya'ni EXPIRED buyurtmaga cancel chaqirilsa (mijoz endpointi ochiq!)
    // pul IKKINCHI marta qaytarilardi: expire allaqachon refund qilgan.
    if (o.status !== NumberOrderStatus.WAITING_CODE) return o;
    try {
      await this.providers.cancel(o.provider, o.providerId);
    } catch {
      // provayderda bekor bo'lmasa ham davom etamiz
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      // ATOMIK BAND QILISH: ikki parallel cancel (mijoz tugmani ikki bosdi,
      // yoki cron "Provayder bekor qildi" bilan bir vaqtda) ikkalasi ham
      // yuqoridagi o'qishda WAITING_CODE ko'rishi mumkin. Refund faqat
      // statusni BIRINCHI bo'lib o'zgartirgan tomonda bo'ladi.
      const claimed = await tx.numberOrder.updateMany({
        where: { id, status: NumberOrderStatus.WAITING_CODE },
        data: { status: NumberOrderStatus.CANCELLED, cancelledAt: new Date() },
      });
      if (claimed.count !== 1) return null; // poyga — boshqa yo'l hal qilgan
      await tx.user.update({
        where: { id: o.userId },
        data: { balance: { increment: Number(o.retailPrice) } },
      });
      await tx.numberOrderEvent.create({
        data: { orderId: id, status: NumberOrderStatus.CANCELLED, comment: reason },
      });
      return tx.numberOrder.findUnique({
        where: { id },
        include: { service: true, country: true },
      });
    });
    // Mijozga retail qaytarildi (yuqorida). Reseller hamyoni xaridda yechilmagan
    // (to'ldirishda yechilgan) — shuning uchun bu yerda ham qaytarilmaydi.
    if (updated) {
      // Mijozga "bekor qilindi, pul qaytdi" DM'i + panel + webapp real-time.
      this.emitStatusChanged(updated);
    }
    return updated ?? this.getOrder(id, userId);
  }

  // ── Fon: kutayotgan buyurtmalarni poll qilish + muddatini tekshirish ──

  /**
   * Overlap qo'riqchisi. Cron har 20 soniyada OTADI — oldingi ishga tushish
   * tugaganini KUTMAYDI. 50 ta order x ~1s tashqi so'rov = 50s > 20s, ya'ni
   * bir order ustida 2-3 ta parallel check yurishi mumkin edi (poygalarni
   * kuchaytirib). Endi oldingi tugamaguncha yangi tick shunchaki o'tkaziladi.
   */
  private pollBusy = false;

  @Cron('*/20 * * * * *')
  async pollWaiting() {
    if (this.pollBusy) return;
    this.pollBusy = true;
    try {
      const waiting = await this.prisma.numberOrder.findMany({
        where: { status: NumberOrderStatus.WAITING_CODE },
        take: 50,
        orderBy: { createdAt: 'asc' },
      });
      // 5 talik guruhlarda parallel — jami vaqt chegaralanadi, provayder esa
      // bir vaqtda ko'p so'rov bilan bombardimon qilinmaydi.
      for (let i = 0; i < waiting.length; i += 5) {
        const batch = waiting.slice(i, i + 5);
        await Promise.all(
          batch.map(async (o) => {
            try {
              if (o.expiresAt < new Date()) {
                await this.expire(o.id);
                return;
              }
              const res = await this.providers.check(o.provider, o.providerId);
              if (res.status === 'RECEIVED' && res.code) {
                await this.markReceived(o.id, res.code, res.text);
              } else if (res.status === 'CANCELLED') {
                await this.cancel(o.id, undefined, 'Provayder bekor qildi');
              }
            } catch (e) {
              this.logger.warn(`poll ${o.id}: ${String(e)}`);
            }
          }),
        );
      }
    } finally {
      this.pollBusy = false;
    }
  }

  private async expire(id: string) {
    const expired = await this.prisma.$transaction(async (tx) => {
      // ATOMIK BAND QILISH: refund faqat statusni WAITING_CODE -> EXPIRED ga
      // BIRINCHI bo'lib o'tkazgan tomonda. Ilgari o'qish-tekshirish tranzaksiya
      // TASHQARISIDA edi — ikki parallel expire (yoki expire + cancel) ikkalasi
      // ham refund qilib, mijozga pul IKKI marta qaytishi mumkin edi.
      const claimed = await tx.numberOrder.updateMany({
        where: { id, status: NumberOrderStatus.WAITING_CODE },
        data: { status: NumberOrderStatus.EXPIRED },
      });
      if (claimed.count !== 1) return null; // boshqa yo'l allaqachon hal qilgan

      const o = await tx.numberOrder.findUnique({ where: { id } });
      if (!o) return null;
      await tx.user.update({
        where: { id: o.userId },
        data: { balance: { increment: Number(o.retailPrice) } },
      });
      await tx.numberOrderEvent.create({
        data: {
          orderId: id,
          status: NumberOrderStatus.EXPIRED,
          comment: 'Muddat tugadi',
        },
      });
      return o;
    });
    // Mijoz balansi qaytarildi (yuqorida). Reseller hamyoni xaridda yechilmagan.
    if (expired) {
      // Mijozga "muddat tugadi, pul qaytdi" DM'i + panel + webapp real-time.
      this.emitStatusChanged(expired);
    }
  }
}
