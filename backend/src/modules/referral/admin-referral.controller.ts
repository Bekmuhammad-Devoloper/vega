import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { Admin } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { BOSS_ROLES } from '@/common/role-groups';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { CurrentAdmin, Roles, RolesGuard } from '../admin-auth/roles.guard';
import { TelegramBotService } from '../telegram-bot/telegram-bot.service';
import { ReferralService } from './referral.service';

class WithdrawDto {
  @IsString() @MaxLength(40) cardNumber!: string;
  @IsOptional() @IsString() @MaxLength(120) cardHolder?: string;
}

/** Sotuvchi referal kabineti: link, balans, daromad tarixi, kartaga yechish. */
@Controller('admin/referral')
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(...BOSS_ROLES)
export class AdminReferralController {
  constructor(
    private readonly referral: ReferralService,
    private readonly prisma: PrismaService,
    private readonly tgbot: TelegramBotService,
  ) {}

  @Get()
  async summary(@CurrentAdmin() admin: Admin) {
    if (!admin.tenantId) throw new BadRequestException("Do'kon topilmadi");
    return this.referral.adminSummary(admin.tenantId);
  }

  @Post('withdraw')
  @HttpCode(200)
  async withdraw(@CurrentAdmin() admin: Admin, @Body() dto: WithdrawDto) {
    if (!admin.tenantId) throw new BadRequestException("Do'kon topilmadi");
    const res = await this.referral.requestWithdrawal(admin.tenantId, dto.cardNumber, dto.cardHolder);

    // Platforma jamoasiga (super-admin) xabar
    const t = await this.prisma.tenant.findUnique({
      where: { id: admin.tenantId },
      select: { shopName: true, ownerName: true, ownerPhone: true, ownerUsername: true },
    });
    const fmt = (n: number) => n.toLocaleString('ru-RU').replace(/,/g, ' ');
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const caption =
      `💸 <b>Referal yechish so'rovi</b>\n\n` +
      `🏪 <b>${esc(t?.shopName ?? '—')}</b> — ${esc(t?.ownerName ?? '—')}\n` +
      `💳 <code>${esc(dto.cardNumber)}</code>${dto.cardHolder ? ` (${esc(dto.cardHolder)})` : ''}\n` +
      `💰 Summa: <b>${fmt(res.amount)} so'm</b>\n` +
      (t?.ownerPhone ? `📞 ${esc(t.ownerPhone)}\n` : '') +
      (t?.ownerUsername ? `🔗 @${esc(t.ownerUsername)}` : '');
    await this.tgbot.sendToSupportChat(caption).catch(() => undefined);

    return { ok: true, amount: res.amount };
  }
}
