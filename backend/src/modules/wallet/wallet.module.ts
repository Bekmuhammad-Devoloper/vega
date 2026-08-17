import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { WalletTopupListener } from './wallet-topup.listener';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { UploadsModule } from '../uploads/uploads.module';
import { TelegramBotModule } from '../telegram-bot/telegram-bot.module';

@Module({
  imports: [AdminAuthModule, UploadsModule, TelegramBotModule],
  providers: [WalletService, WalletTopupListener],
  controllers: [WalletController],
  exports: [WalletService],
})
export class WalletModule {}
