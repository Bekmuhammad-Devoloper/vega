import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import type { TariffPlan, Tenant } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  InvalidInitDataError,
  verifyTelegramInitData,
} from '@/common/helpers/telegram-init-data';
import { TARIFFS } from './tariffs';
import { PAYMENT_INFO } from './payment-info';
import { buildPaymentCaption } from './payment-caption';
import { TelegramBotService } from '../telegram-bot/telegram-bot.service';
import { TenantBotService } from '../telegram-bot/tenant-bot.service';
import { ReferralService } from '../referral/referral.service';
import { checkBotToken } from '@/common/helpers/telegram-bot-token';

export interface OnboardInput {
  shopName: string;
  ownerName: string;
  ownerPhone: string;
  tariffPlan: TariffPlan;
  logoUrl?: string;
  botToken?: string;
  /** Referal kod (?ref=KOD) — kim taklif qilgani */
  ref?: string;
  /** Qurilma ID (brauzer) — abuse himoyasi (bir qurilma = bitta free) */
  deviceId?: string;
}

export interface BotCheckResult {
  ok: boolean;
  username?: string;
  firstName?: string;
  error?: string;
}

export interface SellerTenantView {
  id: string;
  slug: string;
  shopName: string;
  ownerName: string;
  ownerPhone: string | null;
  logoUrl: string | null;
}

export interface SellerProfile {
  registered: boolean;
  tenant?: SellerTenantView;
}

