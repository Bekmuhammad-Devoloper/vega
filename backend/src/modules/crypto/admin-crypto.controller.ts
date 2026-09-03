import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CryptoAsset, type Admin } from '@prisma/client';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { CurrentAdmin, RolesGuard, Roles } from '../admin-auth/roles.guard';
import { BOSS_ROLES, ORDERS_ROLES, VIEW_ROLES } from '@/common/role-groups';
import { ASSET_NETWORKS, CryptoService } from './crypto.service';

class UpsertCryptoOfferDto {
  @IsEnum(CryptoAsset) asset!: CryptoAsset;
  @Type(() => Number) @IsNumber() @Min(0) pricePerUnit!: number;
  @Type(() => Number) @IsNumber() @Min(0) minAmount!: number;
  @Type(() => Number) @IsNumber() @Min(0) maxAmount!: number;
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(8) @IsString({ each: true })
  networks!: string[];
}

class CryptoSettingsDto {
  @IsOptional() @IsBoolean() cryptoEnabled?: boolean;
}

class FulfillDto {
  @IsOptional() @IsString() @MaxLength(128) txHash?: string;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

class CancelDto {
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

/// Reseller — TON/USDT sotuvini yoqish, narxlash va buyurtmalarni yopish.
@Controller('admin/crypto')
@UseGuards(AdminJwtGuard, RolesGuard)
export class AdminCryptoController {
  constructor(private readonly crypto: CryptoService) {}

  /** Qaysi aktiv qaysi tarmoqlarda yuborilishi mumkin (UI ro'yxati uchun). */
  @Get('networks')
  @Roles(...VIEW_ROLES)
  networks() {
    return ASSET_NETWORKS;
  }

  @Get('offers')
  @Roles(...VIEW_ROLES)
  offers(@CurrentAdmin() admin: Admin) {
    return this.crypto.offers(admin.tenantId as string);
  }

  @Post('offers')
  @Roles(...BOSS_ROLES)
  upsert(@CurrentAdmin() admin: Admin, @Body() dto: UpsertCryptoOfferDto) {
    return this.crypto.upsertOffer(admin.tenantId as string, dto);
  }

  @Delete('offers/:id')
  @Roles(...BOSS_ROLES)
  del(@CurrentAdmin() admin: Admin, @Param('id') id: string) {
    return this.crypto.deleteOffer(admin.tenantId as string, id);
  }

  @Patch('settings')
  @Roles(...BOSS_ROLES)
  settings(@CurrentAdmin() admin: Admin, @Body() dto: CryptoSettingsDto) {
    return this.crypto.setSettings(admin.tenantId as string, dto);
  }

  @Get('orders')
  @Roles(...VIEW_ROLES)
  orders(@CurrentAdmin() admin: Admin) {
    return this.crypto.adminOrders(admin.tenantId as string);
  }

  /** Kripto yuborildi — buyurtma yopiladi, tx hash mijozga ko'rinadi. */
  @Post('orders/:id/fulfill')
  @Roles(...ORDERS_ROLES)
  fulfill(
    @CurrentAdmin() admin: Admin,
    @Param('id') id: string,
    @Body() dto: FulfillDto,
  ) {
    return this.crypto.fulfill(
      admin.tenantId as string,
      id,
      admin.id,
      dto.txHash,
      dto.note,
    );
  }

  /** Bekor qilish — mijozga puli to'liq qaytadi. */
  @Post('orders/:id/cancel')
  @Roles(...ORDERS_ROLES)
  cancel(
    @CurrentAdmin() admin: Admin,
    @Param('id') id: string,
    @Body() dto: CancelDto,
  ) {
    return this.crypto.cancelOrder(admin.tenantId as string, id, dto.note);
  }
}
