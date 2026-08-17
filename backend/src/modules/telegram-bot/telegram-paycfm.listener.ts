import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Context } from 'grammy';
import { TelegramBotService } from './telegram-bot.service';
import { TenantBotService } from './tenant-bot.service';

/// Mijoz to'lov chekini tasdiqlash/rad etish — FAQAT global @Vega_uzbot kanalда
/// joylaydi. Callback global botga keladi -> 'paycfm-callback' hodisa -> shu
/// listener orderId'dan tenant'ni topib, tenant-bot logikasini chaqiradi.
interface PaycfmCallback {
  action: 'approve' | 'reject';
  orderId: string;
  ctx: Context;
}

interface BaltopCallback {
  action: 'approve' | 'reject';
  topupId: string;
  ctx: Context;
}

@Injectable()
export class TelegramPaycfmListener implements OnModuleInit {
  private readonly logger = new Logger(TelegramPaycfmListener.name);

  constructor(
    private readonly bot: TelegramBotService,
    private readonly tenantBot: TenantBotService,
    private readonly events: EventEmitter2,
  ) {}

  onModuleInit(): void {
    this.bot.setCallbackEmitter(this.events);
    this.events.on('paycfm-callback', async (p: PaycfmCallback) => {
      try {
        await this.tenantBot.handlePaymentCallbackByOrder(
          p.action,
          p.orderId,
          p.ctx,
        );
      } catch (err) {
        this.logger.error(`Paycfm callback failed: ${(err as Error).message}`);
      }
    });

    this.events.on('baltop-callback', async (p: BaltopCallback) => {
      try {
        await this.tenantBot.handleBalanceTopupCallback(
          p.action,
          p.topupId,
          p.ctx,
        );
      } catch (err) {
        this.logger.error(`Baltop callback failed: ${(err as Error).message}`);
      }
    });
  }
}
