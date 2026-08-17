import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Request, Response } from 'express';
import type { Admin } from '@prisma/client';
import {
  InvalidInitDataError,
  verifyTelegramInitData,
} from '@/common/helpers/telegram-init-data';
import { AdminAuthService } from './admin-auth.service';
import { AdminJwtGuard } from './admin-jwt.guard';
import { CurrentAdmin } from './roles.guard';

class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(6) password!: string;
}

class TelegramLoginDto {
  @IsString() @MaxLength(4096) initData!: string;
  /** Bot rejimi: /start → owner, /creator → creator, /moderator → moderator. */
  @IsOptional() @IsIn(['owner', 'creator', 'moderator']) mode?: 'owner' | 'creator' | 'moderator';
}

class SwitchStoreDto {
  @IsString() @MaxLength(40) tenantId!: string;
}

interface CookieRequest extends Request {
  cookies: Record<string, string | undefined>;
}

function serialize(a: Admin) {
  return {
    id: a.id,
    email: a.email,
    fullName: a.fullName,
    role: a.role,
    isActive: a.isActive,
    createdAt: a.createdAt,
  };
}

@Controller('admin/auth')
export class AdminAuthController {
  private readonly isProd: boolean;
  private readonly botToken: string;
  constructor(private readonly auth: AdminAuthService, config: ConfigService) {
    this.isProd = config.get('NODE_ENV') === 'production';
    this.botToken = config.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
  }

  private setCookies(res: Response, accessToken: string, refreshToken: string, expiresAt: Date) {
    const common = {
      httpOnly: true,
      secure: this.isProd,
      sameSite: this.isProd ? ('none' as const) : ('lax' as const),
      path: '/',
    };
    res.cookie('access_token', accessToken, { ...common, maxAge: 15 * 60 * 1000 });
    res.cookie('refresh_token', refreshToken, {
      ...common,
      expires: expiresAt,
      path: '/api/admin/auth',
    });
  }

  private clearCookies(res: Response) {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/api/admin/auth' });
  }

  @Post('login')
  @Throttle({ default: { limit: 8, ttl: 60_000 } }) // brute-force: 8/min/IP
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { admin, tokens } = await this.auth.login(dto.email, dto.password);
    this.setCookies(res, tokens.accessToken, tokens.refreshToken, tokens.expiresAt);
    return { admin: serialize(admin), accessToken: tokens.accessToken };
  }

  /** Telegram Mini App orqali parolsiz login (bot'dan ochilganda). */
  @Post('telegram')
  @HttpCode(200)
  async telegramLogin(@Body() dto: TelegramLoginDto, @Res({ passthrough: true }) res: Response) {
    let parsed;
    try {
      parsed = verifyTelegramInitData(dto.initData, this.botToken);
    } catch (err) {
      throw new UnauthorizedException(
        err instanceof InvalidInitDataError ? err.message : 'Telegram tekshiruvi xato',
      );
    }
    const { admin, tokens } = await this.auth.loginWithTelegram(
      BigInt(parsed.user.id),
      dto.mode,
      parsed.user.photo_url ?? null,
    );
    this.setCookies(res, tokens.accessToken, tokens.refreshToken, tokens.expiresAt);
    return { admin: serialize(admin), accessToken: tokens.accessToken };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: CookieRequest, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies['refresh_token'];
    if (!refreshToken) {
      this.clearCookies(res);
      return { error: 'no refresh token' };
    }
    const tokens = await this.auth.refresh(refreshToken);
    this.setCookies(res, tokens.accessToken, tokens.refreshToken, tokens.expiresAt);
    return { accessToken: tokens.accessToken };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: CookieRequest, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies['refresh_token'];
    await this.auth.logout(refreshToken);
    this.clearCookies(res);
    return { ok: true };
  }

  /** Boshqa do'koniga o'tish (bir egada bir nechta do'kon bo'lsa) — yangi token beradi. */
  @Post('switch-store')
  @HttpCode(200)
  @UseGuards(AdminJwtGuard)
  async switchStore(
    @CurrentAdmin() current: Admin,
    @Body() dto: SwitchStoreDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { admin, tokens } = await this.auth.switchStore(current, dto.tenantId);
    this.setCookies(res, tokens.accessToken, tokens.refreshToken, tokens.expiresAt);
    return { admin: serialize(admin), accessToken: tokens.accessToken };
  }

  @Get('me')
  @UseGuards(AdminJwtGuard)
  me(@CurrentAdmin() admin: Admin) {
    return serialize(admin);
  }
}
