import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { SubscriptionStatus, TariffPlan } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { SuperJwtGuard, PlatformRoles, PlatformRolesGuard } from './super-jwt.guard';

class ListQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsEnum(SubscriptionStatus) status?: SubscriptionStatus;
  @IsOptional() @IsEnum(TariffPlan) plan?: TariffPlan;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() expiringWithin?: string; // days as string
}

@Controller('super-admin/subscriptions')
@UseGuards(SuperJwtGuard, PlatformRolesGuard)
@PlatformRoles('FINANCE', 'SALES')
export class SuperSubscriptionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query() q: ListQuery) {
    const page = Math.max(1, q.page ?? 1);
    const pageSize = Math.min(100, q.pageSize ?? 25);

    const where: Prisma.SubscriptionWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.plan) where.plan = q.plan;
    if (q.expiringWithin) {
      const days = Number(q.expiringWithin);
      if (days > 0) {
        where.endsAt = {
          lte: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
          gte: new Date(),
        };
      }
    }
    if (q.search?.trim()) {
      where.tenant = {
        OR: [
          { shopName: { contains: q.search, mode: 'insensitive' } },
          { ownerEmail: { contains: q.search, mode: 'insensitive' } },
        ],
      };
    }

    const [total, items] = await Promise.all([
      this.prisma.subscription.count({ where }),
      this.prisma.subscription.findMany({
        where,
        orderBy: { endsAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          tenant: {
            select: {
              id: true,
              shopName: true,
              ownerEmail: true,
              status: true,
              logoUrl: true,
            },
          },
        },
      }),
    ]);

    return { items, total, page, pageSize };
  }

  @Get('summary')
  async summary() {
    const [active, expiringSoon, pastDue, totalMrr] = await Promise.all([
      this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      this.prisma.subscription.count({
        where: {
          status: 'ACTIVE',
          endsAt: {
            gte: new Date(),
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      this.prisma.subscription.count({ where: { status: 'PAST_DUE' } }),
      this.prisma.subscription.aggregate({
        where: { status: 'ACTIVE' },
        _sum: { amount: true },
      }),
    ]);

    return {
      active,
      expiringSoon,
      pastDue,
      totalMrr: Number(totalMrr._sum.amount ?? 0),
    };
  }
}
