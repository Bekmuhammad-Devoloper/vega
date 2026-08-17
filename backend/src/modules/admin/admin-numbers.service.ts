import { Injectable, NotFoundException } from '@nestjs/common';
import { NumberOrderStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

export interface UpsertOfferInput {
  serviceId: string;
  countryId: string;
  retailPrice: number;
  isActive?: boolean;
}

/// Reseller admin paneli — buyurtmalar ko'rinishi + taklif (retail narx) boshqaruvi.
@Injectable()
export class AdminNumbersService {
  constructor(private readonly prisma: PrismaService) {}

  listOrders(tenantId: string, take = 50) {
    return this.prisma.numberOrder.findMany({
      where: { tenantId },
      include: { service: true, country: true, user: true },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async stats(tenantId: string) {
    const [total, received, profitAgg] = await Promise.all([
      this.prisma.numberOrder.count({ where: { tenantId } }),
      this.prisma.numberOrder.count({
        where: { tenantId, status: NumberOrderStatus.RECEIVED },
      }),
      this.prisma.numberOrder.aggregate({
        where: { tenantId, status: NumberOrderStatus.RECEIVED },
        _sum: { profit: true },
      }),
    ]);
    return { total, received, profit: Number(profitAgg._sum.profit ?? 0) };
  }

  // ── Takliflar (reseller retail narxlari) ──
  listOffers(tenantId: string) {
    return this.prisma.resellerOffer.findMany({
      where: { tenantId },
      include: { service: true, country: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  upsertOffer(tenantId: string, dto: UpsertOfferInput) {
    return this.prisma.resellerOffer.upsert({
      where: {
        tenantId_serviceId_countryId: {
          tenantId,
          serviceId: dto.serviceId,
          countryId: dto.countryId,
        },
      },
      update: { retailPrice: dto.retailPrice, isActive: dto.isActive ?? true },
      create: {
        tenantId,
        serviceId: dto.serviceId,
        countryId: dto.countryId,
        retailPrice: dto.retailPrice,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async deleteOffer(tenantId: string, id: string) {
    const offer = await this.prisma.resellerOffer.findUnique({ where: { id } });
    if (!offer || offer.tenantId !== tenantId) {
      throw new NotFoundException('Taklif topilmadi');
    }
    await this.prisma.resellerOffer.delete({ where: { id } });
    return { ok: true };
  }
}
