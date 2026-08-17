import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { WalletService } from '../wallet/wallet.service';
import { SuperJwtGuard, PlatformRoles, PlatformRolesGuard } from './super-jwt.guard';

class CreditDto {
  @IsString() tenantId!: string;
  @Type(() => Number) @IsNumber() @Min(1) amount!: number;
  @IsOptional() @IsString() note?: string;
}

class PlatformTopupDto {
  @Type(() => Number) @IsNumber() @Min(1) amount!: number;
  @IsOptional() @IsString() note?: string;
}

/// Superadmin: reseller ulgurji hamyonlarini boshqarish (to'ldirishlarni tasdiqlash + qo'lda kredit).
@Controller('super-admin/wallet')
@UseGuards(SuperJwtGuard, PlatformRolesGuard)
export class SuperWalletController {
  constructor(private readonly wallet: WalletService) {}

  /** Platforma (egasi) balansi + tranzaksiyalar. */
  @Get('platform')
  async platform() {
    return {
      balance: await this.wallet.platformBalance(),
      transactions: await this.wallet.platformTxs(),
    };
  }

  /** Egasi o'z platforma balansini to'ldiradi (float). */
  @Post('platform/topup')
  @PlatformRoles('FINANCE')
  platformTopup(@Body() dto: PlatformTopupDto) {
    return this.wallet.platformTopup(dto.amount, dto.note);
  }

  /** Kutilayotgan to'ldirish so'rovlari. */
  @Get('topups')
  pendingTopups() {
    return this.wallet.listPendingTopups();
  }

  /** To'ldirishni tasdiqlash -> reseller hamyoniga kredit. */
  @Post('topups/:id/approve')
  @PlatformRoles('FINANCE')
  approve(@Param('id') id: string) {
    return this.wallet.approveTopup(id);
  }

  /** To'ldirishni rad etish (kredit qilinmaydi). */
  @Post('topups/:id/reject')
  @PlatformRoles('FINANCE')
  reject(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.wallet.rejectTopup(id, reason);
  }

  /** Qo'lda kredit (superadmin reseller hamyoniga qo'shadi). */
  @Post('credit')
  @PlatformRoles('FINANCE')
  credit(@Body() dto: CreditDto) {
    return this.wallet.adminCredit(dto.tenantId, dto.amount, dto.note);
  }
}
