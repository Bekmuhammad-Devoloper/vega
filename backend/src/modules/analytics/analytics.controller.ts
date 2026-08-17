import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { EventType, type User } from '@prisma/client';
import { TelegramAuthGuard } from '../auth/telegram-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { AnalyticsService } from './analytics.service';

/** TelegramAuthGuard so'rovga req.tenantId ni qo'yadi (X-Tenant-Slug'dan). */
type TenantReq = { tenantId?: string | null };

class EventDto {
  @IsEnum(EventType) type!: EventType;
  @IsOptional() @IsString() productId?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsObject() payload?: Record<string, unknown>;
}

class BatchEventsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMaxSize(100)
  @Type(() => EventDto)
  events!: EventDto[];
}

@Controller('events')
@UseGuards(TelegramAuthGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post()
  @HttpCode(204)
  async single(@CurrentUser() user: User, @Body() dto: EventDto, @Req() req: TenantReq): Promise<void> {
    await this.analytics.record(user.id, dto, req.tenantId ?? null);
  }

  @Post('batch')
  @HttpCode(204)
  async batch(@CurrentUser() user: User, @Body() dto: BatchEventsDto, @Req() req: TenantReq): Promise<void> {
    await this.analytics.recordBatch(user.id, dto.events, req.tenantId ?? null);
  }
}
