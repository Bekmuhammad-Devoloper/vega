import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma, TariffPlan } from '@prisma/client';
import { customAlphabet } from 'nanoid';
import { PrismaService } from '@/prisma/prisma.service';
import { TARIFFS } from '../public/tariffs';

// Chalkashtirmaydigan belgilar (0/O, 1/I yo'q)
const genCode = customAlphabet('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 7);

export interface ReferralConfig {
  /** Komissiya foizi (0–100). */
  commissionPercent: number;
  /** Kartaga yechish uchun minimal balans (so'm). */
  minWithdrawal: number;
}

const DEFAULT_CONFIG: ReferralConfig = { commissionPercent: 10, minWithdrawal: 500_000 };

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_CONFIG.commissionPercent;
  return Math.min(100, Math.max(0, Math.round(n)));
}

@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);
  private readonly botUsername: string;
  private readonly adminUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.botUsername = (config.get<string>('TELEGRAM_BOT_USERNAME') ?? '').replace(/^@/, '').trim();
    this.adminUrl = (config.get<string>('ADMIN_URL') ?? '').replace(/\/$/, '');
  }

  // ───── Konfiguratsiya (super-admin tahrirlaydi, PlatformSettings key=referral) ─────
  async getConfig(): Promise<ReferralConfig> {
    const row = await this.prisma.platformSettings.findUnique({ where: { key: 'referral' } });
    const v = (row?.value ?? {}) as Partial<ReferralConfig>;
    return {
      commissionPercent: clampPct(Number(v.commissionPercent ?? DEFAULT_CONFIG.commissionPercent)),
      minWithdrawal: Math.max(0, Number(v.minWithdrawal ?? DEFAULT_CONFIG.minWithdrawal)),
    };
  }

  async setConfig(cfg: Partial<ReferralConfig>, updatedBy?: string): Promise<ReferralConfig> {
    const current = await this.getConfig();
    const value: ReferralConfig = {
      commissionPercent: clampPct(cfg.commissionPercent ?? current.commissionPercent),
      minWithdrawal: Math.max(0, Math.round(cfg.minWithdrawal ?? current.minWithdrawal)),
    };
    const jsonValue = value as unknown as Prisma.InputJsonValue;
    await this.prisma.platformSettings.upsert({
      where: { key: 'referral' },
      update: { value: jsonValue, category: 'referral', updatedBy },
      create: { key: 'referral', value: jsonValue, category: 'referral', updatedBy },
    });
    return value;
  }

  /** Tarif narxi (bir martalik faollashtirish) — TariffConfig (DB) ustun, bo'lmasa TARIFFS konstanta. */
  async planPrice(plan: TariffPlan, period: 'monthly' | 'yearly' = 'monthly'): Promise<number> {
    const cfg = await this.prisma.tariffConfig.findUnique({ where: { plan } }).catch(() => null);
    if (cfg) return Number(cfg.oneTimePrice);
    const monthly = TARIFFS.find((t) => t.value === plan)?.priceMonthly ?? 0;
    return period === 'yearly' ? monthly * 12 : monthly;
  }

  // ───── Referal kod / link ─────
  async ensureCode(tenantId: string): Promise<string> {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { referralCode: true },
    });
    if (t?.referralCode) return t.referralCode;
    for (let i = 0; i < 6; i++) {
      const code = genCode();
      try {
        await this.prisma.tenant.update({ where: { id: tenantId }, data: { referralCode: code } });
        return code;
      } catch {
        // noyoblik to'qnashuvi — qayta urinamiz
      }
    }
    throw new Error("Referal kod yaratib bo'lmadi");
  }

  /**
   * Referal link — yangi SOTUVCHILARNI taklif qiladi. Global bot deep-link:
   * t.me/<bot>?start=ref<KOD>. Bot /start handler ref'ni admin Mini App URL'iga
   * qo'shadi → ro'yxatdan o'tishda ushlangan. Bot username yo'q bo'lsa — admin/register fallback.
   */
  link(code: string): string {
    if (this.botUsername) return `https://t.me/${this.botUsername}?start=ref${code}`;
    return `${this.adminUrl}/register?ref=${encodeURIComponent(code)}`;
  }

  /** ?ref=KOD bo'yicha referrer tenant id (topilmasa null). */
  async resolveReferrer(code: string | undefined | null): Promise<string | null> {
    const c = (code ?? '').trim();
    if (!c) return null;
    const t = await this.prisma.tenant.findUnique({
      where: { referralCode: c },
      select: { id: true },
    });
    return t?.id ?? null;
  }

  /** Bot /start ref<KOD> ko'rganda — referal kodni Telegram ID bo'yicha saqlaydi (server tomonda). */
  async rememberPending(telegramId: bigint | number, code: string): Promise<void> {
    const c = (code ?? '').trim();
    if (!c) return;
    const tid = BigInt(telegramId);
    await this.prisma.pendingReferral
      .upsert({ where: { telegramId: tid }, update: { code: c }, create: { telegramId: tid, code: c } })
      .catch(() => undefined);
  }

  /** Ro'yxatdan o'tishda — saqlangan referal kodni o'qiydi va o'chiradi (URL'ga bog'liq emas). */
  async consumePending(telegramId: bigint | number): Promise<string | null> {
    const tid = BigInt(telegramId);
    const row = await this.prisma.pendingReferral.findUnique({ where: { telegramId: tid } }).catch(() => null);
    if (!row) return null;
    await this.prisma.pendingReferral.delete({ where: { telegramId: tid } }).catch(() => undefined);
    return row.code;
  }

  /**
   * Komissiya hisoblaydi — taklif qilingan do'kon (referredId) pulli tarif
   * to'laganda referrer balansiga qo'shadi. Har to'lovda chaqiriladi (recurring).
   * Notification uchun { referrerId, amount } qaytaradi (yoki null).
   */
  async creditCommission(
    referredId: string,
    plan: TariffPlan,
    basisAmount: number,
  ): Promise<{ referrerId: string; amount: number } | null> {
    const referred = await this.prisma.tenant.findUnique({
      where: { id: referredId },
      select: { referredById: true },
    });
    const referrerId = referred?.referredById;
    if (!referrerId || referrerId === referredId) return null;
    const { commissionPercent } = await this.getConfig();
    if (commissionPercent <= 0 || basisAmount <= 0) return null;
    const amount = Math.round((basisAmount * commissionPercent) / 100);
    if (amount <= 0) return null;

    await this.prisma.$transaction([
      this.prisma.referralEarning.create({
        data: { referrerId, referredId, plan, basisAmount, percent: commissionPercent, amount },
      }),
      this.prisma.tenant.update({
        where: { id: referrerId },
        data: {
          referralBalance: { increment: amount },
          referralEarnedTotal: { increment: amount },
        },
      }),
    ]);
    this.logger.log(`Referral commission: ${amount} → ${referrerId} (from ${referredId}, ${plan})`);
    return { referrerId, amount };
  }

  // ───── Admin (sotuvchi) referal xulosasi ─────
  async adminSummary(tenantId: string) {
    const code = await this.ensureCode(tenantId);
    const [t, cfg, earnings, withdrawals, referralsCount] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { referralBalance: true, referralEarnedTotal: true },
      }),
      this.getConfig(),
      this.prisma.referralEarning.findMany({
        where: { referrerId: tenantId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.withdrawalRequest.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.tenant.count({ where: { referredById: tenantId } }),
    ]);

    const referredIds = [...new Set(earnings.map((e) => e.referredId))];
    const shops = referredIds.length
      ? await this.prisma.tenant.findMany({
          where: { id: { in: referredIds } },
          select: { id: true, shopName: true },
        })
      : [];
    const nameById = new Map(shops.map((s) => [s.id, s.shopName]));

    const balance = Number(t?.referralBalance ?? 0);
    const hasPending = withdrawals.some((w) => w.status === 'PENDING');
    return {
      code,
      link: this.link(code),
      balance,
      earnedTotal: Number(t?.referralEarnedTotal ?? 0),
      referralsCount,
      commissionPercent: cfg.commissionPercent,
      minWithdrawal: cfg.minWithdrawal,
      canWithdraw: balance >= cfg.minWithdrawal && !hasPending,
      hasPendingWithdrawal: hasPending,
      earnings: earnings.map((e) => ({
        id: e.id,
        shopName: nameById.get(e.referredId) ?? '—',
        plan: e.plan,
        amount: Number(e.amount),
        percent: e.percent,
        createdAt: e.createdAt,
      })),
      withdrawals: withdrawals.map((w) => ({
        id: w.id,
        amount: Number(w.amount),
        status: w.status,
        cardNumber: w.cardNumber,
        createdAt: w.createdAt,
        processedAt: w.processedAt,
      })),
    };
  }

  /** Kartaga yechish so'rovi — balansni ushlab turadi (rad etilsa qaytariladi). */
  async requestWithdrawal(tenantId: string, cardNumber: string, cardHolder?: string) {
    const cfg = await this.getConfig();
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { referralBalance: true },
    });
    const balance = Number(t?.referralBalance ?? 0);
    if (balance < cfg.minWithdrawal) {
      throw new BadRequestException(
        `Yechish uchun kamida ${cfg.minWithdrawal.toLocaleString('ru-RU').replace(/,/g, ' ')} so'm kerak`,
      );
    }
    const pending = await this.prisma.withdrawalRequest.findFirst({
      where: { tenantId, status: 'PENDING' },
    });
    if (pending) throw new BadRequestException("Sizda kutilayotgan yechish so'rovi bor");

    const digits = cardNumber.replace(/\D/g, '');
    if (!/^\d{12,19}$/.test(digits)) throw new BadRequestException("Karta raqami noto'g'ri");

    const [req] = await this.prisma.$transaction([
      this.prisma.withdrawalRequest.create({
        data: {
          tenantId,
          amount: balance,
          cardNumber: digits.replace(/(.{4})/g, '$1 ').trim(),
          cardHolder: cardHolder?.trim() || null,
          status: 'PENDING',
        },
      }),
      this.prisma.tenant.update({ where: { id: tenantId }, data: { referralBalance: 0 } }),
    ]);
    return { id: req.id, amount: Number(req.amount) };
  }

  // ───── Super-admin: yechish so'rovlari ─────
  async listWithdrawals(status?: string) {
    const where = status ? { status } : {};
    const rows = await this.prisma.withdrawalRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const tenantIds = [...new Set(rows.map((r) => r.tenantId))];
    const tenants = tenantIds.length
      ? await this.prisma.tenant.findMany({
          where: { id: { in: tenantIds } },
          select: { id: true, shopName: true, ownerName: true, ownerPhone: true, ownerUsername: true },
        })
      : [];
    const byId = new Map(tenants.map((t) => [t.id, t]));
    return rows.map((r) => {
      const shop = byId.get(r.tenantId);
      return {
        id: r.id,
        tenantId: r.tenantId,
        shopName: shop?.shopName ?? '—',
        ownerName: shop?.ownerName ?? '—',
        ownerPhone: shop?.ownerPhone ?? null,
        ownerUsername: shop?.ownerUsername ?? null,
        amount: Number(r.amount),
        cardNumber: r.cardNumber,
        cardHolder: r.cardHolder,
        status: r.status,
        note: r.note,
        createdAt: r.createdAt,
        processedAt: r.processedAt,
      };
    });
  }

  /**
   * Yechish so'rovini ko'rib chiqadi. paid → to'langan; reject → balans qaytariladi.
   * Notification uchun { tenantId, ownerTelegramId, amount, action } qaytaradi.
   */
  async processWithdrawal(
    id: string,
    action: 'paid' | 'reject',
    adminId: string,
    note?: string,
  ): Promise<{ tenantId: string; ownerTelegramId: bigint | null; amount: number; action: 'paid' | 'reject' }> {
    const req = await this.prisma.withdrawalRequest.findUnique({ where: { id } });
    if (!req || req.status !== 'PENDING') {
      throw new BadRequestException("So'rov topilmadi yoki allaqachon ko'rib chiqilgan");
    }
    const now = new Date();
    if (action === 'paid') {
      await this.prisma.withdrawalRequest.update({
        where: { id },
        data: { status: 'PAID', processedBy: adminId, processedAt: now, note: note ?? null },
      });
    } else {
      await this.prisma.$transaction([
        this.prisma.withdrawalRequest.update({
          where: { id },
          data: { status: 'REJECTED', processedBy: adminId, processedAt: now, note: note ?? null },
        }),
        this.prisma.tenant.update({
          where: { id: req.tenantId },
          data: { referralBalance: { increment: req.amount } },
        }),
      ]);
    }
    const owner = await this.prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: { ownerTelegramId: true },
    });
    return {
      tenantId: req.tenantId,
      ownerTelegramId: owner?.ownerTelegramId ?? null,
      amount: Number(req.amount),
      action,
    };
  }
}