@Injectable()
export class SellerOnboardingService {
  private readonly logger = new Logger(SellerOnboardingService.name);
  private readonly botToken: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tgbot: TelegramBotService,
    private readonly tenantBot: TenantBotService,
    private readonly referral: ReferralService,
    config: ConfigService,
  ) {
    this.botToken = config.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
  }

  /** To'lov chekini yuklab, admin chatiga tasdiqlash xabarini yuboradi. */
  async submitPaymentReceipt(initData: string, receipt: Buffer): Promise<{ ok: true }> {
    const parsed = this.verify(initData);
    // Bir nechta do'kon bo'lsa — to'lov (faollashtirish) kutilayotganini olamiz
    const tenant =
      (await this.prisma.tenant.findFirst({
        where: { ownerTelegramId: BigInt(parsed.user.id), status: 'PENDING_PAYMENT' },
        orderBy: { createdAt: 'asc' },
      })) ??
      (await this.prisma.tenant.findFirst({
        where: { ownerTelegramId: BigInt(parsed.user.id) },
        orderBy: { createdAt: 'asc' },
      }));
    if (!tenant) throw new BadRequestException("Do'kon topilmadi");
    if (tenant.isActivated) {
      throw new BadRequestException("Do'kon allaqachon faollashtirilgan");
    }

    // Username onboarding'da saqlanmagan bo'lsa (eski tenant) — initData'dan to'ldiramiz
    if (!tenant.ownerUsername && parsed.user.username) {
      tenant.ownerUsername = parsed.user.username;
    }
    const caption = buildPaymentCaption(tenant, "Yangi to'lov — tasdiqlash kerak");

    try {
      await this.tgbot.sendPaymentReceipt(receipt, caption, tenant.id);
    } catch (err) {
      this.logger.error(`Payment receipt send failed: ${(err as Error).message}`);
      throw new BadRequestException(
        "To'lovni yuborishda xatolik. Iltimos keyinroq urinib ko'ring yoki administrator bilan bog'laning.",
      );
    }
    return { ok: true };
  }

  /** Tarif ro'yxati — bir martalik faollashtirish narxi bazadagi TariffConfig'dan (super-admin sozlaydi). */
  async tariffs() {
    const configs = await this.prisma.tariffConfig.findMany();
    const byPlan = new Map(configs.map((c) => [c.plan, c]));
    return TARIFFS.map((t) => {
      const c = byPlan.get(t.value);
      return {
        ...t,
        oneTimePrice: c ? Number(c.oneTimePrice) : t.priceMonthly,
      };
    });
  }

  paymentInfo() {
    return PAYMENT_INFO;
  }

  /** Sotuvchi bot tokenini Telegram getMe orqali tekshiradi. */
  validateBotToken(rawToken: string): Promise<BotCheckResult> {
    return checkBotToken(rawToken);
  }

  /** initData'ni tekshiradi va Telegram foydalanuvchini qaytaradi. */
  private verify(initData: string) {
    try {
      return verifyTelegramInitData(initData, this.botToken);
    } catch (err) {
      throw new UnauthorizedException(
        err instanceof InvalidInitDataError ? err.message : 'Telegram tekshiruvi xato',
      );
    }
  }

  private serialize(t: Tenant): SellerTenantView {
    return {
      id: t.id,
      slug: t.slug,
      shopName: t.shopName,
      ownerName: t.ownerName,
      ownerPhone: t.ownerPhone,
      logoUrl: t.logoUrl,
    };
  }

  /** Foydalanuvchi ro'yxatdan o'tganmi — bot formani yoki panelni ochishni hal qiladi. */
  async me(initData: string): Promise<SellerProfile> {
    const parsed = this.verify(initData);
    // Bir nechta do'kon bo'lsa — birinchisi (eng eski). Panel ichida almashtiriladi.
    const tenant = await this.prisma.tenant.findFirst({
      where: { ownerTelegramId: BigInt(parsed.user.id) },
      orderBy: { createdAt: 'asc' },
    });
    return tenant ? { registered: true, tenant: this.serialize(tenant) } : { registered: false };
  }

  /** Yangi do'kon yaratish (Telegram ID bo'yicha). Logo bo'lmasa null — storefront Sellio default'ni ko'rsatadi. */
  async onboard(initData: string, dto: OnboardInput): Promise<SellerProfile> {
    const parsed = this.verify(initData);
    const telegramId = BigInt(parsed.user.id);

    // Birinchi ro'yxatdan o'tish — agar do'kon bor bo'lsa idempotent qaytaramiz.
    // Qo'shimcha do'konlar panel ichidagi "Yangi do'kon" orqali ochiladi.
    const existing = await this.prisma.tenant.findFirst({
      where: { ownerTelegramId: telegramId },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) {
      // Idempotent — allaqachon ro'yxatdan o'tgan
      return { registered: true, tenant: this.serialize(existing) };
    }

    // Qurilma bloki: shu qurilmada (brauzer) boshqa Telegram akkaunt allaqachon
    // do'kon ochgan bo'lsa — yangi FREE bermaymiz (bir qurilma = bitta free).
    const deviceId = dto.deviceId?.trim() || null;
    if (deviceId) {
      const deviceTaken = await this.prisma.tenant.findFirst({
        where: { deviceId },
        select: { id: true },
      });
      if (deviceTaken) {
        throw new ConflictException(
          "Bu qurilmada allaqachon do'kon ochilgan. Free tarif bir marta beriladi — avvalgi Telegram hisobingiz bilan kiring yoki tarif sotib oling.",
        );
      }
    }

    const shopName = dto.shopName.trim();
    const ownerName = dto.ownerName.trim();
    const ownerPhone = dto.ownerPhone.trim();
    const slug = await this.generateUniqueSlug(shopName);
    // Admin.email majburiy va unique — Telegram sotuvchilar uchun sintetik email
    const syntheticEmail = `tg${parsed.user.id}@sellio.bot`;

    // Bot token (ixtiyoriy) — berilgan bo'lsa tekshiramiz va band emasligini ko'ramiz
    let botToken: string | null = null;
    let botUsername: string | null = null;
    if (dto.botToken?.trim()) {
      const check = await this.validateBotToken(dto.botToken);
      if (!check.ok) {
        throw new BadRequestException(check.error ?? "Bot token yaroqsiz");
      }
      botToken = dto.botToken.trim();
      botUsername = check.username ?? null;
      const taken = await this.prisma.tenant.findUnique({ where: { botToken } });
      if (taken) {
        throw new ConflictException('Bu bot token boshqa do\'konda ishlatilgan');
      }
    }

    // Referal — kim taklif qilgani. Manba: URL ?ref= YOKI bot saqlagan pending
    // (Telegram ID bo'yicha). O'zini taklif qila olmaydi.
    let referredById: string | null = null;
    const refCode = dto.ref || (await this.referral.consumePending(telegramId).catch(() => null));
    if (refCode) {
      const refId = await this.referral.resolveReferrer(refCode);
      if (refId) {
        const refOwner = await this.prisma.tenant.findUnique({
          where: { id: refId },
          select: { ownerTelegramId: true },
        });
        if (refOwner && refOwner.ownerTelegramId !== telegramId) referredById = refId;
      }
    }

    // Bir martalik model: pulli tarif tanlansa — do'kon PENDING_PAYMENT holatida
    // yaratiladi (faollashtirish to'lovigacha). FREE tarif darhol faollashadi.
    const isPaid = dto.tariffPlan !== 'FREE';

    const tenant = await this.prisma.$transaction(async (tx) => {
      const t = await tx.tenant.create({
        data: {
          slug,
          shopName,
          ownerName,
          ownerPhone,
          ownerTelegramId: telegramId,
          ownerUsername: parsed.user.username ?? null,
          logoUrl: dto.logoUrl?.trim() || null,
          tariffPlan: dto.tariffPlan,
          isActivated: !isPaid,
          status: isPaid ? 'PENDING_PAYMENT' : 'ACTIVE',
          botToken,
          botUsername,
          deviceId,
          referredById,
        },
      });

      // Parolsiz admin — faqat Telegram orqali login qiladi
      await tx.admin.create({
        data: {
          email: syntheticEmail,
          fullName: ownerName,
          role: 'ADMIN',
          isActive: true,
          telegramId,
          photoUrl: parsed.user.photo_url ?? null,
          tenantId: t.id,
        },
      });

      return t;
    });

    this.logger.log(
      `Seller onboard: ${shopName} (${slug}) · tg=${parsed.user.id} · ${dto.tariffPlan}${botUsername ? ` · @${botUsername}` : ''}`,
    );
    // Bot ulangan bo'lsa — webhook o'rnatamiz (mijoz bot orqali shu do'konni ochadi)
    if (botToken) {
      await this.tenantBot.configure(tenant.id).catch(() => undefined);
    }
    return { registered: true, tenant: this.serialize(tenant) };
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/gi, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 40)
      .replace(/^-|-$/g, '');

    const safeBase = base || 'shop';
    let slug = safeBase;
    let attempt = 1;

    while (await this.prisma.tenant.findUnique({ where: { slug } })) {
      attempt += 1;
      slug = `${safeBase}-${attempt}`;
      if (attempt > 50) {
        slug = `${safeBase}-${randomBytes(3).toString('hex')}`;
        break;
      }
    }
    return slug;
  }
}
