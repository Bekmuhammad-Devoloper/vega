import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AdminRole, type Admin } from '@prisma/client';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { Roles, RolesGuard } from '../admin-auth/roles.guard';
import { AdminBroadcastService } from './admin-broadcast.service';

class BroadcastFiltersDto {
  @IsOptional() @IsBoolean() hasOrders?: boolean;
  @IsOptional() @IsInt() @Min(1) noOrdersInDays?: number;
  @IsOptional() @IsInt() @Min(1) activeInDays?: number;
  @IsOptional() @IsIn(['uz', 'ru']) language?: 'uz' | 'ru';
  @IsOptional() @IsBoolean() excludeBlocked?: boolean;
}

class CreateBroadcastDto {
  @IsString() @MinLength(1) @MaxLength(4000) messageUz!: string;
  @IsOptional() @IsString() @MaxLength(4000) messageRu?: string | null;
  @ValidateNested() @Type(() => BroadcastFiltersDto) filters!: BroadcastFiltersDto;
  @IsOptional() @IsIn(['text', 'photo', 'video']) mediaType?: 'text' | 'photo' | 'video';
  @IsOptional() @IsString() @MaxLength(500) mediaUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(500) link?: string | null;
}

class PreviewQueryDto {
  @IsOptional() @Type(() => Boolean) @IsBoolean() hasOrders?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) noOrdersInDays?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) activeInDays?: number;
  @IsOptional() @IsIn(['uz', 'ru']) language?: 'uz' | 'ru';
  @IsOptional() @Type(() => Boolean) @IsBoolean() excludeBlocked?: boolean;
}

@Controller('admin/broadcasts')
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.SUPERADMIN, AdminRole.ADMIN)
export class AdminBroadcastController {
  constructor(private readonly broadcasts: AdminBroadcastService) {}

  @Get()
  list(@Req() req: { admin: Admin }) {
    return this.broadcasts.listHistory(req.admin.tenantId);
  }

  @Get('preview-count')
  previewCount(@Query() filters: PreviewQueryDto, @Req() req: { admin: Admin }) {
    return this.broadcasts.countRecipients(filters, req.admin.tenantId).then((count) => ({ count }));
  }

  @Get(':id')
  getById(@Param('id') id: string, @Req() req: { admin: Admin }) {
    return this.broadcasts.getById(id, req.admin.tenantId);
  }

  @Post()
  create(@Body() dto: CreateBroadcastDto, @Req() req: { admin: Admin }) {
    return this.broadcasts.create(req.admin.id, req.admin.tenantId, dto);
  }
}
