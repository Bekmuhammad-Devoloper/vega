import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { TelegramBotModule } from '../telegram-bot/telegram-bot.module';
import { ReferralModule } from './referral.module';
import { AdminReferralController } from './admin-referral.controller';

@Module({
  imports: [AdminAuthModule, TelegramBotModule, ReferralModule],
  controllers: [AdminReferralController],
})
export class AdminReferralModule {}
