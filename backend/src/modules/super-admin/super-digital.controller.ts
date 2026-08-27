import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DigitalKind, type PlatformAdmin } from '@prisma/client';
import { DigitalService } from '../digital/digital.service';
import {
  SuperJwtGuard,
  PlatformRoles,
  PlatformRolesGuard,
  CurrentPlatformAdmin,
} from './super-jwt.guard';

class CreateProductDto {
  @IsEnum(DigitalKind) kind!: DigitalKind;
  @IsString() label!: string;
  @Type(() => Number) @IsInt() @Min(1) amount!: number;
  @Type(() => Number) @IsNumber() @Min(0) wholesaleUsd!: number;
  @IsOptional() @Type(() => Number) @IsInt() position?: number;
  @IsOptional() @IsString() providerServiceId?: string;
  @IsOptional() @Type(() => Number) @IsInt() providerQty?: number;
}

class UpdateProductDto {
  @IsOptional() @IsString() label?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) amount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) wholesaleUsd?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() position?: number;
  // SMM avto-yetkazish (bo'sh string = o'chirish -> qo'lda)
  @IsOptional() @IsString() providerServiceId?: string;
  @IsOptional() @Type(() => Number) @IsInt() providerQty?: number;
}

class NoteDto {
  @IsOptional() @IsString() note?: string;
}

/// Dev panel — Stars/Premium katalogi (ulgurji narx) + qo'lda yetkazish (fulfilment).
@Controller('super-admin/digital')
@UseGuards(SuperJwtGuard, PlatformRolesGuard)
export class SuperDigitalController {
  constructor(private readonly digital: DigitalService) {}

  @Get('products')
  products() {
    return this.digital.allProducts();
  }

  @Post('products')
  @PlatformRoles('FINANCE')
  create(@Body() dto: CreateProductDto) {
    return this.digital.createProduct(dto);
  }

  @Patch('products/:id')
  @PlatformRoles('FINANCE')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.digital.updateProduct(id, dto);
  }

  /** Avto-yetkazish provayderlari: sozlanganmi, balans, narxlar. */
  @Get('delivery-status')
  deliveryStatus() {
    return this.digital.deliveryStatus();
  }

  /** Sovg'a katalogini Telegram'dan tortib yangilash (userbot orqali). */
  @Post('gifts/sync')
  @PlatformRoles('FINANCE')
  syncGifts() {
    return this.digital.syncGiftCatalog();
  }

  /** Kutilayotgan (yetkazilmagan) Stars/Premium buyurtmalar. */
  @Get('orders')
  pending() {
    return this.digital.pendingOrders();
  }

  /** @username'ga yetkazildi deb belgilash. */
  @Post('orders/:id/fulfill')
  fulfill(
    @Param('id') id: string,
    @CurrentPlatformAdmin() admin: PlatformAdmin,
    @Body() dto: NoteDto,
  ) {
    return this.digital.fulfill(id, admin.id, dto.note);
  }

  /** Bekor qilish — mijozga retail, resellerga ulgurji qaytadi. */
  @Post('orders/:id/cancel')
  cancel(@Param('id') id: string, @Body() dto: NoteDto) {
    return this.digital.cancelOrder(id, dto.note);
  }
}
