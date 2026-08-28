import { Module } from '@nestjs/common';
import { ReferralModule } from '../referral/referral.module';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramOrdersListener } from './telegram-orders.listener';
import { TelegramSupportListener } from './telegram-support.listener';
import { TelegramPaymentsListener } from './telegram-payments.listener';
import { TelegramPaycfmListener } from './telegram-paycfm.listener';
import { SaleReviewListener } from './sale-review.listener';
import { TelegramOrderPaidListener } from './telegram-order-paid.listener';
import { TenantBotService } from './tenant-bot.service';
import { TenantWebhookController } from './tenant-webhook.controller';

@Module({
  imports: [ReferralModule],
  controllers: [TelegramWebhookController, TenantWebhookController],
  providers: [
    TelegramBotService,
    TelegramOrdersListener,
    TelegramSupportListener,
    TelegramPaymentsListener,
    TelegramPaycfmListener,
    SaleReviewListener,
    TelegramOrderPaidListener,
    TenantBotService,
  ],
  exports: [TelegramBotService, TenantBotService],
})
export class TelegramBotModule {}
