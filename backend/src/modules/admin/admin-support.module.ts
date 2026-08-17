import { Body, Controller, Get, Module, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import type { Admin } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { buildCursorPage } from '@/common/helpers/pagination';
import { TelegramBotService } from '../telegram-bot/telegram-bot.service';
import { TenantBotService } from '../telegram-bot/tenant-bot.service';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { Roles, RolesGuard, CurrentAdmin } from '../admin-auth/roles.guard';
import { VIEW_ROLES } from '@/common/role-groups';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { TelegramBotModule } from '../telegram-bot/telegram-bot.module';

class ListTicketsDto {
  @IsOptional() @IsIn(['open', 'answered', 'closed']) status?: 'open' | 'answered' | 'closed';
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

class ResponseDto {
  @IsString() @MinLength(1) @MaxLength(2000) message!: string;
}

class StatusDto {
  @IsIn(['open', 'answered', 'closed']) status!: 'open' | 'answered' | 'closed';
}

@Controller('admin/support/tickets')
@UseGuards(AdminJwtGuard, RolesGuard)
// Support tiketlar (o'qish + javob + status) — boss + manager + moderator. CREATOR kira olmaydi.
@Roles(...VIEW_ROLES)
class AdminSupportController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bot: TelegramBotService,
    private readonly tenantBot: TenantBotService,
    private readonly events: EventEmitter2,
  ) {}

  @Get()
  async list(@Query() q: ListTicketsDto, @CurrentAdmin() admin: Admin) {
    const limit = Math.min(Math.max(q.limit ?? 30, 1), 100);
    const take = limit + 1;
    const rows = await this.prisma.supportTicket.findMany({
      // Har do'kon faqat o'z tiketlarini ko'radi; platforma egasi (tenantId yo'q) — hammasini.
      where: {
        ...(admin.tenantId ? { tenantId: admin.tenantId } : {}),
        ...(q.status ? { status: q.status } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      include: {
        user: { select: { id: true, username: true, firstName: true, telegramId: true } },
        _count: { select: { responses: true } },
      },
    });
    return buildCursorPage(
      rows.map((t) => ({
        ...t,
        user: { ...t.user, telegramId: t.user.telegramId.toString() },
      })),
      limit,
    );
  }

  /** Yangi (javob berilmagan) tiketlar soni — nav badge uchun. */
  @Get('open-count')
  async openCount(@CurrentAdmin() admin: Admin) {
    const count = await this.prisma.supportTicket.count({
      where: { status: 'open', ...(admin.tenantId ? { tenantId: admin.tenantId } : {}) },
    });
    return { count };
  }

  @Get(':id')
  async getById(@Param('id') id: string, @CurrentAdmin() admin: Admin) {
    const t = await this.prisma.supportTicket.findFirst({
      where: { id, ...(admin.tenantId ? { tenantId: admin.tenantId } : {}) },
      include: {
        user: true,
        responses: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!t) return null;
    return { ...t, user: { ...t.user, telegramId: t.user.telegramId.toString() } };
  }

  @Post(':id/responses')
  async respond(
    @Param('id') id: string,
    @Body() dto: ResponseDto,
    @CurrentAdmin() admin: Admin,
  ) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id, ...(admin.tenantId ? { tenantId: admin.tenantId } : {}) },
      include: { user: true },
    });
    if (!ticket) return null;
    await this.prisma.supportResponse.create({
      data: { ticketId: id, fromAdmin: true, message: dto.message },
    });
    await this.prisma.supportTicket.update({
      where: { id },
      data: { status: 'answered' },
    });
    // Javob mijozга do'kon (sotuvchi) boti orqali boradi — Sellio global boti emas.
    // Tiket qaysi do'kon kontekstida ochilgan (ticket.tenantId), bo'lmasa javob
    // bergan admin'ning do'koni ishlatiladi. Bot ulanmagan bo'lsa — global botga fallback.
    const text = `📨 <b>Support javobi:</b>\n\n${dto.message}\n\n<i>Sizning tiketingiz: ${ticket.subject}</i>`;
    const tenantId = ticket.tenantId ?? admin.tenantId;
    const sent = await this.tenantBot.sendToCustomer(tenantId, ticket.user.telegramId, text);
    if (!sent) {
      await this.bot.sendDirectMessage(ticket.user.telegramId, text);
    }
    // Real-time: user'ga WebApp orqali ham xabar yuborish
    this.events.emit('user.support.response', {
      userId: ticket.userId,
      ticketId: id,
    });
    return { ok: true };
  }

  @Patch(':id')
  async patch(@Param('id') id: string, @Body() dto: StatusDto, @CurrentAdmin() admin: Admin) {
    const exists = await this.prisma.supportTicket.findFirst({
      where: { id, ...(admin.tenantId ? { tenantId: admin.tenantId } : {}) },
      select: { id: true },
    });
    if (!exists) return null;
    return this.prisma.supportTicket.update({
      where: { id },
      data: { status: dto.status },
    });
  }
}

@Module({
  imports: [AdminAuthModule, TelegramBotModule],
  controllers: [AdminSupportController],
})
export class AdminSupportModule {}
