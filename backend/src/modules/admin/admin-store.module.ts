import { Module } from '@nestjs/common';
import { AdminStoreController } from './admin-store.controller';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { TelegramBotModule } from '../telegram-bot/telegram-bot.module';
import { UploadsModule } from '../uploads/uploads.module';
import { ReferralModule } from '../referral/referral.module';
import { CatalogModule } from '../catalog/catalog.module';

@Module({
  imports: [AdminAuthModule, TelegramBotModule, UploadsModule, ReferralModule, CatalogModule],
  controllers: [AdminStoreController],
})
export class AdminStoreModule {}
