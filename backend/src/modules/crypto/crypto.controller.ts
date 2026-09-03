import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CryptoAsset, type User } from '@prisma/client';
import { TelegramAuthGuard } from '../auth/telegram-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { CurrentTenantId } from '@/common/decorators/tenant.decorator';
import { CryptoService } from './crypto.service';

class CreateCryptoOrderDto {
  @IsEnum(CryptoAsset) asset!: CryptoAsset;
  @Type(() => Number) @IsNumber() @Min(0) amount!: number;
  @IsString() @MaxLength(16) network!: string;
  @IsString() @MaxLength(128) address!: string;
  @IsOptional() @IsString() @MaxLength(64) memo?: string;
}

/// Mijoz (webapp/bot) — TON/USDT sotib olish. Do'kon x-tenant-slug orqali.
@Controller('crypto')
@UseGuards(TelegramAuthGuard)
export class CryptoController {
  constructor(private readonly crypto: CryptoService) {}

  @Get('storefront')
  storefront(@CurrentTenantId() tenantId: string | null) {
    if (!tenantId) throw new BadRequestException("Do'kon aniqlanmadi");
    return this.crypto.storefront(tenantId);
  }

  @Get('orders')
  myOrders(
    @CurrentTenantId() tenantId: string | null,
    @CurrentUser() user: User,
  ) {
    if (!tenantId) throw new BadRequestException("Do'kon aniqlanmadi");
    return this.crypto.myOrders(tenantId, user.id);
  }

  @Get('orders/:id')
  order(@Param('id') id: string, @CurrentUser() user: User) {
    return this.crypto.getOrder(id, user.id);
  }

  @Post('orders')
  create(
    @Body() dto: CreateCryptoOrderDto,
    @CurrentTenantId() tenantId: string | null,
    @CurrentUser() user: User,
  ) {
    if (!tenantId) throw new BadRequestException("Do'kon aniqlanmadi");
    return this.crypto.createOrder({
      tenantId,
      userId: user.id,
      asset: dto.asset,
      amount: dto.amount,
      network: dto.network,
      address: dto.address,
      memo: dto.memo,
    });
  }
}
