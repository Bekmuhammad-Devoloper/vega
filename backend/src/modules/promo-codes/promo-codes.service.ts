import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PromoType, type PromoCode } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

export interface PromoCodeView {
  id: string;
  code: string;
  type: PromoType;
  value: number;
  minOrderAmount: number | null;
  maxDiscount: number | null;
  expiresAt: Date | null;
}

export interface PromoEvaluation {
  promo: PromoCode;
  discountAmount: number;
}

type Tx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

@Injectable()
export class PromoCodesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(tenantId?: string | null): Promise<PromoCodeView[]> {
    const rows = await this.prisma.promoCode.findMany({
      where: {
        tenantId: tenantId ?? null,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((p) => ({
      id: p.id,
      code: p.code,
      type: p.type,
      value: Number(p.value),
      minOrderAmount: p.minOrderAmount ? Number(p.minOrderAmount) : null,
      maxDiscount: p.maxDiscount ? Number(p.maxDiscount) : null,
      expiresAt: p.expiresAt,
    }));
  }

  async evaluate(
    userId: string,
    code: string,
    subtotal: number,
    tenantId?: string | null,
  ): Promise<PromoEvaluation> {
    if (!code) throw new BadRequestException('Promokodni kiriting');
    const promo = await this.prisma.promoCode.findFirst({
      where: { code: code.trim().toUpperCase(), tenantId: tenantId ?? null },
    });
    if (!promo || !promo.isActive) throw new NotFoundException('Bunday promokod topilmadi');

    const now = new Date();
    if (promo.startsAt && promo.startsAt > now) throw new BadRequestException('Promokod hali faol emas');
    if (promo.expiresAt && promo.expiresAt < now) throw new BadRequestException('Promokod muddati tugagan');

    if (promo.usageLimit !== null && promo.usageCount >= promo.usageLimit) {
      throw new BadRequestException('Promokod limiti tugagan');
    }

    const userUsages = await this.prisma.promoCodeUsage.count({
      where: { promoCodeId: promo.id, userId },
    });
    if (userUsages >= promo.perUserLimit) {
      throw new BadRequestException('Siz bu promokoddan allaqachon foydalangansiz');
    }

    if (promo.minOrderAmount && subtotal < Number(promo.minOrderAmount)) {
      throw new BadRequestException(
        `Promokod kamida ${Number(promo.minOrderAmount).toLocaleString('uz-UZ')} so'mlik xaridga amal qiladi`,
      );
    }

    let discount = 0;
    if (promo.type === PromoType.PERCENT) {
      discount = Math.floor((subtotal * Number(promo.value)) / 100);
      if (promo.maxDiscount && discount > Number(promo.maxDiscount)) {
        discount = Number(promo.maxDiscount);
      }
    } else {
      discount = Math.min(Number(promo.value), subtotal);
    }
    return { promo, discountAmount: discount };
  }

  /**
   * Promokodni buyurtma tranzaksiyasi ICHIDA band qiladi. Limit sharti SQL'da
   * (usageCount < usageLimit) — ikki mijoz oxirgi bitta joyni bir vaqtda
   * olsa ham faqat bittasi o'tadi.
   */
  async consume(tx: Tx, promoId: string, userId: string, orderId: string): Promise<void> {
    const n = await tx.$executeRaw`
      UPDATE "PromoCode" SET "usageCount" = "usageCount" + 1, "updatedAt" = now()
      WHERE id = ${promoId} AND "isActive" = true
        AND ("usageLimit" IS NULL OR "usageCount" < "usageLimit")`;
    if (n !== 1) throw new BadRequestException('Promokod limiti tugagan');
    await tx.promoCodeUsage.create({ data: { promoCodeId: promoId, userId, orderId } });
  }

  /** Buyurtma bekor bo'lib pul qaytsa — promokod ham mijozga qaytadi. */
  async release(tx: Tx, orderId: string): Promise<void> {
    const usage = await tx.promoCodeUsage.findUnique({ where: { orderId } });
    if (!usage) return;
    await tx.promoCodeUsage.delete({ where: { id: usage.id } });
    await tx.$executeRaw`
      UPDATE "PromoCode" SET "usageCount" = GREATEST("usageCount" - 1, 0) WHERE id = ${usage.promoCodeId}`;
  }
}
