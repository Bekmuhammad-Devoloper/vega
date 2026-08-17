import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import {
  SuperJwtGuard,
  PlatformRoles,
  PlatformRolesGuard,
} from '../super-admin/super-jwt.guard';
import { TelegramBotService } from '../telegram-bot/telegram-bot.service';
import { ReferralService } from './referral.service';

class ConfigDto {
  @IsOptional() @IsNumber() @Min(0) @Max(100) commissionPercent?: number;
  @IsOptional() @IsNumber() @Min(0) minWithdrawal?: number;
}

class ProcessDto {
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

/** Super-admin: referal konfiguratsiyasi + kartaga yechish so'rovlari. */
@Controller('super-admin/referral')
@UseGuards(SuperJwtGuard, PlatformRolesGuard)
@PlatformRoles('FINANCE')
export class SuperReferralController {
  constructor(
    private readonly referral: ReferralService,
    private readonly tgbot: TelegramBotService,
  ) {}

  @Get('config')
  getConfig() {
    return this.referral.getConfig();
  }

  @Put('config')
  @HttpCode(200)
  setConfig(@Body() dto: ConfigDto) {
    return this.referral.setConfig(dto);
  }

  @Get('withdrawals')
  list(@Query('status') status?: string) {
    return this.referral.listWithdrawals(status);
  }

  /** action: paid (to'landi) yoki reject (balans qaytariladi). */
  @Post('withdrawals/:id/:action')
  @HttpCode(200)
  async process(
    @Param('id') id: string,
    @Param('action') action: string,
    @Body() dto: ProcessDto,
  ) {
    if (action !== 'paid' && action !== 'reject') {
      throw new BadRequestException('action: paid yoki reject');
    }
    const res = await this.referral.processWithdrawal(id, action, 'super', dto.note);

    // Sotuvchiga (do'kon egasiga) global bot orqali xabar
    if (res.ownerTelegramId) {
      const fmt = (n: number) => n.toLocaleString('ru-RU').replace(/,/g, ' ');
      const msg =
        action === 'paid'
          ? `✅ <b>Referal pulingiz to'landi!</b>\n\n<b>${fmt(res.amount)} so'm</b> kartangizga o'tkazildi. Vega bilan birga bo'lganingiz uchun rahmat!`
          : `❌ <b>Yechish so'rovi rad etildi.</b>\n\n<b>${fmt(res.amount)} so'm</b> referal balansingizga qaytarildi.${dto.note ? `\n\nSabab: ${dto.note}` : ''}`;
      await this.tgbot.sendDirectMessage(res.ownerTelegramId, msg).catch(() => undefined);
    }
    return { ok: true };
  }
}
