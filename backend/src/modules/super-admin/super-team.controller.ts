import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { PlatformRole } from '@prisma/client';
import type { PlatformAdmin } from '@prisma/client';
import type { Request } from 'express';
import { SuperTeamService } from './super-team.service';
import {
  SuperJwtGuard,
  CurrentPlatformAdmin,
  PlatformRoles,
  PlatformRolesGuard,
} from './super-jwt.guard';
import { SuperAuditService } from './super-audit.service';

class CreateAdminDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(12) password!: string;
  @IsString() fullName!: string;
  @IsEnum(PlatformRole) role!: PlatformRole;
}

class UpdateAdminDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsEnum(PlatformRole) role?: PlatformRole;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class ResetPasswordDto {
  @IsString() @MinLength(12) newPassword!: string;
}

function serialize(a: PlatformAdmin) {
  return {
    id: a.id,
    email: a.email,
    fullName: a.fullName,
    role: a.role,
    isActive: a.isActive,
    twoFactorEnabled: a.twoFactorEnabled,
    lastLoginAt: a.lastLoginAt,
    lastLoginIp: a.lastLoginIp,
    createdAt: a.createdAt,
  };
}

function clientMeta(req: Request) {
  const xff = (req.headers['x-forwarded-for'] as string | undefined) ?? '';
  return {
    ip: xff.split(',')[0]?.trim() || req.ip || '',
    ua: (req.headers['user-agent'] as string | undefined) ?? '',
  };
}

@Controller('super-admin/team')
@UseGuards(SuperJwtGuard, PlatformRolesGuard)
export class SuperTeamController {
  constructor(
    private readonly service: SuperTeamService,
    private readonly audit: SuperAuditService,
  ) {}

  @Get()
  async list() {
    const items = await this.service.list();
    return items.map(serialize);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return serialize(await this.service.getById(id));
  }

  // DIQQAT: @PlatformRoles() (argsiz) = required.length===0 → guard HAMMAGA ruxsat beradi.
  // OWNER bilan cheklash uchun rolni ANIQ ko'rsatish shart: @PlatformRoles(PlatformRole.OWNER).
  @Post()
  @PlatformRoles(PlatformRole.OWNER)
  async create(
    @Body() dto: CreateAdminDto,
    @CurrentPlatformAdmin() actor: PlatformAdmin,
    @Req() req: Request,
  ) {
    const admin = await this.service.create(dto);
    const { ip, ua } = clientMeta(req);
    await this.audit.log(actor, {
      action: 'team.create',
      targetType: 'platform_admin',
      targetId: admin.id,
      changes: { email: admin.email, role: admin.role },
      ipAddress: ip,
      userAgent: ua,
    });
    return serialize(admin);
  }

  @Patch(':id')
  @PlatformRoles(PlatformRole.OWNER)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAdminDto,
    @CurrentPlatformAdmin() actor: PlatformAdmin,
    @Req() req: Request,
  ) {
    const admin = await this.service.update(id, dto);
    const { ip, ua } = clientMeta(req);
    await this.audit.log(actor, {
      action: 'team.update',
      targetType: 'platform_admin',
      targetId: id,
      changes: dto as Record<string, unknown>,
      ipAddress: ip,
      userAgent: ua,
    });
    return serialize(admin);
  }

  @Post(':id/reset-password')
  @PlatformRoles(PlatformRole.OWNER)
  async resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentPlatformAdmin() actor: PlatformAdmin,
    @Req() req: Request,
  ) {
    await this.service.resetPassword(id, dto.newPassword);
    const { ip, ua } = clientMeta(req);
    await this.audit.log(actor, {
      action: 'team.reset_password',
      targetType: 'platform_admin',
      targetId: id,
      ipAddress: ip,
      userAgent: ua,
    });
    return { ok: true };
  }

  @Delete(':id')
  @PlatformRoles(PlatformRole.OWNER)
  async deactivate(
    @Param('id') id: string,
    @CurrentPlatformAdmin() actor: PlatformAdmin,
    @Req() req: Request,
  ) {
    if (id === actor.id) throw new Error('Cannot deactivate yourself');
    const admin = await this.service.deactivate(id);
    const { ip, ua } = clientMeta(req);
    await this.audit.log(actor, {
      action: 'team.deactivate',
      targetType: 'platform_admin',
      targetId: id,
      ipAddress: ip,
      userAgent: ua,
    });
    return serialize(admin);
  }

  @Post(':id/activate')
  @PlatformRoles(PlatformRole.OWNER)
  async activate(
    @Param('id') id: string,
    @CurrentPlatformAdmin() actor: PlatformAdmin,
    @Req() req: Request,
  ) {
    const admin = await this.service.activate(id);
    const { ip, ua } = clientMeta(req);
    await this.audit.log(actor, {
      action: 'team.activate',
      targetType: 'platform_admin',
      targetId: id,
      ipAddress: ip,
      userAgent: ua,
    });
    return serialize(admin);
  }
}
