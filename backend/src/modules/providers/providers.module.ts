import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SpiderAdapter } from './spider.adapter';
import { HeroSmsAdapter } from './herosms.adapter';
import { FragmentAdapter } from './fragment.adapter';
import { MockAdapter } from './mock.adapter';
import { SmmProvider } from './smm.provider';
import { TelegramGiftProvider } from './telegram-gift.provider';
import { IstarProvider } from './istar.provider';
import { ProvidersService } from './providers.service';

@Module({
  imports: [ConfigModule],
  providers: [
    SpiderAdapter,
    HeroSmsAdapter,
    FragmentAdapter,
    MockAdapter,
    SmmProvider,
    TelegramGiftProvider,
    IstarProvider,
    ProvidersService,
  ],
  exports: [ProvidersService, SmmProvider, TelegramGiftProvider, IstarProvider],
})
export class ProvidersModule {}
