import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
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

class UpsertSettingDto {
  @IsString() category!: string;
  value!: unknown;
}

function clientMeta(req: Request) {
  const xff = (req.headers['x-forwarded-for'] as string | undefined) ?? '';
  return {
    ip: xff.split(',')[0]?.trim() || req.ip || '',
    ua: (req.headers['user-agent'] as string | undefined) ?? '',
  };
}

@Controller('super-admin/settings')
@UseGuards(SuperJwtGuard, PlatformRolesGuard)
@PlatformRoles('DEVOPS', 'FINANCE')
export class SuperSettingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: SuperAuditService,
  ) {}

  @Get()
  async list(@Query('category') category?: string) {
    const where: Prisma.PlatformSettingsWhereInput = {};
    if (category) where.category = category;
    return this.prisma.platformSettings.findMany({
      where,
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
  }

  @Get('categories')
  async categories() {
    const result = await this.prisma.platformSettings.groupBy({
      by: ['category'],
      _count: { _all: true },
    });
    return result.map((r) => ({ category: r.category, count: r._count._all }));
  }

  @Get(':key')
  async get(@Param('key') key: string) {
    return this.prisma.platformSettings.findUnique({ where: { key } });
  }

  @Put(':key')
  async upsert(
    @Param('key') key: string,
    @Body() dto: UpsertSettingDto,
    @CurrentPlatformAdmin() actor: PlatformAdmin,
    @Req() req: Request,
  ) {
    const setting = await this.prisma.platformSettings.upsert({
      where: { key },
      update: {
        value: dto.value as Prisma.InputJsonValue,
        category: dto.category,
        updatedBy: actor.id,
      },
      create: {
        key,
        value: dto.value as Prisma.InputJsonValue,
        category: dto.category,
        updatedBy: actor.id,
      },
    });
    const { ip, ua } = clientMeta(req);
    await this.audit.log(actor, {
      action: 'settings.update',
      targetType: 'platform_settings',
      targetId: key,
      changes: { value: dto.value },
      ipAddress: ip,
      userAgent: ua,
    });
    return setting;
  }

  @Delete(':key')
  async delete(
    @Param('key') key: string,
    @CurrentPlatformAdmin() actor: PlatformAdmin,
    @Req() req: Request,
  ) {
    await this.prisma.platformSettings.delete({ where: { key } });
    const { ip, ua } = clientMeta(req);
    await this.audit.log(actor, {
      action: 'settings.delete',
      targetType: 'platform_settings',
      targetId: key,
      ipAddress: ip,
      userAgent: ua,
    });
    return { ok: true };
  }
}
