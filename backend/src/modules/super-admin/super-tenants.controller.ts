import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { PlatformAdmin } from '@prisma/client';
import type { Request } from 'express';
import { TariffPlan, TenantStatus } from '@prisma/client';
import { SuperTenantsService } from './super-tenants.service';
import { SuperJwtGuard, CurrentPlatformAdmin, PlatformRoles, PlatformRolesGuard } from './super-jwt.guard';
import { SuperAuditService } from './super-audit.service';

class ListQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(TariffPlan) plan?: TariffPlan;
  @IsOptional() @IsEnum(TenantStatus) status?: TenantStatus;
  @IsOptional() @IsString() sort?: 'created' | 'revenue' | 'activity' | 'products';
  @IsOptional() @IsString() order?: 'asc' | 'desc';
}

class SuspendDto {
  @IsString() reason!: string;
}

class TariffDto {
  @IsEnum(TariffPlan) plan!: TariffPlan;
}

class TrialDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(90) days!: number;
}

class CreateTenantDto {
  @IsString() slug!: string;
  @IsString() shopName!: string;
  @IsString() ownerName!: string;
  // Telegram orqali kirish asosiy bo'lgani uchun email ixtiyoriy.
  @IsOptional() @IsEmail() ownerEmail?: string;
  // Sotuvchining Telegram ID si (BigInt) — string sifatida uzatiladi.
  @IsOptional() @IsNumberString() ownerTelegramId?: string;
  @IsOptional() @IsString() ownerPhone?: string;
  @IsOptional() @IsEnum(TariffPlan) tariffPlan?: TariffPlan;
  @IsOptional() @IsBoolean() isOnTrial?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(90) trialDays?: number;
}

class BulkActionDto {
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) ids!: string[];
  @IsEnum(['suspend', 'resume', 'delete']) action!: 'suspend' | 'resume' | 'delete';
  @IsOptional() @IsString() reason?: string;
}

function clientMeta(req: Request): { ip: string; ua: string } {
  const xff = (req.headers['x-forwarded-for'] as string | undefined) ?? '';
  const ip = xff.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || '';
  const ua = (req.headers['user-agent'] as string | undefined) ?? '';
  return { ip, ua };
}

@Controller('super-admin/tenants')
@UseGuards(SuperJwtGuard, PlatformRolesGuard)
export class SuperTenantsController {
  constructor(
    private readonly service: SuperTenantsService,
    private readonly audit: SuperAuditService,
  ) {}

  @Get()
  list(@Query() q: ListQuery) {
    return this.service.list(q);
  }

  @Get('export')
  async exportAll(@CurrentPlatformAdmin() admin: PlatformAdmin, @Req() req: Request) {
    const { ip, ua } = clientMeta(req);
    await this.audit.log(admin, {
      action: 'tenant.export',
      ipAddress: ip,
      userAgent: ua,
    });
    return this.service.exportAll();
  }

  @Post()
  @PlatformRoles('SALES', 'FINANCE')
  async create(
    @Body() dto: CreateTenantDto,
    @CurrentPlatformAdmin() actor: PlatformAdmin,
    @Req() req: Request,
  ) {
    const tenant = await this.service.create(dto);
    const { ip, ua } = clientMeta(req);
    await this.audit.log(actor, {
      action: 'tenant.create',
      targetType: 'tenant',
      targetId: tenant.id,
      changes: { slug: tenant.slug, shopName: tenant.shopName, tariffPlan: tenant.tariffPlan },
      ipAddress: ip,
      userAgent: ua,
    });
    return tenant;
  }

  @Post('bulk')
  @PlatformRoles('SALES', 'FINANCE')
  async bulk(
    @Body() dto: BulkActionDto,
    @CurrentPlatformAdmin() actor: PlatformAdmin,
    @Req() req: Request,
  ) {
    const result = await this.service.bulkUpdate(dto.ids, dto.action, dto.reason);
    const { ip, ua } = clientMeta(req);
    await this.audit.log(actor, {
      action: `tenant.bulk_${dto.action}`,
      changes: { ids: dto.ids, action: dto.action, reason: dto.reason },
      ipAddress: ip,
      userAgent: ua,
    });
    return result;
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getById(id);
  }

  /** Do'kon tafsiloti — detail sahifasi tab'lari uchun. */
  @Get(':id/detail')
  detail(@Param('id') id: string) {
    return this.service.getDetail(id);
  }

  @Delete(':id')
  @PlatformRoles('FINANCE')
  async delete(
    @Param('id') id: string,
    @CurrentPlatformAdmin() actor: PlatformAdmin,
    @Req() req: Request,
  ) {
    const result = await this.service.delete(id);
    const { ip, ua } = clientMeta(req);
    await this.audit.log(actor, {
      action: 'tenant.delete',
      targetType: 'tenant',
      targetId: id,
      ipAddress: ip,
      userAgent: ua,
    });
    return result;
  }

  @Post(':id/suspend')
  @PlatformRoles('SALES', 'FINANCE')
  async suspend(
    @Param('id') id: string,
    @Body() dto: SuspendDto,
    @CurrentPlatformAdmin() admin: PlatformAdmin,
    @Req() req: Request,
  ) {
    const tenant = await this.service.suspend(id, dto.reason);
    const { ip, ua } = clientMeta(req);
    await this.audit.log(admin, {
      action: 'tenant.suspend',
      targetType: 'tenant',
      targetId: id,
      changes: { reason: dto.reason },
      ipAddress: ip,
      userAgent: ua,
    });
    return tenant;
  }

  @Post(':id/resume')
  @PlatformRoles('SALES', 'FINANCE')
  async resume(
    @Param('id') id: string,
    @CurrentPlatformAdmin() admin: PlatformAdmin,
    @Req() req: Request,
  ) {
    const tenant = await this.service.resume(id);
    const { ip, ua } = clientMeta(req);
    await this.audit.log(admin, {
      action: 'tenant.resume',
      targetType: 'tenant',
      targetId: id,
      ipAddress: ip,
      userAgent: ua,
    });
    return tenant;
  }

  @Post(':id/tariff')
  @PlatformRoles('SALES', 'FINANCE')
  async changeTariff(
    @Param('id') id: string,
    @Body() dto: TariffDto,
    @CurrentPlatformAdmin() admin: PlatformAdmin,
    @Req() req: Request,
  ) {
    const tenant = await this.service.changeTariff(id, dto.plan);
    const { ip, ua } = clientMeta(req);
    await this.audit.log(admin, {
      action: 'tenant.tariff_change',
      targetType: 'tenant',
      targetId: id,
      changes: { plan: dto.plan },
      ipAddress: ip,
      userAgent: ua,
    });
    return tenant;
  }

  @Post(':id/extend-trial')
  @PlatformRoles('SALES')
  async extendTrial(
    @Param('id') id: string,
    @Body() dto: TrialDto,
    @CurrentPlatformAdmin() admin: PlatformAdmin,
    @Req() req: Request,
  ) {
    const tenant = await this.service.extendTrial(id, dto.days);
    const { ip, ua } = clientMeta(req);
    await this.audit.log(admin, {
      action: 'tenant.extend_trial',
      targetType: 'tenant',
      targetId: id,
      changes: { days: dto.days },
      ipAddress: ip,
      userAgent: ua,
    });
    return tenant;
  }
}
