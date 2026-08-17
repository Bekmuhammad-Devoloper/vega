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
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { type Admin } from '@prisma/client';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { CurrentAdmin, RolesGuard } from '../admin-auth/roles.guard';
import { DigitalService } from './digital.service';

class UpsertDigitalOfferDto {
  @IsString() digitalProductId!: string;
  @Type(() => Number) @IsNumber() @Min(0) retailPrice!: number;
}

class DigitalSettingsDto {
  @IsOptional() @IsBoolean() starsEnabled?: boolean;
  @IsOptional() @IsBoolean() premiumEnabled?: boolean;
}

/// Reseller — Stars/Premium yoqish + narxlash + buyurtmalar.
@Controller('admin/digital')
@UseGuards(AdminJwtGuard, RolesGuard)
export class AdminDigitalController {
  constructor(private readonly digital: DigitalService) {}

  /** Platforma katalogi (yoqish/narxlash uchun). */
  @Get('catalog')
  catalog() {
    return this.digital.catalog();
  }

  @Get('offers')
  offers(@CurrentAdmin() admin: Admin) {
    return this.digital.offers(admin.tenantId as string);
  }

  @Post('offers')
  upsert(@CurrentAdmin() admin: Admin, @Body() dto: UpsertDigitalOfferDto) {
    return this.digital.upsertOffer(
      admin.tenantId as string,
      dto.digitalProductId,
      dto.retailPrice,
    );
  }

  @Delete('offers/:id')
  del(@CurrentAdmin() admin: Admin, @Param('id') id: string) {
    return this.digital.deleteOffer(admin.tenantId as string, id);
  }

  /** Stars/Premium funksiyasini yoqish/o'chirish. */
  @Patch('settings')
  settings(@CurrentAdmin() admin: Admin, @Body() dto: DigitalSettingsDto) {
    return this.digital.setSettings(admin.tenantId as string, dto);
  }

  @Get('orders')
  orders(@CurrentAdmin() admin: Admin) {
    return this.digital.adminOrders(admin.tenantId as string);
  }
}
