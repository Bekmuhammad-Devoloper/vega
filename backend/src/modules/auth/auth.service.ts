import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { verifyTelegramInitData } from '@/common/helpers/telegram-init-data';
import type { User } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly botToken: string;

  constructor(private readonly users: UsersService, config: ConfigService) {
    this.botToken = config.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
  }

  async authenticate(initData: string, botToken?: string): Promise<User> {
    const parsed = verifyTelegramInitData(initData, botToken || this.botToken);
    return this.users.upsertFromTelegram(parsed.user);
  }

  async devLogin(telegramId: number): Promise<User> {
    return this.users.upsertFromTelegram({
      id: telegramId,
      first_name: 'Dev',
      username: 'dev_user',
      language_code: 'uz',
    });
  }
}
