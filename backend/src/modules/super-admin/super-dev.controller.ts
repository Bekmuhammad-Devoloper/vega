import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import type { PlatformAdmin } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '@/prisma/prisma.service';
import {
  SuperJwtGuard,
  CurrentPlatformAdmin,
  PlatformRoles,
  PlatformRolesGuard,
} from './super-jwt.guard';
import { SuperAuditService } from './super-audit.service';

class SqlQueryDto {
  @IsString() query!: string;
}

function clientMeta(req: Request) {
  const xff = (req.headers['x-forwarded-for'] as string | undefined) ?? '';
  return {
    ip: xff.split(',')[0]?.trim() || req.ip || '',
    ua: (req.headers['user-agent'] as string | undefined) ?? '',
  };
}

@Controller('super-admin/dev')
@UseGuards(SuperJwtGuard, PlatformRolesGuard)
@PlatformRoles('DEVOPS')
export class SuperDevController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: SuperAuditService,
  ) {}

  @Get('routes')
  async routes() {
    return [
      { method: 'POST', path: '/api/super-admin/auth/login', description: 'Super admin login' },
      { method: 'GET', path: '/api/super-admin/dashboard/kpi', description: 'Platform KPI' },
      { method: 'GET', path: '/api/super-admin/tenants', description: 'List all tenants' },
      { method: 'POST', path: '/api/super-admin/tenants/:id/suspend', description: 'Suspend tenant' },
      { method: 'GET', path: '/api/super-admin/billing/invoices', description: 'List invoices' },
      { method: 'GET', path: '/api/super-admin/ai/overview', description: 'AI usage overview' },
      { method: 'GET', path: '/api/super-admin/audit', description: 'Audit log query' },
    ];
  }

  @Post('sql/select')
  async safeSelect(
    @Body() dto: SqlQueryDto,
    @CurrentPlatformAdmin() actor: PlatformAdmin,
    @Req() req: Request,
  ) {
    const trimmed = dto.query.trim();
    const upper = trimmed.toUpperCase();

    // Faqat SELECT — boshqa hech narsa
    if (!upper.startsWith('SELECT')) {
      return { error: 'Only SELECT queries are allowed' };
    }
    if (
      upper.includes('INSERT') ||
      upper.includes('UPDATE') ||
      upper.includes('DELETE') ||
      upper.includes('DROP') ||
      upper.includes('TRUNCATE') ||
      upper.includes('ALTER') ||
      upper.includes('CREATE')
    ) {
      return { error: 'Mutations are not allowed' };
    }
    if (trimmed.includes(';') && trimmed.indexOf(';') < trimmed.length - 1) {
      return { error: 'Multiple statements are not allowed' };
    }

    const limited = upper.includes('LIMIT') ? trimmed : `${trimmed.replace(/;$/, '')} LIMIT 100`;

    const { ip, ua } = clientMeta(req);
    await this.audit.log(actor, {
      action: 'dev.sql_query',
      changes: { query: limited.slice(0, 500) },
      ipAddress: ip,
      userAgent: ua,
    });

    try {
      const result = await this.prisma.$queryRawUnsafe(limited);
      return {
        rows: result,
        rowCount: Array.isArray(result) ? result.length : 0,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Query failed',
      };
    }
  }

  @Get('stats')
  async stats() {
    const dbVersion = await this.prisma.$queryRawUnsafe<Array<{ version: string }>>(
      "SELECT version() AS version",
    );
    return {
      nodeVersion: process.version,
      dbVersion: dbVersion[0]?.version ?? 'Unknown',
      pid: process.pid,
      uptime: process.uptime(),
    };
  }
}
