import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { SuperJwtGuard, PlatformRoles, PlatformRolesGuard } from './super-jwt.guard';

class AuditListQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsString() adminId?: string;
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsString() targetType?: string;
  @IsOptional() @IsString() targetId?: string;
  @IsOptional() @IsString() since?: string; // ISO date
  @IsOptional() @IsString() until?: string;
}

@Controller('super-admin/audit')
@UseGuards(SuperJwtGuard, PlatformRolesGuard)
@PlatformRoles('DEVOPS', 'FINANCE')
export class SuperAuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query() q: AuditListQuery) {
    const page = Math.max(1, q.page ?? 1);
    const pageSize = Math.min(100, q.pageSize ?? 50);

    const where: Prisma.PlatformAuditLogWhereInput = {};
    if (q.adminId) where.adminId = q.adminId;
    if (q.action) where.action = { contains: q.action, mode: 'insensitive' };
    if (q.targetType) where.targetType = q.targetType;
    if (q.targetId) where.targetId = q.targetId;
    if (q.since || q.until) {
      where.createdAt = {};
      if (q.since) where.createdAt.gte = new Date(q.since);
      if (q.until) where.createdAt.lte = new Date(q.until);
    }

    const [total, items] = await Promise.all([
      this.prisma.platformAuditLog.count({ where }),
      this.prisma.platformAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          admin: {
            select: { id: true, fullName: true, email: true, role: true },
          },
        },
      }),
    ]);

    return { items, total, page, pageSize };
  }

  @Get('actions')
  async actions() {
    const result = await this.prisma.platformAuditLog.groupBy({
      by: ['action'],
      _count: { _all: true },
      orderBy: { _count: { action: 'desc' } },
      take: 50,
    });
    return result.map((r) => ({ action: r.action, count: r._count._all }));
  }
}
