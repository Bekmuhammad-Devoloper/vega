import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NumberOrderStatus } from '@prisma/client';
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
    return Number(this.config.get('USD_TO_UZS') ?? 12000);
  }
  private uzs(usd: number): number {
    return Math.round((usd * this.usdToUzs) / 100) * 100;
  }

  /** Reseller do'konidagi mavjud takliflar (mijoz storefront'i). */
  storefront(tenantId: string) {
    return this.prisma.resellerOffer.findMany({
      where: { tenantId, isActive: true },
      include: { service: true, country: true },
      orderBy: [{ service: { position: 'asc' } }, { country: { position: 'asc' } }],
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
    if (Number(user.balance) < retailUzs) {
      throw new BadRequestException(
        "Balansingizda mablag' yetarli emas. Balansni to'ldiring.",
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

    // 3) Mijoz balansidan retail + order yaratish (atomik)
    const profit = retailUzs - wholesaleUzs;
    const orderNumber = 'V' + Date.now().toString(36).toUpperCase();
    const order = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: retailUzs } },
      });
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
    });
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
    const o = await this.prisma.numberOrder.update({
      where: { id },
      data: {
        status: NumberOrderStatus.RECEIVED,
        code,
        smsText: text ?? code,
        receivedAt: new Date(),
      },
      include: { service: true, country: true },
    });
    // reseller foydasi endi tasdiqlanadi
    await this.prisma.tenant.update({
      where: { id: o.tenantId },
      data: { totalRevenue: { increment: Number(o.profit) } },
    });
    await this.prisma.numberOrderEvent.create({
      data: { orderId: id, status: NumberOrderStatus.RECEIVED, comment: 'Kod keldi' },
    });
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
    if (o.status === NumberOrderStatus.CANCELLED) return o;
    try {
      await this.providers.cancel(o.provider, o.providerId);
    } catch {
      // provayderda bekor bo'lmasa ham davom etamiz
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: o.userId },
        data: { balance: { increment: Number(o.retailPrice) } },
      });
      const u = await tx.numberOrder.update({
        where: { id },
        data: { status: NumberOrderStatus.CANCELLED, cancelledAt: new Date() },
        include: { service: true, country: true },
      });
      await tx.numberOrderEvent.create({
        data: { orderId: id, status: NumberOrderStatus.CANCELLED, comment: reason },
      });
      return u;
    });
    // Mijozga retail qaytarildi (yuqorida). Reseller hamyoni xaridda yechilmagan
    // (to'ldirishda yechilgan) — shuning uchun bu yerda ham qaytarilmaydi.
    return updated;
  }

  // ── Fon: kutayotgan buyurtmalarni poll qilish + muddatini tekshirish ──
  @Cron('*/20 * * * * *')
  async pollWaiting() {
    const waiting = await this.prisma.numberOrder.findMany({
      where: { status: NumberOrderStatus.WAITING_CODE },
      take: 50,
      orderBy: { createdAt: 'asc' },
    });
    for (const o of waiting) {
      try {
        if (o.expiresAt < new Date()) {
          await this.expire(o.id);
          continue;
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
    }
  }

  private async expire(id: string) {
    const o = await this.prisma.numberOrder.findUnique({ where: { id } });
    if (!o || o.status !== NumberOrderStatus.WAITING_CODE) return;
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: o.userId },
        data: { balance: { increment: Number(o.retailPrice) } },
      });
      await tx.numberOrder.update({
        where: { id },
        data: { status: NumberOrderStatus.EXPIRED },
      });
      await tx.numberOrderEvent.create({
        data: {
          orderId: id,
          status: NumberOrderStatus.EXPIRED,
          comment: 'Muddat tugadi',
        },
      });
    });
    // Mijoz balansi qaytarildi (yuqorida). Reseller hamyoni xaridda yechilmagan.
  }
}
