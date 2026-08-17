import { Module } from '@nestjs/common';
import { UploadsModule } from '../uploads/uploads.module';
import { TelegramBotModule } from '../telegram-bot/telegram-bot.module';
import { ReferralModule } from '../referral/referral.module';
import { SellerController } from './seller.controller';
import { SellerOnboardingService } from './seller.service';

@Module({
  imports: [UploadsModule, TelegramBotModule, ReferralModule],
  controllers: [SellerController],
  providers: [SellerOnboardingService],
})
export class PublicModule {}
