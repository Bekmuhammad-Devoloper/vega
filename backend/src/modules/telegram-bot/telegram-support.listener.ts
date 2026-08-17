import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@/prisma/prisma.service';
import { TelegramBotService } from './telegram-bot.service';

@Injectable()
export class TelegramSupportListener {
  private readonly logger = new Logger(TelegramSupportListener.name);

  constructor(
    private readonly bot: TelegramBotService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('support.ticket_created', { async: true })
  async handleNewTicket(payload: { ticketId: string }): Promise<void> {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: payload.ticketId },
      include: { user: true },
    });
    if (!ticket) return;
    const userLine = ticket.user.username
      ? `@${ticket.user.username}`
      : ticket.user.firstName ?? `ID ${ticket.user.telegramId}`;
    const text = `🆘 <b>Yangi support tiket</b>\n\n` +
      `<b>Foydalanuvchi:</b> ${userLine}\n` +
      `<b>Mavzu:</b> ${ticket.subject}\n\n` +
      `${ticket.message}`;
    try {
      await this.bot.sendToSupportChat(text);
    } catch (err) {
      this.logger.warn(`Failed to forward support ticket: ${(err as Error).message}`);
    }
  }
}
