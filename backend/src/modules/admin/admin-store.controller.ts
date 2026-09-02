import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseFilePipeBuilder,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { IsArray, IsBoolean, IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { randomBytes } from 'crypto';
import { AdminRole, TariffPlan, type Admin } from '@prisma/client';
import { InlineKeyboard } from 'grammy';
import { PrismaService } from '@/prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { CatalogService } from '../catalog/catalog.service';
import { checkBotToken } from '@/common/helpers/telegram-bot-token';
import { limitsFor, hasFeature } from '@/common/tariff';
import { BOSS_ROLES } from '@/common/role-groups';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { CurrentAdmin, Roles, RolesGuard } from '../admin-auth/roles.guard';
import { TelegramBotService } from '../telegram-bot/telegram-bot.service';
import { TenantBotService } from '../telegram-bot/tenant-bot.service';
import { TenantScopeService } from '@/common/tenant-scope/tenant-scope.service';
import { PAYMENT_INFO } from '../public/payment-info';
import { buildPaymentCaption } from '../public/payment-caption';
import { ReferralService } from '../referral/referral.service';

/** Tarif jamoa limiti to'lganda ko'rsatiladigan xabar (rol + limit bo'yicha). */
function teamLimitMessage(role: AdminRole, limit: number): string {
  const label = role === AdminRole.MODERATOR ? 'moderator' : 'menejer';
  if (limit === 0) {
    return "Joriy tarifda jamoaga a'zo qo'shib bo'lmaydi. Ko'proq imkoniyat uchun tarifni yangilang.";
  }
  return `Joriy tarifda ${limit} ta ${label} qo'shish mumkin (limit to'ldi). Ko'proq uchun tarifni yangilang.`;
}

class BotTokenDto {
  @IsString()
  @MaxLength(100)
  botToken!: string;
}

class UpgradeDto {
  @IsEnum(TariffPlan)
  tariffPlan!: TariffPlan;
  @IsOptional() @IsIn(['monthly', 'yearly']) billingPeriod?: 'monthly' | 'yearly';
  // Referal balansni shu to'lovga ishlatish (to'liq qoplasa — darrov faollashadi)
  @IsOptional() @IsBoolean() useBalance?: boolean;
}

class StoreInfoDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(40)  phone?: string;
  @IsOptional() @IsString() @MaxLength(120) workingHours?: string;
  @IsOptional() @IsString() @MaxLength(2000) about?: string;
}

class BrandingDto {
  @IsOptional() @IsString() @MaxLength(20) primaryColor?: string;
  @IsOptional() @IsString() @MaxLength(500) logoUrl?: string;
  // Storefront foni — rang (#RRGGBB) yoki rasm URL. Bo'sh string = standartga qaytarish.
  @IsOptional() @IsString() @MaxLength(20) backgroundColor?: string;
  @IsOptional() @IsString() @MaxLength(500) backgroundImageUrl?: string;
}

class SupportDto {
  @IsString() @MaxLength(2000) message!: string;
}

class CardPaymentDto {
  @IsOptional() @IsString() @MaxLength(40)  cardNumber?: string;
  @IsOptional() @IsString() @MaxLength(120) cardHolder?: string;
  @IsOptional() @IsString() @MaxLength(60)  channelId?: string;
}

class NewStoreDto {
  @IsString() @MaxLength(120) shopName!: string;
  @IsOptional() @IsString() @MaxLength(500) logoUrl?: string;
  @IsOptional() @IsString() @MaxLength(100) botToken?: string;
}

class TeamMemberDto {
  @IsString() @MaxLength(20) telegramId!: string;
  @IsString() @MaxLength(80) fullName!: string;
  @IsEnum(AdminRole) role!: AdminRole;
  // Telegramdan avto-olingan profil rasmi (lookup endpointi qaytargan /uploads/ URL)
  @IsOptional() @IsString() @MaxLength(500) photoUrl?: string;
}

class TeamRoleDto {
  @IsEnum(AdminRole) role!: AdminRole;
}

class ReviewsDto {
  // Otziv kanali @username yoki -100... ID (bo'sh string = kanalni uzish)
  @IsOptional() @IsString() @MaxLength(60) channelId?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}

class OrdersChannelDto {
  // Buyurtmalar kanali: @username yoki -100... ID (bo'sh string = uzish)
  @IsOptional() @IsString() @MaxLength(60) channelId?: string;
}

class MarketingSaleDto {
  @IsString() serviceId!: string;
  @IsString() countryId!: string;
  // Kanalda faqat maskalangan ko'rinishi chiqadi (oxirgi 4 raqam yashiriladi)
  @IsString() @MaxLength(20) phone!: string;
}

class ChannelsDto {
  @IsOptional() @IsString() @MaxLength(200) mainChannelUrl?: string;
  @IsOptional() @IsString() @MaxLength(200) reviewChannelUrl?: string;
  @IsOptional() @IsString() @MaxLength(200) adminContactUrl?: string;
  @IsOptional() @IsBoolean() forcedSubEnabled?: boolean;
  // [{ username: "@kanal", title: "Nom" }]
  @IsOptional() @IsArray() forcedSubChannels?: Array<{ username?: string; title?: string }>;
}

class PaymentsDto {
  @IsOptional() @IsString() @MaxLength(100) paymeMerchantId?: string;
  @IsOptional() @IsString() @MaxLength(200) paymeKey?: string;
  @IsOptional() @IsString() @MaxLength(100) clickServiceId?: string;
  @IsOptional() @IsString() @MaxLength(100) clickMerchantId?: string;
  @IsOptional() @IsString() @MaxLength(100) clickMerchantUserId?: string;
  @IsOptional() @IsString() @MaxLength(200) clickSecretKey?: string;
}

