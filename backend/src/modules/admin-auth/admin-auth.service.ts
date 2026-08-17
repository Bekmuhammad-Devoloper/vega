import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { JwtService } from './jwt.service';
import { AdminRole, type Admin, type TariffPlan, type TenantStatus } from '@prisma/client';
import { isTariffActive } from '@/common/tariff';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

/**
 * Panelga kirish "rejimi" — bot qaysi buyruq orqali ochilganini bildiradi:
 * - 'owner'     → /start: faqat o'z do'konlari (egasi/boss)
 * - 'creator'   → /creator: faqat creator bo'lgan do'konlari
 * - 'moderator' → /moderator: faqat moderator bo'lgan do'konlari
 */
export type LoginMode = 'owner' | 'creator' | 'moderator';

/** loginWithTelegram/switchStore'da kira-olish tekshiruvi uchun kerakli do'kon maydonlari. */
type TenantAccessFields = {
  ownerTelegramId: bigint | null;
  status: TenantStatus;
  tariffPlan: TariffPlan;
};
type AdminWithTenant = Admin & { tenant: TenantAccessFields | null };

/** Telegram login uchun do'kon maydonlari (kira-olishni hisoblash uchun). */
const TENANT_ACCESS_SELECT = {
  ownerTelegramId: true,
  status: true,
  tariffPlan: true,
} as const;

