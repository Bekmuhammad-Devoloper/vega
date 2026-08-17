import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { SuperJwtGuard, PlatformRoles, PlatformRolesGuard } from './super-jwt.guard';

class ListQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsString() status?: string;
}

@Controller('super-admin/broadcasts')
@UseGuards(SuperJwtGuard, PlatformRolesGuard)
@PlatformRoles('SALES', 'SUPPORT')
export class SuperBroadcastsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('summary')
  async summary() {
    const [total, completed, running, totalRecipients] = await Promise.all([
      this.prisma.broadcast.count(),
      this.prisma.broadcast.count({ where: { status: 'completed' } }),
      this.prisma.broadcast.count({ where: { status: 'running' } }),
      this.prisma.broadcast.aggregate({
        _sum: { sentCount: true },
      }),
    ]);
    return {
      total,
      completed,
      running,
      totalRecipients: totalRecipients._sum.sentCount ?? 0,
    };
  }

  @Get()
  async list(@Query() q: ListQuery) {
    const page = Math.max(1, q.page ?? 1);
    const pageSize = Math.min(100, q.pageSize ?? 25);

    const where: Prisma.BroadcastWhereInput = {};
    if (q.status) where.status = q.status;

    const [total, items] = await Promise.all([
      this.prisma.broadcast.count({ where }),
      this.prisma.broadcast.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { items, total, page, pageSize };
  }
}
