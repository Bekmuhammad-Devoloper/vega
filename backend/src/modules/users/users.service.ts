import { Injectable } from '@nestjs/common';
import { Language, type User } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { ParsedInitDataUser } from '@/common/helpers/telegram-init-data';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertFromTelegram(tg: ParsedInitDataUser): Promise<User> {
    const defaultLanguage = tg.language_code === 'ru' ? Language.ru : Language.uz;
    return this.prisma.user.upsert({
      where: { telegramId: BigInt(tg.id) },
      update: {
        username: tg.username ?? null,
        firstName: tg.first_name ?? null,
        lastName: tg.last_name ?? null,
        photoUrl: tg.photo_url ?? null,
        lastSeenAt: new Date(),
      },
      create: {
        telegramId: BigInt(tg.id),
        username: tg.username ?? null,
        firstName: tg.first_name ?? null,
        lastName: tg.last_name ?? null,
        photoUrl: tg.photo_url ?? null,
        language: defaultLanguage,
      },
    });
  }

  async getById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async updateMe(
    id: string,
    data: { language?: Language; phone?: string | null; firstName?: string | null },
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        language: data.language,
        phone: data.phone,
        firstName: data.firstName,
      },
    });
  }
}
