import { Body, Controller, Headers, HttpCode, Logger, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Update } from 'grammy/types';
import { TelegramBotService } from './telegram-bot.service';

@Controller('telegram')
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);
  private readonly secret: string;

  constructor(private readonly bot: TelegramBotService, config: ConfigService) {
    this.secret = config.getOrThrow<string>('TELEGRAM_WEBHOOK_SECRET');
  }

  /**
   * Telegram webhook handler.
   * To'g'ridan-to'g'ri bot.handleUpdate ishlatamiz (grammY express adapter o'rniga),
   * chunki NestJS @Body() avtomatik parse qiladi va response handling biz nazoratimizda.
   */
  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Headers('x-telegram-bot-api-secret-token') token: string,
    @Body() update: Update,
  ): Promise<{ ok: true }> {
    if (token !== this.secret) {
      throw new UnauthorizedException('Invalid secret');
    }

    try {
      await this.bot.bot?.handleUpdate(update);
    } catch (err) {
      this.logger.error(`Webhook handleUpdate failed: ${(err as Error).message}`);
      // Telegram'ga 200 qaytaramiz — qayta yuborilmasligi uchun (xato bizning kodda)
    }
    return { ok: true };
  }
}
