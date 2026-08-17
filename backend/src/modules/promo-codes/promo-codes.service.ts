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
    if (!code) throw new BadRequestException('Code required');
    const promo = await this.prisma.promoCode.findFirst({
      where: { code: code.trim().toUpperCase(), tenantId: tenantId ?? null },
    });
    if (!promo || !promo.isActive) throw new NotFoundException('Promo code not found');

    const now = new Date();
    if (promo.startsAt && promo.startsAt > now) throw new BadRequestException('Promo not active yet');
    if (promo.expiresAt && promo.expiresAt < now) throw new BadRequestException('Promo expired');

    if (promo.usageLimit !== null && promo.usageCount >= promo.usageLimit) {
      throw new BadRequestException('Promo usage limit reached');
    }

    const userUsages = await this.prisma.promoCodeUsage.count({
      where: { promoCodeId: promo.id, userId },
    });
    if (userUsages >= promo.perUserLimit) {
      throw new BadRequestException('You already used this promo');
    }

    if (promo.minOrderAmount && subtotal < Number(promo.minOrderAmount)) {
      throw new BadRequestException(
        `Minimum order amount is ${Number(promo.minOrderAmount)}`,
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

  async applyOnUsage(tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0], promoId: string, userId: string, orderId: string): Promise<void> {
    await tx.promoCode.update({
      where: { id: promoId },
      data: { usageCount: { increment: 1 } },
    });
    await tx.promoCodeUsage.create({
      data: { promoCodeId: promoId, userId, orderId },
    });
  }
}
