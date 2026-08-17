import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { SuperJwtGuard, PlatformRolesGuard } from './super-jwt.guard';

@Controller('super-admin/analytics')
@UseGuards(SuperJwtGuard, PlatformRolesGuard)
export class SuperAnalyticsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Funnel: signup → first product → first order → upgrade from FREE */
  @Get('funnel')
  async funnel() {
    const [total, withProducts, withOrders, paidTariff] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { totalOrders: { gt: 0 } } }),
      this.prisma.tenant.count({ where: { totalRevenue: { gt: 0 } } }),
      this.prisma.tenant.count({ where: { tariffPlan: { not: 'FREE' } } }),
    ]);

    return [
      { step: 'signup', label: "Ro'yxatdan o'tdi", count: total },
      { step: 'first_order', label: '1-buyurtma qildi', count: withProducts },
      { step: 'first_revenue', label: 'Sotuvi bo\'ldi', count: withOrders },
      { step: 'paid_upgrade', label: "Pulli tarifga o'tdi", count: paidTariff },
    ];
  }

  /** Cohort: oyma-oy ro'yxatdan o'tganlar va ularning faolligi */
  @Get('cohort')
  async cohort(@Query('months') monthsRaw?: string) {
    const months = Math.min(12, Math.max(1, Number(monthsRaw) || 6));
    const buckets: Array<{
      month: string;
      total: number;
      active: number;
      paying: number;
      revenue: number;
    }> = [];

    for (let i = months - 1; i >= 0; i--) {
      const start = new Date();
      start.setMonth(start.getMonth() - i, 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);

      const [total, active, paying] = await Promise.all([
        this.prisma.tenant.count({
          where: { createdAt: { gte: start, lt: end } },
        }),
        this.prisma.tenant.count({
          where: { createdAt: { gte: start, lt: end }, status: 'ACTIVE' },
        }),
        this.prisma.tenant.count({
          where: {
            createdAt: { gte: start, lt: end },
            tariffPlan: { not: 'FREE' },
          },
        }),
      ]);

      const revenueAgg = await this.prisma.tenant.aggregate({
        where: { createdAt: { gte: start, lt: end } },
        _sum: { totalRevenue: true },
      });

      buckets.push({
        month: start.toISOString().slice(0, 7),
        total,
        active,
        paying,
        revenue: Number(revenueAgg._sum.totalRevenue ?? 0),
      });
    }

    return buckets;
  }

  /** Geografik tahlil — davlat bo'yicha raqam-buyurtmalar (foyda bilan) */
  @Get('geo')
  async geo() {
    const groups = await this.prisma.numberOrder.groupBy({
      by: ['countryId'],
      where: { status: { not: 'CANCELLED' } },
      _count: { _all: true },
      _sum: { profit: true },
    });

    const countries = await this.prisma.country.findMany({
      where: { id: { in: groups.map((g) => g.countryId) } },
      select: { id: true, nameUz: true, flag: true },
    });
    const nameMap = new Map(countries.map((c) => [c.id, c]));

    return groups
      .map((g) => {
        const c = nameMap.get(g.countryId);
        return {
          region: c ? `${c.flag} ${c.nameUz}` : g.countryId,
          count: g._count._all,
          revenue: Number(g._sum.profit ?? 0),
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }

  /** Status bo'yicha tenant taqsimoti */
  @Get('status-distribution')
  async statusDistribution() {
    const groups = await this.prisma.tenant.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    return groups.map((g) => ({ status: g.status, count: g._count._all }));
  }
}
