import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { IsString } from 'class-validator';
import { AuthService } from './auth.service';
import { InvalidInitDataError } from '@/common/helpers/telegram-init-data';

class VerifyDto {
  @IsString() initData!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('telegram')
  async verify(@Body() dto: VerifyDto) {
    try {
      const user = await this.auth.authenticate(dto.initData);
      return {
        ok: true,
        user: {
          id: user.id,
          telegramId: user.telegramId.toString(),
          username: user.username,
          firstName: user.firstName,
          language: user.language,
        },
      };
    } catch (err) {
      if (err instanceof InvalidInitDataError) throw new UnauthorizedException(err.message);
      throw err;
    }
  }
}
