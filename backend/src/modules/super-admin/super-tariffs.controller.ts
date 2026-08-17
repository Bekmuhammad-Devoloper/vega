import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { TariffPlan } from '@prisma/client';
import type { PlatformAdmin, Prisma } from '@prisma/client';
import type { Request } from 'express';
import { SuperTariffsService } from './super-tariffs.service';
import {
  SuperJwtGuard,
  CurrentPlatformAdmin,
  PlatformRoles,
  PlatformRolesGuard,
} from './super-jwt.guard';
import { SuperAuditService } from './super-audit.service';

class UpdateTariffDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) oneTimePrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(-1) maxServices?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(-1) maxCountries?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(-1) maxAdmins?: number;
  @IsOptional() @IsBoolean() customBot?: boolean;
  @IsOptional() @IsBoolean() customDomain?: boolean;
  @IsOptional() @IsBoolean() whiteLabel?: boolean;
  @IsOptional() features?: Record<string, unknown>;
  @IsOptional() @IsString() badge?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) position?: number;
}

function clientMeta(req: Request) {
  const xff = (req.headers['x-forwarded-for'] as string | undefined) ?? '';
  return {
    ip: xff.split(',')[0]?.trim() || req.ip || '',
    ua: (req.headers['user-agent'] as string | undefined) ?? '',
  };
}

@Controller('super-admin/tariffs')
@UseGuards(SuperJwtGuard, PlatformRolesGuard)
export class SuperTariffsController {
  constructor(
    private readonly service: SuperTariffsService,
    private readonly audit: SuperAuditService,
  ) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get(':plan')
  getByPlan(@Param('plan') plan: TariffPlan) {
    return this.service.getByPlan(plan);
  }

  @Patch(':plan')
  @PlatformRoles('FINANCE')
  async update(
    @Param('plan') plan: TariffPlan,
    @Body() dto: UpdateTariffDto,
    @CurrentPlatformAdmin() actor: PlatformAdmin,
    @Req() req: Request,
  ) {
    const updated = await this.service.update(plan, dto as Prisma.TariffConfigUpdateInput);
    const { ip, ua } = clientMeta(req);
    await this.audit.log(actor, {
      action: 'tariff.update',
      targetType: 'tariff_config',
      targetId: plan,
      changes: dto as Record<string, unknown>,
      ipAddress: ip,
      userAgent: ua,
    });
    return updated;
  }
}
