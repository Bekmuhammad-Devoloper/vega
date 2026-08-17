import { Module } from '@nestjs/common';
import { NumbersService } from './numbers.service';
import { NumbersController } from './numbers.controller';
import { CatalogModule } from '../catalog/catalog.module';
import { ProvidersModule } from '../providers/providers.module';
import { WalletModule } from '../wallet/wallet.module';
import { AuthModule } from '../auth/auth.module';
import { UploadsModule } from '../uploads/uploads.module';
import { TelegramBotModule } from '../telegram-bot/telegram-bot.module';

@Module({
  imports: [
    CatalogModule,
    ProvidersModule,
    WalletModule,
    AuthModule,
    UploadsModule,
    TelegramBotModule,
  ],
  providers: [NumbersService],
  controllers: [NumbersController],
  exports: [NumbersService],
})
export class NumbersModule {}
