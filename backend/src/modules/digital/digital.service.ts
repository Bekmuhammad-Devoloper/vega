import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DigitalKind, DigitalOrderStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { CatalogService } from '../catalog/catalog.service';
import { SmmProvider } from '../providers/smm.provider';
import { TelegramGiftProvider } from '../providers/telegram-gift.provider';
import { IstarProvider } from '../providers/istar.provider';
import { TelegramUserbotProvider } from '../providers/telegram-userbot.provider';

/// Stars/Premium oqimi: reseller yoqadi + narx qo'yadi -> mijoz @username bilan
/// sotib oladi (retail balansidan) -> reseller hamyonidan ulgurji yechiladi ->
/// yetkazish 4 bosqichli fallback bilan:
///   1) iStar API — Stars ham, Premium ham, istalgan @username (ENG ARZON)
///   2) PREMIUM  -> rasmiy Bot API (faqat botda Stars balansi bo'lsa — qimmat)
///   3) SMM panel
///   4) PENDING qoladi, dev panel Fragment orqali qo'lda yetkazadi
@Injectable()
export class DigitalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
    private readonly catalogSvc: CatalogService,
    private readonly smm: SmmProvider,
    private readonly tgGift: TelegramGiftProvider,
    private readonly istar: IstarProvider,
    private readonly userbot: TelegramUserbotProvider,
  ) {}

  /** iStar buyurtmalari providerOrderId'da shu prefiks bilan saqlanadi. */
  private static readonly ISTAR_PREFIX = 'istar:';

  private readonly logger = new Logger(DigitalService.name);

  private get rate(): number {
    return Number(this.config.get('USD_TO_UZS') ?? 12000);
  }
  private uzs(usd: number): number {
    return Math.round((usd * this.rate) / 100) * 100;
  }

  // ── MIJOZ ──────────────────────────────────────────────────────────

  async storefront(tenantId: string) {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { starsEnabled: true, premiumEnabled: true, giftsEnabled: true },
    });
    const offers = await this.prisma.digitalOffer.findMany({
      where: { tenantId, isActive: true, digitalProduct: { isActive: true } },
      include: { digitalProduct: true },
      orderBy: { digitalProduct: { position: 'asc' } },
    });
    const pick = (kind: DigitalKind) =>
      offers
        .filter((o) => o.digitalProduct.kind === kind)
        .map((o) => ({
          productId: o.digitalProductId,
          label: o.digitalProduct.label,
          amount: o.digitalProduct.amount,
          retailPrice: Number(o.retailPrice),
        }));
    return {
      starsEnabled: !!t?.starsEnabled,
      premiumEnabled: !!t?.premiumEnabled,
      giftsEnabled: !!t?.giftsEnabled,
      stars: t?.starsEnabled ? pick(DigitalKind.STARS) : [],
      premium: t?.premiumEnabled ? pick(DigitalKind.PREMIUM) : [],
      gifts: t?.giftsEnabled ? pick(DigitalKind.GIFT) : [],
    };
  }

  myOrders(tenantId: string, userId: string, take = 30) {
    return this.prisma.digitalOrder.findMany({
      where: { tenantId, userId },
      include: { digitalProduct: true },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async getOrder(id: string, userId?: string) {
    const o = await this.prisma.digitalOrder.findUnique({
      where: { id },
      include: { digitalProduct: true },
    });
    if (!o || (userId && o.userId !== userId)) {
      throw new NotFoundException('Buyurtma topilmadi');
    }
    return o;
  }

  async createOrder(params: {
    tenantId: string;
    userId: string;
    digitalProductId: string;
    username: string;
  }) {
    const { tenantId, userId, digitalProductId } = params;

    // Free sinov (10 kun) tugagan bo'lsa — do'kon sotolmaydi (tarif kerak).
    await this.catalogSvc.assertCanSell(tenantId);

    const offer = await this.prisma.digitalOffer.findUnique({
      where: { tenantId_digitalProductId: { tenantId, digitalProductId } },
      include: { digitalProduct: true },
    });
    if (!offer || !offer.isActive || !offer.digitalProduct.isActive) {
      throw new NotFoundException("Bu mahsulot do'konda mavjud emas");
    }
    const kind = offer.digitalProduct.kind;

    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { starsEnabled: true, premiumEnabled: true, giftsEnabled: true },
    });
    if (
      (kind === DigitalKind.STARS && !t?.starsEnabled) ||
      (kind === DigitalKind.PREMIUM && !t?.premiumEnabled) ||
      (kind === DigitalKind.GIFT && !t?.giftsEnabled)
    ) {
      throw new BadRequestException("Bu xizmat hozircha o'chirilgan");
    }

    const uname = params.username.trim().replace(/^@/, '');
    if (!/^[a-zA-Z0-9_]{4,32}$/.test(uname)) {
      throw new BadRequestException(
        "Username noto'g'ri (@ belgisiz, 4-32 harf/raqam/_)",
      );
    }

    const retailUzs = Number(offer.retailPrice);
    const wholesaleUzs = this.uzs(Number(offer.digitalProduct.wholesaleUsd));

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    if (Number(user.balance) < retailUzs) {
      throw new BadRequestException(
        "Balansingizda mablag' yetarli emas. Balansni to'ldiring.",
      );
    }

    // Mijoz o'z balansidan sotib oladi. Reseller hamyoni MIJOZ BALANSINI
    // to'ldirishda yechilgan — shuning uchun xaridda hamyondan QAYTA yechilmaydi.
    const profit = retailUzs - wholesaleUzs;
    const orderNumber = 'D' + Date.now().toString(36).toUpperCase();
    const order = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: retailUzs } },
      });
      const o = await tx.digitalOrder.create({
        data: {
          orderNumber,
          tenantId,
          userId,
          digitalProductId,
          kind,
          username: uname,
          status: DigitalOrderStatus.PENDING,
          wholesalePrice: wholesaleUzs,
          retailPrice: retailUzs,
          profit,
          paidAt: new Date(),
        },
        include: { digitalProduct: true },
      });
      await tx.tenant.update({
        where: { id: tenantId },
        data: { totalOrders: { increment: 1 } },
      });
      return o;
    });
    // Avto-yetkazish — fon, bloklamaydi. Ishlamasa PENDING qoladi (qo'lda).
    void this.autoDeliver(order.id, uname, userId, kind, order.digitalProduct);
    return order;
  }

  /**
   * Avto-yetkazish yo'l tanlash: PREMIUM avval RASMIY Bot API bilan urinadi
   * (bepul, Fragment kerak emas), bo'lmasa SMM panelga tushadi.
   */
  private async autoDeliver(
    orderId: string,
    username: string,
    buyerUserId: string,
    kind: DigitalKind,
    product: {
      providerServiceId: string | null;
      providerQty: number | null;
      amount: number;
    },
  ): Promise<void> {
    // SOVG'A — faqat userbot yetkaza oladi (iStar/SMM da sovg'a yo'q),
    // shuning uchun boshqa yo'llarga tushirmaymiz.
    if (kind === DigitalKind.GIFT) {
      await this.trySendGift(orderId, username, product.providerServiceId);
      return;
    }

    // 1) iStar — eng arzon va ikkala mahsulotni ham qamraydi.
    if (await this.tryIstar(orderId, username, kind, product.amount)) return;
    // 2) Premium uchun rasmiy Bot API (botda Stars bo'lsa).
    if (kind === DigitalKind.PREMIUM) {
      const done = await this.tryGiftPremium(
        orderId,
        username,
        buyerUserId,
        product.amount,
      );
      if (done) return;
    }
    // 3) SMM panel.
    await this.autoPlaceOrder(orderId, username, product);
  }

  /**
   * Telegram sovg'asini userbot orqali yuboradi. Muvaffaqiyat -> darhol
   * FULFILLED. Bo'lmasa PENDING qoladi va dev panel qo'lda yetkazadi.
   * Sovg'aning Telegram id'si mahsulotning `providerServiceId` maydonida.
   */
  private async trySendGift(
    orderId: string,
    username: string,
    giftId: string | null,
  ): Promise<boolean> {
    if (!this.userbot.isConfigured()) {
      this.logger.log(`Digital ${orderId}: userbot sozlanmagan — qo'lda`);
      return false;
    }
    if (!giftId) {
      this.logger.warn(
        `Digital ${orderId}: mahsulotda sovg'a id yo'q (providerServiceId) — qo'lda`,
      );
      return false;
    }
    try {
      const res = await this.userbot.sendGift(
        username,
        giftId,
        'Xaridingiz uchun rahmat!',
      );
      if (!res.ok) return false;
      await this.fulfill(orderId, 'auto-userbot', `Avto-yetkazildi (sovg'a)`);
      return true;
    } catch (e) {
      this.logger.warn(
        `Digital ${orderId} sovg'a xato: ${(e as Error).message}`,
      );
      return false;
    }
  }

  /**
   * iStar orqali joylash. Buyurtma DARHOL bajarilmaydi — `providerOrderId`
   * `istar:` prefiksi bilan saqlanadi va pollAutoDigital kuzatib boradi.
   */
  private async tryIstar(
    orderId: string,
    username: string,
    kind: DigitalKind,
    amount: number,
  ): Promise<boolean> {
    if (!this.istar.isConfigured()) return false;
    const type = kind === DigitalKind.STARS ? 'star' : 'premium';
    try {
      const recipient = await this.istar.findRecipient(type, username, amount);
      if (!recipient) {
        // Kanal/bot yoki mavjud bo'lmagan username — keyingi yo'lga o'tamiz.
        this.logger.log(
          `Digital ${orderId}: iStar @${username}ni topolmadi — keyingi yo'l`,
        );
        return false;
      }
      const providerOrderId =
        type === 'star'
          ? await this.istar.orderStars(username, recipient.hash, amount)
          : await this.istar.orderPremium(username, recipient.hash, amount);
      await this.prisma.digitalOrder.update({
        where: { id: orderId },
        data: {
          providerOrderId: DigitalService.ISTAR_PREFIX + providerOrderId,
        },
      });
      this.logger.log(`Digital ${orderId} -> iStar #${providerOrderId}`);
      return true;
    } catch (e) {
      this.logger.warn(
        `Digital ${orderId} iStar xato: ${(e as Error).message}`,
      );
      return false;
    }
  }

  /**
   * @username -> Telegram raqam id. Bot API'da username yechish metodi yo'q,
   * shuning uchun faqat bizning bazadagi foydalanuvchilar topiladi.
   */
  private async resolveTelegramId(
    username: string,
    buyerUserId: string,
  ): Promise<bigint | null> {
    // Ko'p holatda mijoz O'ZIGA oladi — avval xaridorning o'zini tekshiramiz.
    const buyer = await this.prisma.user.findUnique({
      where: { id: buyerUserId },
      select: { username: true, telegramId: true },
    });
    if (buyer?.username?.toLowerCase() === username.toLowerCase()) {
      return buyer.telegramId;
    }
    const other = await this.prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      select: { telegramId: true },
    });
    return other?.telegramId ?? null;
  }

  /** Rasmiy Bot API bilan Premium sovg'a. Muvaffaqiyat -> darhol FULFILLED. */
  private async tryGiftPremium(
    orderId: string,
    username: string,
    buyerUserId: string,
    months: number,
  ): Promise<boolean> {
    if (!this.tgGift.isConfigured()) return false;
    if (!this.tgGift.starCostFor(months)) {
      this.logger.warn(
        `Digital ${orderId}: Premium ${months} oy Bot API'da yo'q (3/6/12) — SMM/qo'lda`,
      );
      return false;
    }
    try {
      const tgId = await this.resolveTelegramId(username, buyerUserId);
      if (!tgId) {
        this.logger.log(
          `Digital ${orderId}: @${username} bazada yo'q — Bot API o'tkazib yuborildi`,
        );
        return false;
      }
      const res = await this.tgGift.giftPremium(
        tgId,
        months,
        `Premium ${months} oy — xaridingiz uchun rahmat!`,
      );
      if (!res.ok) return false;
      await this.fulfill(
        orderId,
        'auto-telegram',
        `Avto-yetkazildi (Bot API, ${this.tgGift.starCostFor(months)} Stars)`,
      );
      return true;
    } catch (e) {
      this.logger.warn(
        `Digital ${orderId} Bot API sovg'a xato: ${(e as Error).message}`,
      );
      return false;
    }
  }

  /** SMM panelga buyurtma joylaydi (avto). Xato/sozlanmagan bo'lsa PENDING qoladi (qo'lda). */
  private async autoPlaceOrder(
    orderId: string,
    username: string,
    product: {
      providerServiceId: string | null;
      providerQty: number | null;
      amount: number;
    },
  ): Promise<void> {
    if (!this.smm.isConfigured() || !product.providerServiceId) return;
    try {
      const qty = product.providerQty ?? product.amount;
      const providerOrderId = await this.smm.placeOrder(
        product.providerServiceId,
        this.smm.linkFor(username),
        qty,
      );
      await this.prisma.digitalOrder.update({
        where: { id: orderId },
        data: { providerOrderId },
      });
      this.logger.log(`Digital ${orderId} -> SMM #${providerOrderId}`);
    } catch (e) {
      this.logger.warn(
        `Digital ${orderId} avto-joylash xato: ${(e as Error).message}`,
      );
    }
  }

  // ── Fon: avto-buyurtmalar holatini kuzatish (iStar + SMM) ──
  /// iStar sekundiga 1 so'rovga cheklangan, shuning uchun bir tsikl uzoq
  /// cho'zilishi mumkin — tsikllar ustma-ust tushmasligi uchun qulf.
  private polling = false;

  @Cron('*/30 * * * * *')
  async pollAutoDigital(): Promise<void> {
    if (!this.istar.isConfigured() && !this.smm.isConfigured()) return;
    if (this.polling) return;
    this.polling = true;
    try {
      const orders = await this.prisma.digitalOrder.findMany({
        where: {
          status: DigitalOrderStatus.PENDING,
          providerOrderId: { not: null },
        },
        take: 25,
        orderBy: { createdAt: 'asc' },
      });
      for (const o of orders) {
        const ref = o.providerOrderId as string;
        try {
          if (ref.startsWith(DigitalService.ISTAR_PREFIX)) {
            const st = await this.istar.orderStatus(
              ref.slice(DigitalService.ISTAR_PREFIX.length),
            );
            if (st === 'completed') {
              await this.fulfill(o.id, 'auto-istar', 'Avto-yetkazildi (iStar)');
            } else if (st === 'failed') {
              await this.cancelOrder(o.id, "iStar xato — mablag' qaytarildi");
            }
          } else {
            const st = await this.smm.orderStatus(ref);
            if (st === 'completed') {
              await this.fulfill(o.id, 'auto-smm', 'Avto-yetkazildi (SMM)');
            } else if (st === 'canceled' || st === 'error') {
              await this.cancelOrder(o.id, "SMM bekor/xato — mablag' qaytarildi");
            }
          }
          // processing / pending -> keyingi tsiklda tekshiriladi
        } catch (e) {
          this.logger.warn(`poll digital ${o.id}: ${(e as Error).message}`);
        }
      }
    } finally {
      this.polling = false;
    }
  }

  // ── RESELLER (admin) ───────────────────────────────────────────────

  async catalog() {
    const rows = await this.prisma.digitalProduct.findMany({
      where: { isActive: true },
      orderBy: [{ kind: 'asc' }, { position: 'asc' }],
    });
    // Reseller so'mda o'ylaydi. Kursni frontendga bermaymiz — shu yerda
    // o'girib beramiz, aks holda har panel o'zicha kurs yozib qo'yardi.
    return rows.map((p) => ({
      ...p,
      wholesaleUzs: this.uzs(Number(p.wholesaleUsd)),
    }));
  }

  offers(tenantId: string) {
    return this.prisma.digitalOffer.findMany({
      where: { tenantId },
      include: { digitalProduct: true },
      orderBy: { digitalProduct: { position: 'asc' } },
    });
  }

  async upsertOffer(tenantId: string, digitalProductId: string, retailPrice: number) {
    const p = await this.prisma.digitalProduct.findUnique({
      where: { id: digitalProductId },
    });
    if (!p) throw new NotFoundException('Mahsulot topilmadi');
    return this.prisma.digitalOffer.upsert({
      where: { tenantId_digitalProductId: { tenantId, digitalProductId } },
      update: { retailPrice, isActive: true },
      create: { tenantId, digitalProductId, retailPrice },
      include: { digitalProduct: true },
    });
  }

  async deleteOffer(tenantId: string, id: string) {
    const o = await this.prisma.digitalOffer.findUnique({ where: { id } });
    if (!o || o.tenantId !== tenantId) throw new NotFoundException('Topilmadi');
    await this.prisma.digitalOffer.delete({ where: { id } });
    return { ok: true };
  }

  setSettings(
    tenantId: string,
    dto: { starsEnabled?: boolean; premiumEnabled?: boolean },
  ) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(dto.starsEnabled !== undefined ? { starsEnabled: dto.starsEnabled } : {}),
        ...(dto.premiumEnabled !== undefined
          ? { premiumEnabled: dto.premiumEnabled }
          : {}),
      },
      select: { starsEnabled: true, premiumEnabled: true },
    });
  }

  adminOrders(tenantId: string, take = 50) {
    return this.prisma.digitalOrder.findMany({
      where: { tenantId },
      include: { digitalProduct: true, user: true },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  // ── PLATFORMA (dev panel) ──────────────────────────────────────────

  allProducts() {
    return this.prisma.digitalProduct.findMany({
      orderBy: [{ kind: 'asc' }, { position: 'asc' }],
    });
  }

  createProduct(data: {
    kind: DigitalKind;
    label: string;
    amount: number;
    wholesaleUsd: number;
    position?: number;
    providerServiceId?: string;
    providerQty?: number;
  }) {
    return this.prisma.digitalProduct.create({
      data: { ...data, providerServiceId: data.providerServiceId?.trim() || null },
    });
  }

  updateProduct(
    id: string,
    data: Partial<{
      label: string;
      amount: number;
      wholesaleUsd: number;
      isActive: boolean;
      position: number;
      providerServiceId: string;
      providerQty: number;
    }>,
  ) {
    const { providerServiceId, ...rest } = data;
    return this.prisma.digitalProduct.update({
      where: { id },
      data: {
        ...rest,
        // bo'sh string -> null (avto-yetkazishni o'chirish)
        ...(providerServiceId !== undefined
          ? { providerServiceId: providerServiceId.trim() || null }
          : {}),
      },
    });
  }

  pendingOrders(take = 100) {
    return this.prisma.digitalOrder.findMany({
      where: { status: DigitalOrderStatus.PENDING },
      include: {
        digitalProduct: true,
        tenant: { select: { slug: true, shopName: true } },
        user: { select: { username: true, telegramId: true } },
      },
      orderBy: { createdAt: 'asc' },
      take,
    });
  }

  /**
   * Avto-yetkazish holati (dev panel): qaysi provayder sozlangan, balanslari
   * qancha. iStar birinchi navbatda ishlatiladi — arzonroq va Stars ham,
   * Premium ham qamraladi.
   */
  async deliveryStatus() {
    const [istarBalance, istarPackages, botStars] = await Promise.all([
      this.istar.isConfigured()
        ? this.istar.balance().catch(() => null)
        : Promise.resolve(null),
      this.istar.isConfigured()
        ? this.istar.packages().catch(() => null)
        : Promise.resolve(null),
      this.tgGift.starBalance(),
    ]);
    return {
      istar: {
        configured: this.istar.isConfigured(),
        balance: istarBalance,
        packages: istarPackages,
      },
      telegramBotApi: {
        configured: this.tgGift.isConfigured(),
        starBalance: botStars,
        premiumCost: { 3: 1000, 6: 1500, 12: 2500 },
      },
      smm: { configured: this.smm.isConfigured() },
      userbot: {
        configured: this.userbot.isConfigured(),
        starBalance: await this.userbot.starBalance(),
      },
    };
  }

  /**
   * Telegram'dagi sovg'alar katalogini tortib, DigitalProduct'larga yozadi.
   * Sovg'aning Telegram id'si `providerServiceId` da saqlanadi — yetkazishda
   * aynan shu ishlatiladi. Tugab qolgan (soldOut) sovg'alar o'chiriladi.
   *
   * Ulgurji narx: stars × bitta Stars tannarxi × (1 + marja).
   * Tannarx `GIFT_STAR_USD` (default 0.0158 = Fragment $0.015 + iStar 5%).
   */
  async syncGiftCatalog() {
    if (!this.userbot.isConfigured()) {
      throw new BadRequestException(
        "Userbot sozlanmagan (TG_API_ID / TG_API_HASH / TG_SESSION)",
      );
    }
    const starUsd = Number(this.config.get('GIFT_STAR_USD') ?? 0.0158);
    const markup = Number(this.config.get('GIFT_MARKUP_PERCENT') ?? 20);

    const gifts = await this.userbot.listGifts();
    let created = 0,
      updated = 0,
      disabled = 0;

    for (const g of gifts) {
      const wholesaleUsd = Number(
        (g.stars * starUsd * (1 + markup / 100)).toFixed(4),
      );
      const label = `${g.emoji ?? '🎁'} ${g.stars} Stars`;
      // amount = Stars narxi -> @@unique([kind, amount]) bilan mos keladi
      const existing = await this.prisma.digitalProduct.findUnique({
        where: { kind_amount: { kind: DigitalKind.GIFT, amount: g.stars } },
      });
      if (existing) {
        await this.prisma.digitalProduct.update({
          where: { id: existing.id },
          data: {
            label,
            wholesaleUsd,
            providerServiceId: g.giftId,
            isActive: !g.soldOut,
          },
        });
        if (g.soldOut) disabled++;
        else updated++;
      } else {
        if (g.soldOut) continue; // tugaganini qo'shmaymiz
        await this.prisma.digitalProduct.create({
          data: {
            kind: DigitalKind.GIFT,
            label,
            amount: g.stars,
            wholesaleUsd,
            providerServiceId: g.giftId,
            position: g.stars,
            isActive: true,
          },
        });
        created++;
      }
    }
    this.logger.log(
      `Sovg'a katalogi: +${created} yangi, ${updated} yangilandi, ${disabled} o'chirildi`,
    );
    return { total: gifts.length, created, updated, disabled };
  }

  async fulfill(id: string, adminId: string, note?: string) {
    const o = await this.prisma.digitalOrder.findUnique({ where: { id } });
    if (!o) throw new NotFoundException('Buyurtma topilmadi');
    if (o.status !== DigitalOrderStatus.PENDING) {
      throw new BadRequestException('Bu buyurtma allaqachon ' + o.status);
    }
    const updated = await this.prisma.digitalOrder.update({
      where: { id },
      data: {
        status: DigitalOrderStatus.FULFILLED,
        fulfilledAt: new Date(),
        fulfilledBy: adminId,
        note,
      },
    });
    await this.prisma.tenant.update({
      where: { id: o.tenantId },
      data: { totalRevenue: { increment: Number(o.profit) } },
    });
    // Sotuv yakunlandi — otziv kanaliga e'lon (ijtimoiy isbot) joylanishi uchun hodisa
    this.events.emit('sale.completed', { orderId: updated.id, kind: 'DIGITAL' });
    return updated;
  }

  async cancelOrder(id: string, note?: string) {
    const o = await this.prisma.digitalOrder.findUnique({ where: { id } });
    if (!o) throw new NotFoundException('Buyurtma topilmadi');
    if (o.status === DigitalOrderStatus.CANCELLED) return o;
    if (o.status === DigitalOrderStatus.FULFILLED) {
      throw new BadRequestException("Bajarilgan — bekor qilib bo'lmaydi");
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: o.userId },
        data: { balance: { increment: Number(o.retailPrice) } },
      });
      return tx.digitalOrder.update({
        where: { id },
        data: { status: DigitalOrderStatus.CANCELLED, note },
      });
    });
    // Mijozga retail qaytarildi (yuqorida). Hamyon xaridda yechilmagan — qaytarilmaydi.
    return updated;
  }
}
