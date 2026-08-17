import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantBotService } from './tenant-bot.service';

/** Har sotuvchi botining webhook'i: /telegram/t/:tenantId/webhook */
@Controller('telegram/t')
export class TenantWebhookController {
  private readonly secret: string;

  constructor(
    private readonly tenantBot: TenantBotService,
    config: ConfigService,
  ) {
    this.secret = config.getOrThrow<string>('TELEGRAM_WEBHOOK_SECRET');
  }

  @Post(':tenantId/webhook')
  @HttpCode(200)
  async webhook(
    @Param('tenantId') tenantId: string,
    @Headers('x-telegram-bot-api-secret-token') token: string,
    @Body() update: unknown,
  ): Promise<{ ok: true }> {
    if (token !== this.secret) throw new UnauthorizedException('Invalid secret');
    await this.tenantBot.handleUpdate(tenantId, update).catch(() => undefined);
    return { ok: true };
  }
}
