import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SpiderAdapter } from './spider.adapter';
import { HeroSmsAdapter } from './herosms.adapter';
import { FragmentAdapter } from './fragment.adapter';
import { MockAdapter } from './mock.adapter';
import { SmmProvider } from './smm.provider';
import { TelegramGiftProvider } from './telegram-gift.provider';
import { IstarProvider } from './istar.provider';
import { LztProvider } from './lzt.provider';
import { LztAdapter } from './lzt.adapter';
import { TelegramUserbotProvider } from './telegram-userbot.provider';
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
    LztProvider,
    LztAdapter,
    TelegramUserbotProvider,
    ProvidersService,
  ],
  exports: [
    ProvidersService,
    SmmProvider,
    TelegramGiftProvider,
    IstarProvider,
    LztProvider,
    TelegramUserbotProvider,
  ],
})
export class ProvidersModule {}
