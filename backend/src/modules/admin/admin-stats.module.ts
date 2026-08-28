import { Controller, Get, Module, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { NumberOrderStatus, Prisma, type Admin } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { CurrentAdmin, Roles, RolesGuard } from '../admin-auth/roles.guard';
import { VIEW_ROLES } from '@/common/role-groups';
import { RequireFeature, TariffFeatureGuard } from '../admin-auth/tariff-feature.guard';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';

class TimeRangeDto {
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
}

class TopProductsDto extends TimeRangeDto {
  @IsOptional() @IsIn(['views', 'sales']) metric?: 'views' | 'sales';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parseRange(dto: TimeRangeDto, defaultDays = 7): { from: Date; to: Date } {
  const to = dto.to ? new Date(dto.to) : new Date();
  const from = dto.from
    ? new Date(dto.from)
    : new Date(Date.now() - defaultDays * 24 * 60 * 60 * 1000);
  return { from, to };
}

@Controller('admin/stats')
@UseGuards(AdminJwtGuard, RolesGuard, TariffFeatureGuard)
// Statistika/analitika — boss + manager + moderator. CREATOR kira olmaydi.
@Roles(...VIEW_ROLES)
class AdminStatsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('overview')
  async overview(@CurrentAdmin() admin: Admin) {
    const todayStart = startOfDay(new Date());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    // Sotuvchi faqat o'z do'koni raqamlarini ko'radi; owner (tenantId yo'q) — hammasini
    const tenantId = admin.tenantId ?? undefined;
    const tenantFilter = tenantId ? { tenantId } : {};

    const [todayOrders, yesterdayOrders, todayRevenue, yesterdayRevenue, todayViews, yesterdayViews, totals, usersTotal] =
      await Promise.all([
        this.prisma.numberOrder.count({
          where: { ...tenantFilter, createdAt: { gte: todayStart }, status: { not: NumberOrderStatus.CANCELLED } },
        }),
        this.prisma.numberOrder.count({
          where: {
            ...tenantFilter,
            createdAt: { gte: yesterdayStart, lt: todayStart },
            status: { not: NumberOrderStatus.CANCELLED },
          },
        }),
        this.prisma.numberOrder.aggregate({
          where: { ...tenantFilter, createdAt: { gte: todayStart }, status: { not: NumberOrderStatus.CANCELLED } },
          _sum: { retailPrice: true },
        }),
        this.prisma.numberOrder.aggregate({
          where: {
            ...tenantFilter,
            createdAt: { gte: yesterdayStart, lt: todayStart },
            status: { not: NumberOrderStatus.CANCELLED },
          },
          _sum: { retailPrice: true },
        }),
        // Tashriflar UserEvent'da tenantId yo'q — sotuvchi uchun hozircha hisoblanmaydi
        tenantId
          ? Promise.resolve([] as { userId: string }[])
          : this.prisma.userEvent.findMany({
              where: { type: 'VIEW_HOME', createdAt: { gte: todayStart } },
              distinct: ['userId'],
              select: { userId: true },
            }),
        tenantId
          ? Promise.resolve([] as { userId: string }[])
          : this.prisma.userEvent.findMany({
              where: { type: 'VIEW_HOME', createdAt: { gte: yesterdayStart, lt: todayStart } },
              distinct: ['userId'],
              select: { userId: true },
            }),
        this.prisma.$transaction([
          this.prisma.resellerOffer.count({ where: { ...tenantFilter, isActive: true } }),
          this.prisma.numberOrder.count({ where: tenantFilter }),
        ]),
        tenantId ? Promise.resolve(0) : this.prisma.user.count(),
      ]);

    const todayRev = todayRevenue._sum.retailPrice ? Number(todayRevenue._sum.retailPrice) : 0;
    const yesterdayRev = yesterdayRevenue._sum.retailPrice ? Number(yesterdayRevenue._sum.retailPrice) : 0;

    const conversion =
      todayViews.length > 0 ? Math.round((todayOrders / todayViews.length) * 10000) / 100 : 0;
    const conversionYesterday =
      yesterdayViews.length > 0
        ? Math.round((yesterdayOrders / yesterdayViews.length) * 10000) / 100
        : 0;

    return {
      today: {
        orders: todayOrders,
        revenue: todayRev,
        uniqueVisitors: todayViews.length,
        conversion,
      },
      delta: {
        orders: pctDelta(todayOrders, yesterdayOrders),
        revenue: pctDelta(todayRev, yesterdayRev),
        uniqueVisitors: pctDelta(todayViews.length, yesterdayViews.length),
        conversion: conversion - conversionYesterday,
      },
      totals: {
        users: usersTotal,
        activeOffers: totals[0],
        ordersTotal: totals[1],
      },
    };
  }

  @Get('timeseries')
  @RequireFeature('analytics')
  async timeseries(@Query() dto: TimeRangeDto, @CurrentAdmin() admin: Admin) {
    const { from, to } = parseRange(dto, 30);
    // Sotuvchi faqat o'z do'koni buyurtmalarini ko'radi; owner (tenantId yo'q) — hammasini
    const tenantId = admin.tenantId ?? null;
    const orderTenant = tenantId ? Prisma.sql`AND "tenantId" = ${tenantId}` : Prisma.empty;
    const evTenant = tenantId ? Prisma.sql`AND "tenantId" = ${tenantId}` : Prisma.empty;

    // DIQQAT: bu so'rov ilgari "Order" jadvaliga tayanardi — u ESKI marketplace
    // modelidan qolgan va sxemada YO'Q. Natijada endpoint har chaqiruvda xato
    // berardi va panelda grafik o'rniga bo'sh kulrang joy turib qolardi.
    // Endi haqiqiy sotuv jadvallari: NumberOrder + DigitalOrder.
    //
    // Ikkala so'rov mustaqil — ketma-ket emas, PARALLEL bajariladi.
    const [rows, viewsRows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ day: Date; orders: number; revenue: number }>>`
        SELECT day, SUM(orders)::int AS orders, SUM(revenue)::float AS revenue
        FROM (
          SELECT
            DATE_TRUNC('day', "createdAt") AS day,
            COUNT(*)::int AS orders,
            COALESCE(SUM("retailPrice"), 0)::float AS revenue
          FROM "NumberOrder"
          WHERE "createdAt" >= ${from}
            AND "createdAt" < ${to}
            AND status NOT IN ('CANCELLED', 'ERROR')
            ${orderTenant}
          GROUP BY day
          UNION ALL
          SELECT
            DATE_TRUNC('day', "createdAt") AS day,
            COUNT(*)::int AS orders,
            COALESCE(SUM("retailPrice"), 0)::float AS revenue
          FROM "DigitalOrder"
          WHERE "createdAt" >= ${from}
            AND "createdAt" < ${to}
            AND status <> 'CANCELLED'
            ${orderTenant}
          GROUP BY day
        ) s
        GROUP BY day
        ORDER BY day ASC;
      `,
      this.prisma.$queryRaw<Array<{ day: Date; visitors: number }>>`
        SELECT
          DATE_TRUNC('day', "createdAt") AS day,
          COUNT(DISTINCT "userId")::int AS visitors
        FROM "UserEvent"
        WHERE "createdAt" >= ${from}
          AND "createdAt" < ${to}
          AND type = 'VIEW_HOME'
          ${evTenant}
        GROUP BY day
        ORDER BY day ASC;
      `,
    ]);

    // Sotuv bo'lmagan, lekin tashrif bo'lgan kunlar ham chiqsin — aks holda
    // "Tashriflar" tabi bo'sh ko'rinardi.
    const byDay = new Map<
      string,
      { day: Date; orders: number; revenue: number; visitors: number }
    >();
    for (const r of rows) {
      byDay.set(r.day.toISOString(), {
        day: r.day,
        orders: r.orders,
        revenue: r.revenue,
        visitors: 0,
      });
    }
    for (const v of viewsRows) {
      const key = v.day.toISOString();
      const cur = byDay.get(key);
      if (cur) cur.visitors = v.visitors;
      else byDay.set(key, { day: v.day, orders: 0, revenue: 0, visitors: v.visitors });
    }
    return [...byDay.values()].sort((a, b) => a.day.getTime() - b.day.getTime());
  }

  @Get('top-products')
  async topProducts(@Query() dto: TopProductsDto, @CurrentAdmin() admin: Admin) {
    const { from, to } = parseRange(dto, 7);
    const metric = dto.metric ?? 'sales';
    const limit = Math.min(dto.limit ?? 10, 50);
    const tenantId = admin.tenantId ?? null;

    if (metric === 'sales') {
      const orderTenant = tenantId ? Prisma.sql`AND o."tenantId" = ${tenantId}` : Prisma.empty;
      const rows = await this.prisma.$queryRaw<
        Array<{ productId: string; titleUz: string; quantity: number; revenue: number; imageUrl: string | null }>
      >`
        SELECT
          p.id AS "productId",
          p."titleUz" AS "titleUz",
          SUM(oi.quantity)::int AS quantity,
          SUM(oi."lineTotal")::float AS revenue,
          (SELECT url FROM "ProductImage" WHERE "productId" = p.id ORDER BY position ASC LIMIT 1) AS "imageUrl"
        FROM "OrderItem" oi
        JOIN "Order" o ON o.id = oi."orderId"
        JOIN "Product" p ON p.id = oi."productId"
        WHERE o."createdAt" >= ${from}
          AND o."createdAt" < ${to}
          AND o.status != 'CANCELLED'
          ${orderTenant}
        GROUP BY p.id, p."titleUz"
        ORDER BY quantity DESC
        LIMIT ${limit};
      `;
      return rows;
    }
    // views — UserEvent'da tenantId yo'q, lekin mahsulot tenant'iga bog'lab filtrlaymiz
    const prodTenant = tenantId ? Prisma.sql`AND p."tenantId" = ${tenantId}` : Prisma.empty;
    const rows = await this.prisma.$queryRaw<
      Array<{ productId: string; titleUz: string; views: number; imageUrl: string | null }>
    >`
      SELECT
        p.id AS "productId",
        p."titleUz" AS "titleUz",
        COUNT(*)::int AS views,
        (SELECT url FROM "ProductImage" WHERE "productId" = p.id ORDER BY position ASC LIMIT 1) AS "imageUrl"
      FROM "UserEvent" ue
      JOIN "Product" p ON p.id = ue."productId"
      WHERE ue.type = 'VIEW_PRODUCT'
        AND ue."createdAt" >= ${from}
        AND ue."createdAt" < ${to}
        ${prodTenant}
      GROUP BY p.id, p."titleUz"
      ORDER BY views DESC
      LIMIT ${limit};
    `;
    return rows;
  }

  @Get('funnel')
  @RequireFeature('analytics')
  async funnel(@Query() dto: TimeRangeDto, @CurrentAdmin() admin: Admin) {
    const { from, to } = parseRange(dto, 7);
    // Endi UserEvent.tenantId bor — funnel per-do'kon hisoblanadi
    const tenantId = admin.tenantId ?? null;
    const evTenant = tenantId ? Prisma.sql`AND "tenantId" = ${tenantId}` : Prisma.empty;
    const rows = await this.prisma.$queryRaw<
      Array<{
        visits: number;
        productViews: number;
        cartAdds: number;
        checkouts: number;
        orders: number;
      }>
    >`
      WITH stages AS (
        SELECT
          "userId",
          MIN(CASE WHEN type = 'VIEW_HOME' THEN "createdAt" END) AS s1,
          MIN(CASE WHEN type = 'VIEW_PRODUCT' THEN "createdAt" END) AS s2,
          MIN(CASE WHEN type = 'CART_ADD' THEN "createdAt" END) AS s3,
          MIN(CASE WHEN type = 'CHECKOUT_START' THEN "createdAt" END) AS s4,
          MIN(CASE WHEN type = 'ORDER_PLACED' THEN "createdAt" END) AS s5
        FROM "UserEvent"
        WHERE "createdAt" >= ${from} AND "createdAt" < ${to}
          ${evTenant}
        GROUP BY "userId"
      )
      SELECT
        COUNT(s1)::int AS visits,
        COUNT(s2)::int AS "productViews",
        COUNT(s3)::int AS "cartAdds",
        COUNT(s4)::int AS checkouts,
        COUNT(s5)::int AS orders
      FROM stages;
    `;
    return rows[0] ?? { visits: 0, productViews: 0, cartAdds: 0, checkouts: 0, orders: 0 };
  }

  @Get('top-categories')
  @RequireFeature('analytics')
  async topCategories(@Query() dto: TimeRangeDto, @CurrentAdmin() admin: Admin) {
    const { from, to } = parseRange(dto, 7);
    const tenantId = admin.tenantId ?? null;
    const revTenant = tenantId ? Prisma.sql`AND oo."tenantId" = ${tenantId}` : Prisma.empty;
    const prodTenant = tenantId ? Prisma.sql`AND p."tenantId" = ${tenantId}` : Prisma.empty;
    const rows = await this.prisma.$queryRaw<
      Array<{ categoryId: string; titleUz: string; interactions: number; revenue: number }>
    >`
      SELECT
        c.id AS "categoryId",
        c."titleUz" AS "titleUz",
        COUNT(DISTINCT ue.id)::int AS interactions,
        COALESCE((
          SELECT SUM(oi."lineTotal")
          FROM "OrderItem" oi
          JOIN "Product" pp ON pp.id = oi."productId"
          JOIN "Order" oo ON oo.id = oi."orderId"
          WHERE pp."categoryId" = c.id
            AND oo."createdAt" >= ${from} AND oo."createdAt" < ${to}
            AND oo.status != 'CANCELLED'
            ${revTenant}
        ), 0)::float AS revenue
      FROM "UserEvent" ue
      JOIN "Product" p ON p.id = ue."productId"
      JOIN "Category" c ON c.id = p."categoryId"
      WHERE ue."createdAt" >= ${from} AND ue."createdAt" < ${to}
        ${prodTenant}
      GROUP BY c.id, c."titleUz"
      ORDER BY interactions DESC
      LIMIT 10;
    `;
    return rows;
  }

  @Get('cart-abandonment')
  @RequireFeature('analytics')
  async cartAbandonment(@Query() dto: TimeRangeDto, @CurrentAdmin() admin: Admin) {
    const { from, to } = parseRange(dto, 14);
    const tenantId = admin.tenantId ?? null;
    const prodTenant = tenantId ? Prisma.sql`AND p."tenantId" = ${tenantId}` : Prisma.empty;
    const rows = await this.prisma.$queryRaw<
      Array<{ productId: string; titleUz: string; abandonedCount: number; imageUrl: string | null }>
    >`
      SELECT
        p.id AS "productId",
        p."titleUz" AS "titleUz",
        COUNT(*)::int AS "abandonedCount",
        (SELECT url FROM "ProductImage" WHERE "productId" = p.id ORDER BY position ASC LIMIT 1) AS "imageUrl"
      FROM "UserEvent" ue
      JOIN "Product" p ON p.id = ue."productId"
      WHERE ue.type = 'CART_ADD'
        AND ue."createdAt" >= ${from} AND ue."createdAt" < ${to}
        ${prodTenant}
        AND NOT EXISTS (
          SELECT 1 FROM "Order" o
          JOIN "OrderItem" oi ON oi."orderId" = o.id
          WHERE o."userId" = ue."userId"
            AND oi."productId" = ue."productId"
            AND o.status != 'CANCELLED'
            AND o."createdAt" >= ue."createdAt"
        )
      GROUP BY p.id, p."titleUz"
      ORDER BY "abandonedCount" DESC
      LIMIT 10;
    `;
    return rows;
  }
}

function pctDelta(now: number, prev: number): number {
  if (prev === 0) return now > 0 ? 100 : 0;
  return Math.round(((now - prev) / prev) * 1000) / 10;
}

@Module({
  imports: [AdminAuthModule],
  controllers: [AdminStatsController],
})
export class AdminStatsModule {}
