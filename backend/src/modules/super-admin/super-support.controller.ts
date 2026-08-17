import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { SuperJwtGuard, PlatformRoles, PlatformRolesGuard } from './super-jwt.guard';

class ListQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() search?: string;
}

@Controller('super-admin/support')
@UseGuards(SuperJwtGuard, PlatformRolesGuard)
@PlatformRoles('SUPPORT')
export class SuperSupportController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('summary')
  async summary() {
    const [open, resolved, today] = await Promise.all([
      this.prisma.supportTicket.count({ where: { status: 'open' } }),
      this.prisma.supportTicket.count({ where: { status: 'resolved' } }),
      this.prisma.supportTicket.count({
        where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
    ]);
    return { open, resolved, today };
  }

  @Get('tickets')
  async tickets(@Query() q: ListQuery) {
    const page = Math.max(1, q.page ?? 1);
    const pageSize = Math.min(100, q.pageSize ?? 25);

    const where: Prisma.SupportTicketWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.search?.trim()) {
      where.OR = [
        { subject: { contains: q.search, mode: 'insensitive' } },
        { message: { contains: q.search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.supportTicket.count({ where }),
      this.prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              photoUrl: true,
            },
          },
          responses: {
            select: { id: true },
          },
        },
      }),
    ]);

    return { items, total, page, pageSize };
  }

  @Get('tickets/:id')
  async getTicket(@Param('id') id: string) {
    return this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        user: true,
        responses: { orderBy: { createdAt: 'asc' } },
      },
    });
  }
}
