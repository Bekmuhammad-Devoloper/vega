import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceStatus } from '@prisma/client';
import type { PlatformAdmin, Prisma } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '@/prisma/prisma.service';
import {
  SuperJwtGuard,
  CurrentPlatformAdmin,
  PlatformRoles,
  PlatformRolesGuard,
} from './super-jwt.guard';
import { SuperAuditService } from './super-audit.service';

class ListQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsEnum(InvoiceStatus) status?: InvoiceStatus;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() provider?: string;
  @IsOptional() @IsString() since?: string;
  @IsOptional() @IsString() until?: string;
}

class CreateInvoiceDto {
  @IsString() tenantId!: string;
  @Type(() => Number) @IsNumber() amount!: number;
  @IsString() description!: string;
  @IsString() dueDate!: string; // ISO
}

class RefundDto {
  @IsOptional() @IsString() reason?: string;
}

function clientMeta(req: Request) {
  const xff = (req.headers['x-forwarded-for'] as string | undefined) ?? '';
  return {
    ip: xff.split(',')[0]?.trim() || req.ip || '',
    ua: (req.headers['user-agent'] as string | undefined) ?? '',
  };
}

function generateInvoiceNumber(): string {
  const now = new Date();
  const stamp =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `INV-${stamp}-${rand}`;
}

@Controller('super-admin/billing')
@UseGuards(SuperJwtGuard, PlatformRolesGuard)
@PlatformRoles('FINANCE')
export class SuperBillingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: SuperAuditService,
  ) {}

  @Get('invoices')
  async listInvoices(@Query() q: ListQuery) {
    const page = Math.max(1, q.page ?? 1);
    const pageSize = Math.min(100, q.pageSize ?? 25);

    const where: Prisma.InvoiceWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.provider) where.paymentProvider = q.provider;
    if (q.since || q.until) {
      where.createdAt = {};
      if (q.since) where.createdAt.gte = new Date(q.since);
      if (q.until) where.createdAt.lte = new Date(q.until);
    }
    if (q.search?.trim()) {
      where.OR = [
        { invoiceNumber: { contains: q.search, mode: 'insensitive' } },
        {
          tenant: {
            OR: [
              { shopName: { contains: q.search, mode: 'insensitive' } },
              { ownerEmail: { contains: q.search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          tenant: {
            select: {
              id: true,
              shopName: true,
              ownerEmail: true,
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
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [paid, pending, failed, totalPaidMtd, totalPending] = await Promise.all([
      this.prisma.invoice.count({ where: { status: 'PAID' } }),
      this.prisma.invoice.count({ where: { status: 'PENDING' } }),
      this.prisma.invoice.count({ where: { status: 'FAILED' } }),
      this.prisma.invoice.aggregate({
        where: { status: 'PAID', paidAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      this.prisma.invoice.aggregate({
        where: { status: 'PENDING' },
        _sum: { amount: true },
      }),
    ]);

    return {
      paid,
      pending,
      failed,
      totalPaidMtd: Number(totalPaidMtd._sum.amount ?? 0),
      totalPending: Number(totalPending._sum.amount ?? 0),
    };
  }

  @Get('invoices/:id')
  async getInvoice(@Param('id') id: string) {
    return this.prisma.invoice.findUnique({
      where: { id },
      include: {
        tenant: true,
        subscription: true,
      },
    });
  }

  @Post('invoices')
  async createInvoice(
    @Body() dto: CreateInvoiceDto,
    @CurrentPlatformAdmin() actor: PlatformAdmin,
    @Req() req: Request,
  ) {
    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber: generateInvoiceNumber(),
        tenantId: dto.tenantId,
        amount: dto.amount,
        currency: 'UZS',
        status: 'PENDING',
        description: dto.description,
        dueDate: new Date(dto.dueDate),
      },
    });
    const { ip, ua } = clientMeta(req);
    await this.audit.log(actor, {
      action: 'invoice.create',
      targetType: 'invoice',
      targetId: invoice.id,
      changes: { amount: dto.amount, tenantId: dto.tenantId },
      ipAddress: ip,
      userAgent: ua,
    });
    return invoice;
  }

  @Patch('invoices/:id/refund')
  async refund(
    @Param('id') id: string,
    @Body() dto: RefundDto,
    @CurrentPlatformAdmin() actor: PlatformAdmin,
    @Req() req: Request,
  ) {
    const invoice = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: 'REFUNDED',
        metadata: { refundReason: dto.reason, refundedBy: actor.id, refundedAt: new Date() },
      },
    });
    const { ip, ua } = clientMeta(req);
    await this.audit.log(actor, {
      action: 'invoice.refund',
      targetType: 'invoice',
      targetId: id,
      changes: { reason: dto.reason },
      ipAddress: ip,
      userAgent: ua,
    });
    return invoice;
  }
}
