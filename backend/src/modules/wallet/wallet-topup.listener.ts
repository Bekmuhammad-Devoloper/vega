import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@/prisma/prisma.service';
import { TelegramBotService } from '../telegram-bot/telegram-bot.service';
import { WalletService } from './wallet.service';

/// Admin bot kanalidagi "Tasdiqlash / Rad etish" tugmalari (hamyon to'ldirish).
/// Bot callback -> 'topup-callback' hodisa -> shu listener hamyonga kredit qiladi.
interface TopupCallback {
  action: 'approve' | 'reject';
  invoiceId: string;
  ctx?: {
    from?: { username?: string; first_name?: string };
    callbackQuery?: { message?: { caption?: string } };
    editMessageCaption?: (opts: {
      caption: string;
      parse_mode?: string;
    }) => Promise<unknown>;
    editMessageReplyMarkup?: () => Promise<unknown>;
  };
}

function money(n: number): string {
  return n.toLocaleString('ru-RU').replace(/,/g, ' ');
}

@Injectable()
export class WalletTopupListener implements OnModuleInit {
  private readonly logger = new Logger(WalletTopupListener.name);

  constructor(
    private readonly bot: TelegramBotService,
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly wallet: WalletService,
  ) {}

  onModuleInit(): void {
    this.bot.setCallbackEmitter(this.events);
    this.events.on('topup-callback', async (p: TopupCallback) => {
      try {
        await this.handle(p);
      } catch (err) {
        this.logger.error(`Topup callback failed: ${(err as Error).message}`);
      }
    });
  }

  private async handle({ action, invoiceId, ctx }: TopupCallback): Promise<void> {
    let ok = false;
    let errMsg = '';
    try {
      if (action === 'approve') {
        const r = await this.wallet.approveTopup(invoiceId);
        const t = await this.prisma.tenant.findUnique({
          where: { id: r.tenantId },
          select: { ownerTelegramId: true },
        });
        if (t?.ownerTelegramId) {
          await this.bot.sendDirectMessage(
            t.ownerTelegramId,
            `✅ <b>Hamyoningiz to'ldirildi!</b>\n\n` +
              `💵 +${money(r.amount)} so'm\n` +
              `💼 Yangi balans: <b>${money(r.balance)} so'm</b>\n\n` +
              `Endi mijozlarga raqam sota olasiz.`,
          );
        }
      } else {
        const r = await this.wallet.rejectTopup(invoiceId, 'Kanaldan rad etildi');
        const t = await this.prisma.tenant.findUnique({
          where: { id: r.tenantId },
          select: { ownerTelegramId: true },
        });
        if (t?.ownerTelegramId) {
          await this.bot.sendDirectMessage(
            t.ownerTelegramId,
            `❌ <b>To'ldirish rad etildi.</b>\n\n` +
              `${money(r.amount)} so'm — chek tasdiqlanmadi. ` +
              `Iltimos, to'lovni tekshiring yoki support bilan bog'laning.`,
          );
        }
      }
      ok = true;
    } catch (err) {
      errMsg = (err as Error).message;
      this.logger.warn(`Topup ${action} ${invoiceId}: ${errMsg}`);
    }

    // Kanaldagi xabar captionini natija bilan belgilash
    try {
      const by = ctx?.from?.username
        ? `@${ctx.from.username}`
        : (ctx?.from?.first_name ?? '');
      const cap = ctx?.callbackQuery?.message?.caption ?? '';
      if (ok) {
        // Muvaffaqiyat — yakuniy holat, tugmalarni olib tashlaymiz
        const label = action === 'approve' ? '✅ TASDIQLANDI' : '❌ RAD ETILDI';
        await ctx?.editMessageCaption?.({
          caption: `${cap}\n\n<b>${label}</b>${by ? ` — ${by}` : ''}`,
          parse_mode: 'HTML',
        });
        await ctx?.editMessageReplyMarkup?.();
      } else {
        // Xato (masalan platforma balansi yetmadi) — tugmalar qoladi, qayta urinsin
        await ctx?.editMessageCaption?.({
          caption: `${cap}\n\n⚠️ <b>${errMsg || 'Xatolik'}</b>`,
          parse_mode: 'HTML',
        });
      }
    } catch {
      // muhim emas
    }
  }
}
