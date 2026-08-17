import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { AdminRole, type Admin } from '@prisma/client';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { CurrentAdmin, Roles, RolesGuard } from '../admin-auth/roles.guard';
import { VIEW_ROLES } from '@/common/role-groups';
import { CatalogService } from '../catalog/catalog.service';
import { AdminNumbersService } from './admin-numbers.service';

class UpsertOfferDto {
  @IsString() serviceId!: string;
  @IsString() countryId!: string;
  @Type(() => Number) @IsNumber() @Min(0) retailPrice!: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

@Controller('admin')
@UseGuards(AdminJwtGuard, RolesGuard)
export class AdminNumbersController {
  constructor(
    private readonly svc: AdminNumbersService,
    private readonly catalog: CatalogService,
  ) {}

  /** Jonli "tan narxi" (tan narxi + free-tarif ustamasi) — reseller foyda hisobi + izoh uchun. */
  @Get('catalog/price')
  @Roles(...VIEW_ROLES)
  async catalogPrice(
    @Query('serviceId') serviceId: string,
    @Query('countryId') countryId: string,
    @CurrentAdmin() admin: Admin,
  ) {
    const q = await this.catalog.quoteFor(
      admin.tenantId as string,
      serviceId,
      countryId,
    );
    return {
      available: !!q,
      wholesaleUzs: q?.totalUzs ?? null, // reseller to'laydigan TO'LIQ narx
      baseUzs: q?.baseUzs ?? null, // sof tan narxi (SPIDER + 1000)
      surchargeUzs: q?.surchargeUzs ?? null, // free sinov ustamasi (0 yoki 1200)
      state: q?.state ?? null, // TRIAL | EXPIRED | PAID
      phase: q?.phase ?? null, // FREE | SURCHARGE | EXPIRED | PAID
      trialDaysLeft: q?.trialDaysLeft ?? null,
      freeDaysLeft: q?.freeDaysLeft ?? null, // tan narxida qolgan kunlar (ustamasiz)
    };
  }

  /** Tanlangan xizmat qo'llaydigan davlatlar (Telegram -> faqat SPIDER'da bor). */
  @Get('catalog/countries')
  @Roles(...VIEW_ROLES)
  serviceCountries(@Query('serviceId') serviceId: string) {
    return this.catalog.serviceCountries(serviceId);
  }

  @Get('numbers')
  @Roles(...VIEW_ROLES)
  orders(@CurrentAdmin() admin: Admin) {
    return this.svc.listOrders(admin.tenantId as string);
  }

  @Get('numbers/stats')
  @Roles(...VIEW_ROLES)
  stats(@CurrentAdmin() admin: Admin) {
    return this.svc.stats(admin.tenantId as string);
  }

  @Get('offers')
  @Roles(...VIEW_ROLES)
  offers(@CurrentAdmin() admin: Admin) {
    return this.svc.listOffers(admin.tenantId as string);
  }

  @Post('offers')
  @Roles(AdminRole.SUPERADMIN, AdminRole.ADMIN, AdminRole.MANAGER)
  upsert(@Body() dto: UpsertOfferDto, @CurrentAdmin() admin: Admin) {
    return this.svc.upsertOffer(admin.tenantId as string, dto);
  }

  @Delete('offers/:id')
  @Roles(AdminRole.SUPERADMIN, AdminRole.ADMIN)
  remove(@Param('id') id: string, @CurrentAdmin() admin: Admin) {
    return this.svc.deleteOffer(admin.tenantId as string, id);
  }
}
