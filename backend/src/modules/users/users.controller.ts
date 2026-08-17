import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Language, type User } from '@prisma/client';
import { TelegramAuthGuard } from '../auth/telegram-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UsersService } from './users.service';

class UpdateMeDto {
  @IsOptional() @IsEnum(Language) language?: Language;
  @IsOptional() @IsString() @Matches(/^\+?\d{9,15}$/) phone?: string;
  @IsOptional() @IsString() @MaxLength(60) firstName?: string;
}

function serialize(user: User) {
  return {
    id: user.id,
    telegramId: user.telegramId.toString(),
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    photoUrl: user.photoUrl,
    phone: user.phone,
    language: user.language,
    balance: Number(user.balance),
    createdAt: user.createdAt,
  };
}

@Controller('users')
@UseGuards(TelegramAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: User) {
    return serialize(user);
  }

  @Patch('me')
  async updateMe(@CurrentUser() user: User, @Body() dto: UpdateMeDto) {
    const updated = await this.users.updateMe(user.id, dto);
    return serialize(updated);
  }
}
