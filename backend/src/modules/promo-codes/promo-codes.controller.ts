import { BadRequestException, Body, Controller, Get, Headers, Post, UseGuards } from '@nestjs/common';
import { IsNumber, IsString, Min } from 'class-validator';
import type { User } from '@prisma/client';
import { TelegramAuthGuard } from '../auth/telegram-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantScopeService } from '@/common/tenant-scope/tenant-scope.service';
import { PromoCodesService } from './promo-codes.service';

class ApplyPromoDto {
  @IsString() code!: string;
  /** Raqam narxi (UZS) — chegirma shu summadan hisoblanadi. */
  @IsNumber() @Min(0) amount!: number;
}

@Controller('promo-codes')
@UseGuards(TelegramAuthGuard)
export class PromoCodesController {
  constructor(
    private readonly promos: PromoCodesService,
    private readonly tenantScope: TenantScopeService,
  ) {}

  @Get('public')
  async publicList(@Headers('x-tenant-slug') shop?: string) {
    const tenantId = await this.tenantScope.tenantId(shop);
    return this.promos.listPublic(tenantId);
  }

  @Post('apply')
  async apply(
    @CurrentUser() user: User,
    @Body() dto: ApplyPromoDto,
    @Headers('x-tenant-slug') shop?: string,
  ) {
    if (dto.amount <= 0) throw new BadRequestException('Amount required');
    const tenantId = await this.tenantScope.tenantId(shop);
    const result = await this.promos.evaluate(user.id, dto.code, dto.amount, tenantId);
    return {
      code: result.promo.code,
      type: result.promo.type,
      value: Number(result.promo.value),
      discountAmount: result.discountAmount,
      subtotal: dto.amount,
    };
  }
}
