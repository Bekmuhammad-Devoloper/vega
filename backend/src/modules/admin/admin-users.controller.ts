import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { AdminRole, EventType, type Admin } from '@prisma/client';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { CurrentAdmin, Roles, RolesGuard } from '../admin-auth/roles.guard';
import { VIEW_ROLES } from '@/common/role-groups';
import { AdminUsersService } from './admin-users.service';

class ListUsersDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isBlocked?: boolean;
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

class UpdateUserDto {
  @IsOptional() @IsBoolean() isBlocked?: boolean;
}

class TimelineDto {
  @IsOptional() @IsEnum(EventType) type?: EventType;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

class PaginationDto {
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

@Controller('admin/users')
@UseGuards(AdminJwtGuard, RolesGuard)
// Mijozlar (PII) — boss + manager + moderator. CREATOR kira olmaydi.
// (@Patch block — pastda qat'iyroq ADMIN/SUPERADMIN bilan override qilingan.)
@Roles(...VIEW_ROLES)
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(@Query() q: ListUsersDto, @CurrentAdmin() admin: Admin) {
    return this.users.list({ ...q, tenantId: admin.tenantId });
  }

  @Get(':id')
  getById(@Param('id') id: string, @CurrentAdmin() admin: Admin) {
    return this.users.getById(id, admin.tenantId);
  }

  @Patch(':id')
  @Roles(AdminRole.SUPERADMIN, AdminRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentAdmin() admin: Admin) {
    if (dto.isBlocked !== undefined) return this.users.block(id, dto.isBlocked, admin.tenantId);
    return { ok: true };
  }

  @Get(':id/timeline')
  timeline(@Param('id') id: string, @Query() q: TimelineDto, @CurrentAdmin() admin: Admin) {
    return this.users.timeline(id, q, admin.tenantId);
  }

  @Get(':id/interests')
  interests(@Param('id') id: string, @CurrentAdmin() admin: Admin) {
    return this.users.interests(id, admin.tenantId);
  }

  @Get(':id/orders')
  orders(@Param('id') id: string, @Query() q: PaginationDto, @CurrentAdmin() admin: Admin) {
    return this.users.orders(id, q, admin.tenantId);
  }
}