@Injectable()
export class AdminAuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async login(email: string, password: string): Promise<{ admin: Admin; tokens: AuthTokens }> {
    const admin = await this.prisma.admin.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!admin || !admin.isActive) throw new UnauthorizedException('Invalid credentials');
    // Parolsiz (Telegram-only) adminlar email/parol bilan kira olmaydi
    if (!admin.passwordHash) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    const tokens = await this.issueTokens(admin);
    return { admin, tokens };
  }

  /**
   * Do'kon EGASI'mi yoki BOSS (ADMIN/SUPERADMIN)'mi — bular tarifdan qat'i nazar
   * kira oladi (tarif tugasa ham yangilash uchun). tenant'siz (platforma) admin ham.
   */
  private ownerOrBoss(a: AdminWithTenant, telegramId: bigint): boolean {
    if (!a.tenant) return true;
    if (a.tenant.ownerTelegramId !== null && a.tenant.ownerTelegramId === telegramId) return true;
    return a.role === AdminRole.ADMIN || a.role === AdminRole.SUPERADMIN;
  }

  /** Shu admin yozuvi orqali panelga kira oladimi: egasi/boss YOKI tarifi faol jamoa a'zosi. */
  private canAccess(a: AdminWithTenant, telegramId: bigint): boolean {
    if (this.ownerOrBoss(a, telegramId)) return true;
    // Jamoa a'zosi (creator/moderator/manager) — faqat do'kon tarifi faol bo'lsa.
    return a.tenant ? isTariffActive(a.tenant) : true;
  }

  /**
   * Telegram ID bo'yicha login (parolsiz). Egasi/boss har doim kiradi; jamoa a'zosi
   * (creator/moderator/manager) faqat do'kon tarifi FAOL bo'lsa.
   *
   * `mode` bot buyrug'iga mos yozuvni tanlaydi:
   * - 'creator'/'moderator' → aynan shu roldagi (kira olinadigan) yozuv; topilmasa
   *   tushunarli xato (umuman a'zo emas / tarifi faol emas).
   * - 'owner'/undefined → egasi/boss afzal, aks holda eng eski kira-olinadigan.
   */
  async loginWithTelegram(
    telegramId: bigint,
    mode?: LoginMode,
    photoUrl?: string | null,
  ): Promise<{ admin: Admin; tokens: AuthTokens }> {
    // Profil rasmini yangilaymiz (shu telegramId ning barcha do'kon yozuvlarida)
    if (photoUrl) {
      await this.prisma.admin
        .updateMany({ where: { telegramId }, data: { photoUrl } })
        .catch(() => undefined);
    }
    const admins = (await this.prisma.admin.findMany({
      where: { telegramId, isActive: true },
      orderBy: { createdAt: 'asc' },
      include: { tenant: { select: TENANT_ACCESS_SELECT } },
    })) as AdminWithTenant[];
    if (admins.length === 0) {
      throw new UnauthorizedException("Ro'yxatdan o'tilmagan");
    }
    const accessible = admins.filter((a) => this.canAccess(a, telegramId));

    // Jamoa rejimi (moderator) — aynan shu roldagi yozuvni tanlaymiz.
    // (CREATOR roli Vega'da o'chirilgan — faqat moderator jamoa a'zosi qoldi.)
    if (mode === 'moderator') {
      const wantRole = AdminRole.MODERATOR;
      const match = accessible.find((a) => a.role === wantRole);
      if (!match) {
        // Shu roldagi yozuvi bor, lekin hammasi tarifi faol emasmi?
        const hasRoleButInactive = admins.some((a) => a.role === wantRole);
        throw new UnauthorizedException(
          hasRoleButInactive
            ? "Do'kon tarifi faol emas. Egasi tarifni yangilagach kira olasiz."
            : `Siz hech qaysi do'konda ${mode} sifatida qo'shilmagansiz.`,
        );
      }
      const tokens = await this.issueTokens(match);
      return { admin: match, tokens };
    }

    // Egasi/boss rejimi.
    if (accessible.length === 0) {
      // Jamoa a'zosi, lekin barcha do'konlari tarifi faol emas.
      throw new UnauthorizedException(
        "Do'kon tarifi faol emas. Egasi tarifni yangilagach kira olasiz.",
      );
    }
    // Egasi/boss yozuvini afzal ko'ramiz, aks holda eng eski kira-olinadigan.
    const admin = accessible.find((a) => this.ownerOrBoss(a, telegramId)) ?? accessible[0];
    const tokens = await this.issueTokens(admin);
    return { admin, tokens };
  }

  /**
   * Do'konni almashtirish — joriy egaga (telegramId) tegishli boshqa do'kon adminiga
   * yangi token beradi. Faqat o'z do'koniga o'tishi mumkin.
   */
  async switchStore(
    currentAdmin: Admin,
    tenantId: string,
  ): Promise<{ admin: Admin; tokens: AuthTokens }> {
    if (!currentAdmin.telegramId) {
      throw new UnauthorizedException("Do'kon almashtirish faqat Telegram sotuvchilar uchun");
    }
    const target = (await this.prisma.admin.findFirst({
      where: { telegramId: currentAdmin.telegramId, tenantId, isActive: true },
      include: { tenant: { select: TENANT_ACCESS_SELECT } },
    })) as AdminWithTenant | null;
    if (!target) throw new UnauthorizedException("Do'kon topilmadi");
    // Rejim chegarasi: moderator sessiyasi faqat O'SHA roldagi do'konga o'ta oladi
    // (egasi/boss bemalol). Aks holda o'zi egasi bo'lgan do'konga "sakrab" o'tib,
    // rejim cheklovini chetlab o'tish mumkin bo'lardi. Mavjudligini oshkor
    // qilmaslik uchun 404-ga teng xabar.
    if (currentAdmin.role === AdminRole.MODERATOR && target.role !== currentAdmin.role) {
      throw new UnauthorizedException("Do'kon topilmadi");
    }
    // Jamoa a'zosi bo'lsa — faqat tarif faol do'konga o'ta oladi (egasi/boss har doim).
    if (!this.canAccess(target, currentAdmin.telegramId)) {
      throw new UnauthorizedException(
        "Do'kon tarifi faol emas. Egasi tarifni yangilagach kira olasiz.",
      );
    }
    const tokens = await this.issueTokens(target);
    return { admin: target, tokens };
  }

  async issueTokens(admin: Admin): Promise<AuthTokens> {
    const jti = randomUUID();
    const accessToken = this.jwt.signAccess({ sub: admin.id, email: admin.email, role: admin.role });
    const refreshToken = this.jwt.signRefresh({ sub: admin.id, jti });
    const ttl = this.jwt.refreshTtlMs();
    const expiresAt = new Date(Date.now() + ttl);
    await this.prisma.refreshToken.create({
      data: {
        adminId: admin.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
      },
    });
    return { accessToken, refreshToken, expiresAt };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload;
    try {
      payload = this.jwt.verifyRefresh(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }
    // Rotation: revoke current, issue new
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    const admin = (await this.prisma.admin.findUnique({
      where: { id: payload.sub },
      include: { tenant: { select: TENANT_ACCESS_SELECT } },
    })) as AdminWithTenant | null;
    if (!admin || !admin.isActive) throw new UnauthorizedException('Admin not found');
    // Tarif gate: jamoa a'zosi tarif tugagach sessiyani uzaytira olmaydi (egasi/boss — bemalol).
    if (admin.telegramId !== null && !this.canAccess(admin, admin.telegramId)) {
      throw new UnauthorizedException(
        "Do'kon tarifi faol emas. Egasi tarifni yangilagach kira olasiz.",
      );
    }
    return this.issueTokens(admin);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getById(id: string): Promise<Admin | null> {
    return this.prisma.admin.findUnique({ where: { id } });
  }
}