/** Joriy admin o'z do'koni (tenant): bot token, tarif, limit, yangilash. */
@Controller('admin/store')
@UseGuards(AdminJwtGuard, RolesGuard)
export class AdminStoreController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tgbot: TelegramBotService,
    private readonly tenantBot: TenantBotService,
    private readonly tenantScope: TenantScopeService,
    private readonly uploads: UploadsService,
    private readonly referral: ReferralService,
    private readonly catalog: CatalogService,
  ) {}

  /**
   * Bot profil rasmini Telegram'dan olib, uploads'ga saqlaydi va tenant.botPhotoUrl
   * ga yozadi. Eng yaxshi harakat — rasm bo'lmasa/xato bo'lsa null qoldiradi.
   */
  private async refreshBotPhoto(tenantId: string, token: string): Promise<void> {
    try {
      const api = `https://api.telegram.org/bot${token}`;
      const me = (await fetch(`${api}/getMe`).then((r) => r.json())) as { result?: { id?: number } };
      const botId = me?.result?.id;
      if (!botId) return;
      const ph = (await fetch(`${api}/getUserProfilePhotos?user_id=${botId}&limit=1`).then((r) =>
        r.json(),
      )) as { result?: { photos?: Array<Array<{ file_id: string }>> } };
      const sizes = ph?.result?.photos?.[0];
      if (!sizes?.length) {
        await this.prisma.tenant.update({ where: { id: tenantId }, data: { botPhotoUrl: null } }).catch(() => undefined);
        return;
      }
      const fileId = sizes[sizes.length - 1].file_id; // eng katta o'lcham
      const f = (await fetch(`${api}/getFile?file_id=${fileId}`).then((r) => r.json())) as {
        result?: { file_path?: string };
      };
      const path = f?.result?.file_path;
      if (!path) return;
      const ab = await fetch(`https://api.telegram.org/file/bot${token}/${path}`).then((r) => r.arrayBuffer());
      const saved = await this.uploads.saveImage(Buffer.from(new Uint8Array(ab)));
      await this.prisma.tenant.update({ where: { id: tenantId }, data: { botPhotoUrl: saved.url } });
    } catch {
      // jim — rasm ko'rsatilmaydi, ikon qoladi
    }
  }

  @Get()
  async myStore(@CurrentAdmin() admin: Admin) {
    if (!admin.tenantId) return { tenant: null };
    const t = await this.prisma.tenant.findUnique({ where: { id: admin.tenantId } });
    if (!t) return { tenant: null };

    // Bot rasmi hali olinmagan bo'lsa — fon rejimida olib qo'yamiz (keyingi yuklashda ko'rinadi)
    if (t.botToken && !t.botPhotoUrl) {
      void this.refreshBotPhoto(t.id, t.botToken);
    }

    const limits = limitsFor(t.tariffPlan);
    // Faqat shu sotuvchiga tegishli (o'z do'koni) sonlar
    const [offers, banners, customers] = await Promise.all([
      this.prisma.resellerOffer.count({ where: { tenantId: t.id, isActive: true } }),
      this.prisma.banner.count({ where: { tenantId: t.id } }),
      this.prisma.numberOrder
        .findMany({ where: { tenantId: t.id }, distinct: ['userId'], select: { userId: true } })
        .then((r) => r.length),
    ]);

    return {
      tenant: {
        id: t.id,
        shopName: t.shopName,
        slug: t.slug,
        logoUrl: t.logoUrl,
        primaryColor: t.primaryColor,
        backgroundColor: t.backgroundColor,
        backgroundImageUrl: t.backgroundImageUrl,
        tariffPlan: t.tariffPlan,
        botUsername: t.botUsername,
        botPhotoUrl: t.botPhotoUrl,
        hasBotToken: !!t.botToken,
        channelId: t.channelId,
        phone: t.ownerPhone,
        workingHours: t.workingHours,
        about: t.about,
        customersCount: customers,
        payme: {
          merchantId: t.paymeMerchantId ?? '',
          hasKey: !!t.paymeKey,
        },
        click: {
          serviceId: t.clickServiceId ?? '',
          merchantId: t.clickMerchantId ?? '',
          merchantUserId: t.clickMerchantUserId ?? '',
          hasSecret: !!t.clickSecretKey,
        },
        cardPayment: {
          cardNumber: t.manualCardNumber ?? '',
          cardHolder: t.manualCardHolder ?? '',
          channelId: t.manualPaymentChannelId ?? '',
        },
        reviews: {
          channelId: t.reviewsChannelId ?? '',
          enabled: t.reviewsEnabled,
        },
        // Buyurtmalar kanali — bo'sh bo'lsa kartochka hech qayerga tushmaydi.
        ordersChannel: {
          channelId: t.ordersChannelId ?? '',
        },
        channels: {
          mainChannelUrl: t.mainChannelUrl ?? '',
          reviewChannelUrl: t.reviewChannelUrl ?? '',
          adminContactUrl: t.adminContactUrl ?? '',
          forcedSubEnabled: t.forcedSubEnabled,
          forcedSubChannels: Array.isArray(t.forcedSubChannels)
            ? (t.forcedSubChannels as Array<{ username?: string; title?: string }>)
            : [],
        },
        // Stars/Premium sotuvi yoqilganmi — "Stars / Premium" sahifasi
        // tugmalarning boshlang'ich holatini shundan oladi.
        starsEnabled: t.starsEnabled,
        premiumEnabled: t.premiumEnabled,
        // Free sinov holati (10 kun) — UI banner + blok uchun.
        trial: await this.catalog.freeTrialByTenantId(t.id),
      },
      limits,
      usage: { offers, banners },
    };
  }

  /**
   * Foydalanuvchi kira oladigan barcha do'konlar (egasi yoki xodimi bo'lgan) +
   * yangi do'kon ochish mumkinmi (faqat o'zi egasi bo'lgan do'konlar bo'yicha).
   */
  @Get('my-stores')
  async myStores(@CurrentAdmin() admin: Admin) {
    if (!admin.telegramId) {
      return { stores: [], current: admin.tenantId, canAdd: false, allowed: 1 };
    }
    // Foydalanuvchining barcha admin yozuvlari → kira oladigan do'konlari
    const rows = await this.prisma.admin.findMany({
      where: { telegramId: admin.telegramId, isActive: true, tenantId: { not: null } },
      orderBy: { createdAt: 'asc' },
      select: { role: true, tenant: { select: { id: true, shopName: true, slug: true, tariffPlan: true, logoUrl: true, ownerTelegramId: true } } },
    });
    const allStores = rows
      .filter((r) => r.tenant)
      .map((r) => ({
        id: r.tenant!.id,
        shopName: r.tenant!.shopName,
        slug: r.tenant!.slug,
        tariffPlan: r.tenant!.tariffPlan,
        logoUrl: r.tenant!.logoUrl,
        role: r.role,
        isOwner: r.tenant!.ownerTelegramId === admin.telegramId,
        isCurrent: r.tenant!.id === admin.tenantId,
      }));
    // Rejim = joriy yozuv roli: switcher faqat shu rejimdagi do'konlarni ko'rsatadi.
    // - MODERATOR→ moderator bo'lgan do'konlar
    // - boshqa (egasi/boss/manager) → o'z do'konlari (egasi yoki ADMIN/SUPERADMIN/MANAGER)
    const stores =
      admin.role === AdminRole.MODERATOR
        ? allStores.filter((s) => s.role === AdminRole.MODERATOR)
        : // start/owner rejimi: o'z do'konlari (egasi/boss/manager). `isCurrent` har doim
          // qo'shiladi — joriy do'kon hech qachon ro'yxatdan tushib qolmasin (bo'sh switcher).
          allStores.filter(
            (s) =>
              s.isCurrent ||
              s.isOwner ||
              s.role === AdminRole.ADMIN ||
              s.role === AdminRole.SUPERADMIN ||
              s.role === AdminRole.MANAGER,
          );
    // Yangi do'kon ochish — faqat o'zi EGASI bo'lgan do'konlar bo'yicha hisoblanadi
    // va faqat BOSS (egasi/super) roli yangi do'kon ocha oladi (POST /new gate'iga mos).
    const owned = stores.filter((s) => s.isOwner);
    const allowed = Math.max(1, ...owned.map((s) => limitsFor(s.tariffPlan).maxStores));
    const isBoss = admin.role === AdminRole.ADMIN || admin.role === AdminRole.SUPERADMIN;
    return {
      stores,
      current: admin.tenantId,
      canAdd: isBoss && owned.length < allowed,
      allowed,
    };
  }

  // ───── Jamoa (do'kon xodimlari: Boss / Creator / Moderator) ─────

  /** Joriy do'kon xodimlari ro'yxati. */
  @Get('team')
  @Roles(...BOSS_ROLES)
  async team(@CurrentAdmin() admin: Admin) {
    if (!admin.tenantId) throw new BadRequestException("Do'kon topilmadi");
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: admin.tenantId },
      select: { ownerTelegramId: true },
    });
    const members = await this.prisma.admin.findMany({
      where: { tenantId: admin.tenantId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, fullName: true, role: true, telegramId: true, isActive: true, photoUrl: true },
    });
    return members.map((m) => ({
      id: m.id,
      fullName: m.fullName,
      role: m.role,
      telegramId: m.telegramId ? m.telegramId.toString() : null,
      photoUrl: m.photoUrl,
      isActive: m.isActive,
      isOwner: !!tenant?.ownerTelegramId && m.telegramId === tenant.ownerTelegramId,
      isSelf: m.id === admin.id,
    }));
  }

  /**
   * Telegram ID bo'yicha xodim profilini (ism, username, rasm) topadi —
   * "Xodim qo'shish" formasida avto-to'ldirish uchun. Faqat global @bot
   * ushbu foydalanuvchini ko'rgan bo'lsa (u /id yozgan bo'lsa) topadi.
   * Rasm topilsa uploads'ga saqlanadi va URL qaytariladi.
   */
  @Get('team/lookup/:telegramId')
  @Roles(...BOSS_ROLES)
  async lookupMember(@CurrentAdmin() admin: Admin, @Param('telegramId') telegramId: string) {
    if (!admin.tenantId) throw new BadRequestException("Do'kon topilmadi");
    const tgId = (telegramId ?? '').trim();
    if (!/^\d{5,15}$/.test(tgId)) throw new BadRequestException("Telegram ID noto'g'ri (faqat raqam)");

    const profile = await this.tgbot.lookupUserProfile(BigInt(tgId)).catch(() => null);
    if (!profile?.found) {
      return { found: false, fullName: null, username: null, photoUrl: null };
    }
    const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() || null;
    let photoUrl: string | null = null;
    if (profile.photo) {
      try {
        const saved = await this.uploads.saveImage(profile.photo);
        photoUrl = saved.url;
      } catch {
        // rasm saqlanmasa — ism baribir qaytadi
      }
    }
    return { found: true, fullName, username: profile.username ?? null, photoUrl };
  }

  /** Xodim qo'shish — Telegram ID + ism + rol (CREATOR yoki MODERATOR). */
  @Post('team')
  @Roles(...BOSS_ROLES)
  @HttpCode(200)
  async addMember(@CurrentAdmin() admin: Admin, @Body() dto: TeamMemberDto) {
    if (!admin.tenantId) throw new BadRequestException("Do'kon topilmadi");
    const role = dto.role;
    if (role !== AdminRole.MANAGER && role !== AdminRole.MODERATOR) {
      throw new BadRequestException('Rol faqat MENEJER yoki MODERATOR bo\'lishi mumkin');
    }
    const tgId = (dto.telegramId ?? '').trim();
    if (!/^\d{5,15}$/.test(tgId)) throw new BadRequestException("Telegram ID noto'g'ri (faqat raqam)");
    const telegramId = BigInt(tgId);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: admin.tenantId },
      select: { slug: true, tariffPlan: true },
    });
    if (!tenant) throw new BadRequestException("Do'kon topilmadi");

    const exists = await this.prisma.admin.findFirst({
      where: { tenantId: admin.tenantId, telegramId },
    });
    if (exists) throw new ConflictException('Bu foydalanuvchi allaqachon jamoada');

    // Tarif bo'yicha jamoa limiti (rol bo'yicha alohida hisoblanadi)
    const limits = limitsFor(tenant.tariffPlan);
    const roleLimit = role === AdminRole.MODERATOR ? limits.maxModerators : limits.maxCreators;
    if (roleLimit !== -1) {
      const used = await this.prisma.admin.count({ where: { tenantId: admin.tenantId, role } });
      if (used >= roleLimit) {
        throw new BadRequestException(teamLimitMessage(role, roleLimit));
      }
    }

    // Profil rasmi — faqat o'zimiz yuklagan uploads URL qabul qilinadi (lookup qaytargan)
    const photoUrl = dto.photoUrl && /\/uploads\//.test(dto.photoUrl) ? dto.photoUrl : null;

    await this.prisma.admin.create({
      data: {
        email: `tg${tgId}.${tenant.slug}@sellio.bot`,
        fullName: dto.fullName.trim() || `Xodim ${tgId.slice(-4)}`,
        role,
        isActive: true,
        telegramId,
        tenantId: admin.tenantId,
        photoUrl,
      },
    });
    return { ok: true };
  }

  /** Xodim rolini o'zgartirish. */
  @Put('team/:id')
  @Roles(...BOSS_ROLES)
  @HttpCode(200)
  async updateMember(@CurrentAdmin() admin: Admin, @Param('id') id: string, @Body() dto: TeamRoleDto) {
    if (!admin.tenantId) throw new BadRequestException("Do'kon topilmadi");
    if (dto.role !== AdminRole.MANAGER && dto.role !== AdminRole.MODERATOR) {
      throw new BadRequestException('Rol faqat MENEJER yoki MODERATOR bo\'lishi mumkin');
    }
    const member = await this.prisma.admin.findFirst({ where: { id, tenantId: admin.tenantId } });
    if (!member) throw new BadRequestException('Xodim topilmadi');
    if (member.id === admin.id) throw new BadRequestException("O'z rolingizni o'zgartira olmaysiz");
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: admin.tenantId },
      select: { ownerTelegramId: true, tariffPlan: true },
    });
    if (tenant?.ownerTelegramId && member.telegramId === tenant.ownerTelegramId) {
      throw new BadRequestException("Do'kon egasining rolini o'zgartirib bo'lmaydi");
    }
    // Yangi rol bo'yicha tarif limiti (rol o'zgarganda)
    if (member.role !== dto.role) {
      const limits = limitsFor(tenant?.tariffPlan ?? 'FREE');
      const roleLimit = dto.role === AdminRole.MODERATOR ? limits.maxModerators : limits.maxCreators;
      if (roleLimit !== -1) {
        const used = await this.prisma.admin.count({
          where: { tenantId: admin.tenantId, role: dto.role, id: { not: id } },
        });
        if (used >= roleLimit) throw new BadRequestException(teamLimitMessage(dto.role, roleLimit));
      }
    }
    await this.prisma.admin.update({ where: { id }, data: { role: dto.role } });
    return { ok: true };
  }

  /** Xodimni jamoadan chiqarish. */
  @Delete('team/:id')
  @Roles(...BOSS_ROLES)
  @HttpCode(200)
  async removeMember(@CurrentAdmin() admin: Admin, @Param('id') id: string) {
    if (!admin.tenantId) throw new BadRequestException("Do'kon topilmadi");
    const member = await this.prisma.admin.findFirst({ where: { id, tenantId: admin.tenantId } });
    if (!member) throw new BadRequestException('Xodim topilmadi');
    if (member.id === admin.id) throw new BadRequestException("O'zingizni chiqara olmaysiz");
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: admin.tenantId },
      select: { ownerTelegramId: true },
    });
    if (tenant?.ownerTelegramId && member.telegramId === tenant.ownerTelegramId) {
      throw new BadRequestException("Do'kon egasini chiqarib bo'lmaydi");
    }
    await this.prisma.admin.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Yangi (qo'shimcha) do'kon ochish — bir egada bir nechta do'kon.
   * Eng yuqori tarif maxStores soniga qadar ruxsat (Premium = 2).
   * Yangi do'kon FREE tarifda ochiladi (keyin alohida yangilash mumkin).
   */
  @Post('new')
  @Roles(...BOSS_ROLES)
  @HttpCode(200)
  async createStore(@CurrentAdmin() admin: Admin, @Body() dto: NewStoreDto) {
    if (!admin.tenantId || !admin.telegramId) {
      throw new BadRequestException("Faqat Telegram orqali ro'yxatdan o'tgan sotuvchilar uchun");
    }
    const mine = await this.prisma.tenant.findMany({
      where: { ownerTelegramId: admin.telegramId },
    });
    const allowed = Math.max(1, ...mine.map((t) => limitsFor(t.tariffPlan).maxStores));
    if (mine.length >= allowed) {
      throw new ForbiddenException({
        message: `Joriy tarifda ${allowed} ta do'kon mumkin. Ko'proq do'kon uchun Premium tarifga o'ting.`,
        upgradeRequired: true,
      });
    }

    const shopName = dto.shopName.trim();
    if (shopName.length < 2) throw new BadRequestException("Do'kon nomi juda qisqa");
    const owner = mine.find((t) => t.id === admin.tenantId) ?? mine[0];

    let botToken: string | null = null;
    let botUsername: string | null = null;
    if (dto.botToken?.trim()) {
      const check = await checkBotToken(dto.botToken);
      if (!check.ok) throw new BadRequestException(check.error ?? 'Bot token yaroqsiz');
      botToken = dto.botToken.trim();
      botUsername = check.username ?? null;
      const taken = await this.prisma.tenant.findFirst({ where: { botToken } });
      if (taken) throw new ConflictException("Bu bot token boshqa do'konda ishlatilgan");
    }

    const slug = await this.uniqueSlug(shopName);
    const created = await this.prisma.$transaction(async (tx) => {
      const t = await tx.tenant.create({
        data: {
          slug,
          shopName,
          ownerName: owner.ownerName,
          ownerPhone: owner.ownerPhone,
          ownerTelegramId: admin.telegramId,
          ownerUsername: owner.ownerUsername,
          logoUrl: dto.logoUrl?.trim() || null,
          tariffPlan: 'FREE',
          botToken,
          botUsername,
          status: 'ACTIVE',
        },
      });
      await tx.admin.create({
        data: {
          email: `tg${admin.telegramId}.${slug}@sellio.bot`,
          fullName: owner.ownerName,
          role: 'ADMIN',
          isActive: true,
          telegramId: admin.telegramId,
          tenantId: t.id,
        },
      });
      return t;
    });

    if (botToken) await this.tenantBot.configure(created.id).catch(() => undefined);
    return { ok: true, tenantId: created.id };
  }

  /** Noyob slug yaratadi (do'kon nomidan). */
  private async uniqueSlug(name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/gi, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 40)
        .replace(/^-|-$/g, '') || 'shop';
    let slug = base;
    let attempt = 1;
    while (await this.prisma.tenant.findUnique({ where: { slug } })) {
      attempt += 1;
      slug = `${base}-${attempt}`;
      if (attempt > 50) {
        slug = `${base}-${randomBytes(3).toString('hex')}`;
        break;
      }
    }
    return slug;
  }

  /** Do'kon ma'lumotlari (nomi, telefon, manzil, ish vaqti, biz haqimizda). */
  @Put('info')
  @Roles(...BOSS_ROLES)
  @HttpCode(200)
  async updateInfo(@CurrentAdmin() admin: Admin, @Body() dto: StoreInfoDto) {
    if (!admin.tenantId) throw new BadRequestException("Do'kon topilmadi");
    const data: Record<string, string | null> = {};
    if (dto.name !== undefined) data.shopName = dto.name.trim();
    if (dto.phone !== undefined) data.ownerPhone = dto.phone.trim() || null;
    if (dto.workingHours !== undefined) data.workingHours = dto.workingHours.trim() || null;
    if (dto.about !== undefined) data.about = dto.about.trim() || null;
    if (data.shopName === '') throw new BadRequestException("Do'kon nomi bo'sh bo'lmasin");
    const updated = await this.prisma.tenant.update({
      where: { id: admin.tenantId },
      data,
      select: { slug: true },
    });
    this.tenantScope.invalidate(updated.slug);
    return { ok: true };
  }

  /** Brending — maxsus rang va logo (Standart+ tariflarda). */
  @Put('branding')
  @Roles(...BOSS_ROLES)
  @HttpCode(200)
  async updateBranding(@CurrentAdmin() admin: Admin, @Body() dto: BrandingDto) {
    if (!admin.tenantId) throw new BadRequestException("Do'kon topilmadi");
    const t = await this.prisma.tenant.findUnique({
      where: { id: admin.tenantId },
      select: { tariffPlan: true },
    });
    if (!hasFeature(t?.tariffPlan ?? 'FREE', 'branding')) {
      throw new ForbiddenException({
        message: 'Maxsus brending Standart+ tariflarda mavjud. Tarifni yangilang.',
        upgradeRequired: true,
      });
    }
    const data: Record<string, string | null> = {};
    if (dto.primaryColor !== undefined) {
      const c = dto.primaryColor.trim();
      if (c && !/^#[0-9a-fA-F]{6}$/.test(c)) throw new BadRequestException("Rang #RRGGBB formatida bo'lsin");
      data.primaryColor = c || null;
    }
    if (dto.logoUrl !== undefined) data.logoUrl = dto.logoUrl.trim() || null;
    // Fon rangi — bo'sh string standartga qaytaradi (null)
    if (dto.backgroundColor !== undefined) {
      const bg = dto.backgroundColor.trim();
      if (bg && !/^#[0-9a-fA-F]{6}$/.test(bg)) throw new BadRequestException("Fon rangi #RRGGBB formatida bo'lsin");
      data.backgroundColor = bg || null;
    }
    // Fon rasmi — bo'sh string standartga qaytaradi (null)
    if (dto.backgroundImageUrl !== undefined) data.backgroundImageUrl = dto.backgroundImageUrl.trim() || null;
    const updated = await this.prisma.tenant.update({
      where: { id: admin.tenantId },
      data,
      select: { slug: true },
    });
    // Storefront fon/rang darhol yangilanishi uchun tenant cache'ini tozalaymiz
    this.tenantScope.invalidate(updated.slug);
    return { ok: true };
  }

  /**
   * Qo'llab-quvvatlash — sotuvchi platformaga yordam so'rovi yuboradi.
   * Standart+ tariflarda so'rov "ustuvor" (priority) belgisi bilan boradi,
   * shunda qo'llab-quvvatlash jamoasi birinchi navbatda javob beradi.
   */
  @Post('support')
  @HttpCode(200)
  async sendSupport(@CurrentAdmin() admin: Admin, @Body() dto: SupportDto) {
    if (!admin.tenantId) throw new BadRequestException("Do'kon topilmadi");
    const msg = (dto.message ?? '').trim();
    if (msg.length < 5) throw new BadRequestException("Xabar juda qisqa (kamida 5 ta belgi)");

    const t = await this.prisma.tenant.findUnique({ where: { id: admin.tenantId } });
    if (!t) throw new BadRequestException("Do'kon topilmadi");

    const priority = hasFeature(t.tariffPlan, 'prioritySupport');
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const ownerName = t.ownerName || '—';
    const header = priority ? '🔴 <b>USTUVOR QO\'LLAB-QUVVATLASH</b>' : '🆘 <b>Qo\'llab-quvvatlash so\'rovi</b>';

    const caption =
      `${header}\n\n` +
      `🏪 Do'kon: <b>${esc(t.shopName)}</b> (${esc(t.slug)})\n` +
      `📦 Tarif: <b>${t.tariffPlan}</b>${priority ? ' ⭐' : ''}\n` +
      `👤 Egasi: ${esc(ownerName)}\n` +
      `📞 Telefon: ${esc(t.ownerPhone ?? '—')}\n` +
      `🆔 TG ID: <code>${t.ownerTelegramId ?? '—'}</code>\n` +
      (t.ownerUsername ? `🔗 @${esc(t.ownerUsername)}\n` : '') +
      (t.botUsername ? `🤖 Bot: @${esc(t.botUsername)}\n` : '') +
      `\n💬 <b>Xabar:</b>\n${esc(msg)}`;

    // Egasiga to'g'ridan-to'g'ri yozish uchun tugma (TG ID bo'lsa)
    const kb = t.ownerTelegramId
      ? new InlineKeyboard().url('✍️ Javob berish', `tg://user?id=${t.ownerTelegramId}`)
      : undefined;
    await this.tgbot.sendToSupportChat(caption, kb);
    return { ok: true, priority };
  }

  /** Onlayn to'lov (Payme/Click) merchant ma'lumotlari — Standart+ tariflarda. */
  @Put('payments')
  @Roles(...BOSS_ROLES)
  @HttpCode(200)
  async updatePayments(@CurrentAdmin() admin: Admin, @Body() dto: PaymentsDto) {
    if (!admin.tenantId) throw new BadRequestException("Do'kon topilmadi");
    const t = await this.prisma.tenant.findUnique({
      where: { id: admin.tenantId },
      select: { tariffPlan: true },
    });
    if (!hasFeature(t?.tariffPlan ?? 'FREE', 'onlinePayment')) {
      throw new ForbiddenException({
        message: "Onlayn to'lov Standart+ tariflarda mavjud. Tarifni yangilang.",
        upgradeRequired: true,
      });
    }
    const data: Record<string, string | null> = {};
    if (dto.paymeMerchantId !== undefined) data.paymeMerchantId = dto.paymeMerchantId.trim() || null;
    if (dto.paymeKey) data.paymeKey = dto.paymeKey.trim(); // faqat berilsa yangilanadi
    if (dto.clickServiceId !== undefined) data.clickServiceId = dto.clickServiceId.trim() || null;
    if (dto.clickMerchantId !== undefined) data.clickMerchantId = dto.clickMerchantId.trim() || null;
    if (dto.clickMerchantUserId !== undefined)
      data.clickMerchantUserId = dto.clickMerchantUserId.trim() || null;
    if (dto.clickSecretKey) data.clickSecretKey = dto.clickSecretKey.trim();
    await this.prisma.tenant.update({ where: { id: admin.tenantId }, data });
    return { ok: true };
  }

  /**
   * Karta o'tkazma to'lovi — karta raqami, egasi (ism familiya) va tasdiqlash kanali.
   * Mijoz chek yuklaganda chek shu kanalga boradi, sotuvchi tugma bilan tasdiqlaydi.
   * Barcha tariflarda mavjud (qo'lda o'tkazma).
   */
  @Put('card-payment')
  @Roles(...BOSS_ROLES)
  @HttpCode(200)
  async updateCardPayment(@CurrentAdmin() admin: Admin, @Body() dto: CardPaymentDto) {
    if (!admin.tenantId) throw new BadRequestException("Do'kon topilmadi");
    const data: Record<string, string | null> = {};
    if (dto.cardNumber !== undefined) {
      const digits = dto.cardNumber.replace(/\s/g, '');
      if (digits && !/^\d{12,19}$/.test(digits)) {
        throw new BadRequestException('Karta raqami noto\'g\'ri (12–19 raqam)');
      }
      // Chiroyli ko'rinish uchun 4 xonalik guruhlarga ajratamiz
      data.manualCardNumber = digits ? digits.replace(/(.{4})/g, '$1 ').trim() : null;
    }
    if (dto.cardHolder !== undefined) data.manualCardHolder = dto.cardHolder.trim() || null;
    if (dto.channelId !== undefined) {
      const ch = dto.channelId.trim();
      // -100… (kanal id) yoki @username formatlari qabul qilinadi
      if (ch && !/^(-100\d{6,}|@[A-Za-z]\w{3,})$/.test(ch)) {
        throw new BadRequestException("Kanal ID '-100...' yoki '@kanal' ko'rinishida bo'lsin");
      }
      data.manualPaymentChannelId = ch || null;
    }
    await this.prisma.tenant.update({ where: { id: admin.tenantId }, data });
    return { ok: true };
  }

  /**
   * Otziv kanali — har sotuv avtomatik ijtimoiy isbot ("sotuv e'loni") sifatida
   * shu ochiq Telegram kanaliga joylanadi. Bot (global yoki do'kon) kanalga admin
   * bo'lishi kerak. Barcha tariflarda mavjud.
   */
  /** Otziv kanali jonli ma'lumoti (rasm, obunachilar) — @Vega_uzbot orqali. */
  @Get('reviews/channel-info')
  @Roles(...BOSS_ROLES)
  reviewChannelInfo(@CurrentAdmin() admin: Admin) {
    if (!admin.tenantId) throw new BadRequestException("Do'kon topilmadi");
    return this.tenantBot.getReviewChannelInfo(admin.tenantId);
  }

  /** To'lov tasdiqlash kanali jonli ma'lumoti (rasm, obunachilar) — o'z boti orqali. */
  @Get('payment-channel-info')
  @Roles(...BOSS_ROLES)
  paymentChannelInfo(@CurrentAdmin() admin: Admin) {
    if (!admin.tenantId) throw new BadRequestException("Do'kon topilmadi");
    return this.tenantBot.getPaymentChannelInfo(admin.tenantId);
  }

  @Put('reviews')
  @Roles(...BOSS_ROLES)
  @HttpCode(200)
  async updateReviews(@CurrentAdmin() admin: Admin, @Body() dto: ReviewsDto) {
    if (!admin.tenantId) throw new BadRequestException("Do'kon topilmadi");
    const data: { reviewsChannelId?: string | null; reviewsEnabled?: boolean } = {};
    if (dto.channelId !== undefined) {
      const ch = dto.channelId.trim();
      // -100… (kanal id) yoki @username formatlari qabul qilinadi; bo'sh = uzish
      if (ch && !/^(-100\d{6,}|@[A-Za-z]\w{3,})$/.test(ch)) {
        throw new BadRequestException("Kanal ID '-100...' yoki '@kanal' ko'rinishida bo'lsin");
      }
      data.reviewsChannelId = ch || null;
    }
    if (dto.enabled !== undefined) data.reviewsEnabled = dto.enabled;

    // Kanal yoqilган holatда bo'lsa — bot o'sha kanalда ADMIN ekanini tekshiramiz.
    // (Aks holda otziv jim ishlamaydi.)
    const t = await this.prisma.tenant.findUnique({
      where: { id: admin.tenantId },
      select: { botToken: true, reviewsEnabled: true, reviewsChannelId: true },
    });
    const finalChannel =
      data.reviewsChannelId !== undefined ? data.reviewsChannelId : t?.reviewsChannelId;
    const finalEnabled =
      data.reviewsEnabled !== undefined ? data.reviewsEnabled : (t?.reviewsEnabled ?? false);
    if (finalEnabled && finalChannel) {
      const v = await this.tenantBot.verifyChannelBotAdmin(finalChannel);
      if (!v.ok) {
        throw new BadRequestException(
          "@Vega_uzbot kanalda ADMIN emas. Uni kanalingizga admin qiling — \"Post messages\" huquqi bilan, so'ng qayta saqlang.",
        );
      }
    }

    await this.prisma.tenant.update({ where: { id: admin.tenantId }, data });
    return { ok: true };
  }

  /**
   * Buyurtmalar kanali — yangi buyurtma kartochkasi shu kanalga tushadi.
   * Sozlanmagan bo'lsa hech qayerga yuborilmaydi (opt-in). Ilgari barcha
   * do'kon buyurtmalari bitta GLOBAL kanalga tushib, do'konlar bir-birining
   * buyurtmalarini ko'rardi.
   */
  @Put('orders-channel')
  @Roles(...BOSS_ROLES)
  @HttpCode(200)
  async updateOrdersChannel(@CurrentAdmin() admin: Admin, @Body() dto: OrdersChannelDto) {
    if (!admin.tenantId) throw new BadRequestException("Do'kon topilmadi");
    if (dto.channelId === undefined) return { ok: true };

    const ch = dto.channelId.trim();
    if (ch && !/^(-100\d{6,}|@[A-Za-z]\w{3,})$/.test(ch)) {
      throw new BadRequestException("Kanal ID '-100...' yoki '@kanal' ko'rinishida bo'lsin");
    }
    // Kanal berilgan bo'lsa — bot o'sha kanalda ADMIN ekanini tekshiramiz,
    // aks holda buyurtmalar jimgina yo'qolib ketardi.
    if (ch) {
      const v = await this.tenantBot.verifyChannelBotAdmin(ch);
      if (!v.ok) {
        throw new BadRequestException(
          "@Vega_uzbot kanalda ADMIN emas. Uni kanalingizga admin qiling — \"Post messages\" huquqi bilan, so'ng qayta saqlang.",
        );
      }
    }
    await this.prisma.tenant.update({
      where: { id: admin.tenantId },
      data: { ordersChannelId: ch || null },
    });
    return { ok: true };
  }

  /**
   * Kanal uchun QO'LDA sotuv e'loni (marketing).
   *
   * Sotuvchi faqat raqamni yozadi — narx do'konning O'Z taklifidan (retail)
   * avtomatik olinadi, xaridor esa ANONIM qoladi: e'londa raqam maskalanadi
   * (oxirgi 4 raqam yashirin), xaridor ismi/tugmasi umuman ko'rsatilmaydi.
   *
   * DIQQAT: bu haqiqiy buyurtma YARATMAYDI — hamyon, foyda va haqiqiy
   * statistikaga (totalOrders) tegmaydi, aks holda moliyaviy hisobot
   * buzilardi. Faqat kanaldagi ijtimoiy-isbot hisoblagichi
   * (channelSalesBonus) bittaga oshadi, shunda e'lonlar ketma-ket
   * joylanganda "Bugungacha 1, 2, 3…" bo'lib o'sib boradi.
   */
  @Post('marketing-sale')
  @Roles(...BOSS_ROLES)
  @HttpCode(200)
  async marketingSale(@CurrentAdmin() admin: Admin, @Body() dto: MarketingSaleDto) {
    if (!admin.tenantId) throw new BadRequestException("Do'kon topilmadi");

    const phone = dto.phone.trim();
    if (!/^\+?\d{7,18}$/.test(phone)) {
      throw new BadRequestException("Raqam noto'g'ri. Masalan: +998901234567");
    }

    // Narx do'konning o'z taklifidan olinadi — qo'lda kiritilmaydi.
    const offer = await this.prisma.resellerOffer.findFirst({
      where: {
        tenantId: admin.tenantId,
        serviceId: dto.serviceId,
        countryId: dto.countryId,
        isActive: true,
      },
      include: { service: true, country: true },
    });
    if (!offer) {
      throw new BadRequestException(
        "Bu yo'nalish sizda yo'q. Avval 'Narxlar' bo'limida qo'shing.",
      );
    }

    const t = await this.prisma.tenant.findUnique({
      where: { id: admin.tenantId },
      select: { reviewsChannelId: true, reviewsEnabled: true },
    });
    if (!t?.reviewsChannelId || !t.reviewsEnabled) {
      throw new BadRequestException(
        "Avval 'Sotuv e'lonlari' kanalini ulang va yoqing.",
      );
    }

    // Hisoblagichni e'londAN OLDIN oshiramiz — post yangi qiymatni ko'rsatsin
    // (aks holda birinchi e'lon "0 ta sotuv" deb chiqardi).
    await this.prisma.tenant.update({
      where: { id: admin.tenantId },
      data: { channelSalesBonus: { increment: 1 } },
    });

    await this.tenantBot.sendSaleReview(admin.tenantId, {
      type: 'NUMBER',
      orderNumber: '',
      price: Number(offer.retailPrice),
      phone,
      serviceName: offer.service.nameUz,
      serviceEmoji: offer.service.emoji,
      countryName: offer.country.nameUz,
      countryFlag: offer.country.flag,
      // buyerUsername / buyerTelegramId BERILMAYDI -> xaridor tugmasi
      // chiqmaydi, ya'ni egasi anonim qoladi.
    });

    return { ok: true, price: Number(offer.retailPrice) };
  }

  /**
   * Kanallar + majburiy obuna sozlamalari.
   *  • mainChannelUrl / reviewChannelUrl / adminContactUrl — "Biz haqimizda" havolalari.
   *  • forcedSubEnabled + forcedSubChannels — START'da majburiy obuna.
   *    @Vega_uzbot har kanalda ADMIN bo'lishi shart (a'zolikni tekshirish uchun).
   */
  @Put('channels')
  @Roles(...BOSS_ROLES)
  @HttpCode(200)
  async updateChannels(@CurrentAdmin() admin: Admin, @Body() dto: ChannelsDto) {
    if (!admin.tenantId) throw new BadRequestException("Do'kon topilmadi");
    const clean = (u?: string) => {
      const s = (u ?? '').trim();
      return s || null;
    };
    const data: Record<string, unknown> = {};
    if (dto.mainChannelUrl !== undefined) data.mainChannelUrl = clean(dto.mainChannelUrl);
    if (dto.reviewChannelUrl !== undefined) data.reviewChannelUrl = clean(dto.reviewChannelUrl);
    if (dto.adminContactUrl !== undefined) data.adminContactUrl = clean(dto.adminContactUrl);
    if (dto.forcedSubEnabled !== undefined) data.forcedSubEnabled = dto.forcedSubEnabled;

    let normChannels: Array<{ username: string; title: string }> | undefined;
    if (dto.forcedSubChannels !== undefined) {
      normChannels = (dto.forcedSubChannels ?? [])
        .map((c) => {
          let u = String(c.username ?? '').trim();
          u = u.replace(/^https?:\/\/t\.me\//i, '').replace(/^@/, '');
          return { username: u ? '@' + u : '', title: String(c.title ?? '').trim() };
        })
        .filter((c) => c.username);
      for (const c of normChannels) {
        if (!/^@[A-Za-z]\w{3,}$/.test(c.username)) {
          throw new BadRequestException(
            `Kanal '@username' ko'rinishida bo'lsin: ${c.username}`,
          );
        }
      }
      data.forcedSubChannels = normChannels;
    }

    // Majburiy obuna YOQILADIGAN bo'lsa — @Vega_uzbot har kanalda ADMIN ekanini tekshiramiz.
    const t = await this.prisma.tenant.findUnique({
      where: { id: admin.tenantId },
      select: { forcedSubEnabled: true, forcedSubChannels: true },
    });
    const finalEnabled =
      dto.forcedSubEnabled !== undefined ? dto.forcedSubEnabled : (t?.forcedSubEnabled ?? false);
    const finalChannels =
      normChannels ??
      (Array.isArray(t?.forcedSubChannels)
        ? (t!.forcedSubChannels as Array<{ username: string }>)
        : []);
    if (finalEnabled) {
      if (!finalChannels.length) {
        throw new BadRequestException("Majburiy obuna uchun kamida bitta kanal qo'shing");
      }
      for (const c of finalChannels) {
        const v = await this.tenantBot.verifyChannelBotAdmin(c.username);
        if (!v.ok) {
          throw new BadRequestException(
            `@Vega_uzbot "${c.username}" kanalida ADMIN emas. Uni admin qiling, so'ng saqlang.`,
          );
        }
      }
    }

    await this.prisma.tenant.update({ where: { id: admin.tenantId }, data });
    return { ok: true };
  }

  @Put('bot')
  @Roles(...BOSS_ROLES)
  @HttpCode(200)
  async setBot(@CurrentAdmin() admin: Admin, @Body() dto: BotTokenDto) {
    if (!admin.tenantId) throw new BadRequestException("Do'kon topilmadi");
    const check = await checkBotToken(dto.botToken);
    if (!check.ok) throw new BadRequestException(check.error ?? 'Token yaroqsiz');
    const token = dto.botToken.trim();
    const taken = await this.prisma.tenant.findFirst({
      where: { botToken: token, NOT: { id: admin.tenantId } },
    });
    if (taken) throw new ConflictException("Bu token boshqa do'konda ishlatilgan");

    // Eski tokenni saqlab qo'yamiz — yangisi muvaffaqiyatli ulanguncha
    // eski botning webhook'ini buzmaymiz. Yangi token o'rnatilgach,
    // eski bot webhook'ini o'chiramiz: aks holda eski bot yana
    // bizga update yuborishi mumkin (orphan webhook).
    const prev = await this.prisma.tenant.findUnique({
      where: { id: admin.tenantId },
      select: { botToken: true },
    });
    const oldToken = prev?.botToken;

    const updated = await this.prisma.tenant.update({
      where: { id: admin.tenantId },
      data: { botToken: token, botUsername: check.username ?? null },
      select: { slug: true },
    });
    this.tenantScope.invalidate(updated.slug);
    await this.tenantBot.configure(admin.tenantId).catch(() => undefined);
    // Bot profil rasmini olib qo'yamiz (best-effort)
    await this.refreshBotPhoto(admin.tenantId, token).catch(() => undefined);

    if (oldToken && oldToken !== token) {
      await this.tenantBot.deleteWebhookForToken(oldToken).catch(() => undefined);
    }
    return { ok: true, username: check.username };
  }

  @Delete('bot')
  @Roles(...BOSS_ROLES)
  @HttpCode(200)
  async removeBot(@CurrentAdmin() admin: Admin) {
    if (!admin.tenantId) throw new BadRequestException("Do'kon topilmadi");
    const prev = await this.prisma.tenant.findUnique({
      where: { id: admin.tenantId },
      select: { botToken: true },
    });
    const updated = await this.prisma.tenant.update({
      where: { id: admin.tenantId },
      data: { botToken: null, botUsername: null, botPhotoUrl: null },
      select: { slug: true },
    });
    this.tenantScope.invalidate(updated.slug);
    this.tenantBot.forget(admin.tenantId);
    if (prev?.botToken) {
      await this.tenantBot.deleteWebhookForToken(prev.botToken).catch(() => undefined);
    }
    return { ok: true };
  }

  /** Tarifni yangilash so'rovi — pendingTariff o'rnatadi, to'lov ma'lumotini qaytaradi. */
  @Post('upgrade')
  @Roles(...BOSS_ROLES)
  @HttpCode(200)
  async upgrade(@CurrentAdmin() admin: Admin, @Body() dto: UpgradeDto) {
    if (!admin.tenantId) throw new BadRequestException("Do'kon topilmadi");
    if (dto.tariffPlan === 'FREE') throw new BadRequestException("Free tarif uchun to'lov shart emas");
    const period = dto.billingPeriod === 'yearly' ? 'yearly' : 'monthly';

    const t = await this.prisma.tenant.findUnique({
      where: { id: admin.tenantId },
      select: { referralBalance: true },
    });
    const effectiveBalance = Number(t?.referralBalance ?? 0);
    const price = await this.referral.planPrice(dto.tariffPlan, period);
    const applied = dto.useBalance && price > 0 ? Math.min(effectiveBalance, price) : 0;

    // Referal balans summani to'liq qoplasa — chek shart emas, tarif darrov faollashadi.
    // (Bir martalik faollashtirish modeli: muddat/oylik-yillik yo'q.)
    if (applied >= price && applied > 0) {
      const now = new Date();
      await this.prisma.tenant.update({
        where: { id: admin.tenantId },
        data: {
          tariffPlan: dto.tariffPlan,
          status: 'ACTIVE',
          isActivated: true,
          activationPaidAt: now,
          activationAmount: price,
          referralBalance: effectiveBalance - applied,
        },
      });
      return { ok: true, fullyCovered: true, applied };
    }

    // Qisman yoki balanssiz — FAQAT to'lov ma'lumotini qaytaramiz.
    // MUHIM: bu yerda do'kon holati O'ZGARMAYDI. Ilgari shu joyda status
    // PENDING_PAYMENT ga o'tkazilardi va foydalanuvchi tarifni shunchaki
    // ko'rish uchun bosib, keyin bekor qilsa ham do'kon o'sha holatda
    // qolib ketardi. Endi holat faqat CHEK YUBORILGANDA o'zgaradi
    // (`upgrade/receipt`), tarifning o'zi esa faqat ADMIN TASDIQLAGACH.
    return {
      ok: true,
      payment: PAYMENT_INFO,
      applied,
      remaining: price - applied,
      price,
    };
  }

  /** To'lov chekini yuklab, admin chatiga tasdiqlash xabarini yuboradi. */
  @Post('upgrade/receipt')
  @Roles(...BOSS_ROLES)
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }),
  )
  async upgradeReceipt(
    @CurrentAdmin() admin: Admin,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /image\/(png|jpe?g|webp)/ })
        .addMaxSizeValidator({ maxSize: 8 * 1024 * 1024 })
        .build({ fileIsRequired: true }),
    )
    file: Express.Multer.File,
    @Body('plan') rawPlan?: string,
  ) {
    if (!admin.tenantId) throw new BadRequestException("Do'kon topilmadi");
    const t0 = await this.prisma.tenant.findUnique({ where: { id: admin.tenantId } });
    if (!t0) throw new BadRequestException("Do'kon topilmadi");

    // Qaysi tarif uchun chek yuborilyapti. Berilmasa — mavjud kutilayotgan
    // yoki joriy tarif (eski mijozlar bilan moslik uchun).
    const plan = (rawPlan?.trim() || t0.pendingPlan || t0.tariffPlan) as TariffPlan;
    if (!Object.values(TariffPlan).includes(plan) || plan === TariffPlan.FREE) {
      throw new BadRequestException("Tarif tanlanmagan");
    }
    const price = await this.referral.planPrice(plan);

    // Holat AYNAN SHU YERDA o'zgaradi — foydalanuvchi haqiqatan to'lab,
    // chek yubordi. Tarifning o'zi hali tegilmaydi: u `pendingPlan`da turadi
    // va faqat admin tasdiqlagach `tariffPlan`ga ko'chadi.
    const t = await this.prisma.tenant.update({
      where: { id: admin.tenantId },
      data: {
        pendingPlan: plan,
        activationAmount: price,
        status: 'PENDING_PAYMENT',
      },
    });

    const caption = buildPaymentCaption(t, 'Tarif yangilash — tasdiqlash kerak');

    try {
      await this.tgbot.sendPaymentReceipt(file.buffer, caption, t.id);
    } catch {
      throw new BadRequestException("To'lovni yuborishda xatolik. Keyinroq urinib ko'ring.");
    }
    return { ok: true };
  }
}
