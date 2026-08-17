import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { IsEmail, IsString, MinLength, Matches } from 'class-validator';
import type { Request, Response } from 'express';
import type { PlatformAdmin } from '@prisma/client';
import { SuperAuthService } from './super-auth.service';
import { SuperJwtGuard, CurrentPlatformAdmin } from './super-jwt.guard';
import { SuperAuditService } from './super-audit.service';

class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(6) password!: string;
}

class Verify2FADto {
  @IsString() tempToken!: string;
  @IsString() @Matches(/^\d{6}$/) code!: string;
}

interface CookieRequest extends Request {
  cookies: Record<string, string | undefined>;
}

function serialize(a: PlatformAdmin) {
  return {
    id: a.id,
    email: a.email,
    fullName: a.fullName,
    role: a.role,
    isActive: a.isActive,
    twoFactorEnabled: a.twoFactorEnabled,
    lastLoginAt: a.lastLoginAt,
    lastLoginIp: a.lastLoginIp,
    createdAt: a.createdAt,
  };
}

function clientMeta(req: Request): { ip: string; ua: string } {
  const xff = (req.headers['x-forwarded-for'] as string | undefined) ?? '';
  const ip = xff.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || '';
  const ua = (req.headers['user-agent'] as string | undefined) ?? '';
  return { ip, ua };
}

@Controller('super-admin/auth')
export class SuperAuthController {
  private readonly isProd: boolean;
  constructor(
    private readonly auth: SuperAuthService,
    private readonly audit: SuperAuditService,
    config: ConfigService,
  ) {
    this.isProd = config.get('NODE_ENV') === 'production';
  }

  private setCookies(res: Response, accessToken: string, refreshToken: string, expiresAt: Date) {
    const common = {
      httpOnly: true,
      secure: this.isProd,
      sameSite: this.isProd ? ('none' as const) : ('lax' as const),
      path: '/',
    };
    res.cookie('super_access_token', accessToken, { ...common, maxAge: 15 * 60 * 1000 });
    res.cookie('super_refresh_token', refreshToken, {
      ...common,
      expires: expiresAt,
      path: '/api/super-admin/auth',
    });
  }

  private clearCookies(res: Response) {
    res.clearCookie('super_access_token', { path: '/' });
    res.clearCookie('super_refresh_token', { path: '/api/super-admin/auth' });
  }

  @Post('login')
  @Throttle({ default: { limit: 8, ttl: 60_000 } }) // brute-force: 8/min/IP
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { ip, ua } = clientMeta(req);
    const result = await this.auth.login(dto.email, dto.password, ip, ua);

    if (result.requires2FA) {
      return {
        admin: serialize(result.admin),
        requires2FA: true,
        tempToken: result.tempToken,
      };
    }

    if (result.tokens) {
      this.setCookies(res, result.tokens.accessToken, result.tokens.refreshToken, result.tokens.expiresAt);
      await this.audit.log(result.admin, {
        action: 'auth.login',
        ipAddress: ip,
        userAgent: ua,
      });
      return {
        admin: serialize(result.admin),
        accessToken: result.tokens.accessToken,
      };
    }

    return { error: 'login failed' };
  }

  @Post('verify-2fa')
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // 2FA brute-force himoyasi
  @HttpCode(200)
  async verify2FA(
    @Body() dto: Verify2FADto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { ip, ua } = clientMeta(req);
    const { admin, tokens } = await this.auth.verify2FA(dto.tempToken, dto.code, ip, ua);
    this.setCookies(res, tokens.accessToken, tokens.refreshToken, tokens.expiresAt);
    await this.audit.log(admin, {
      action: 'auth.login.2fa',
      ipAddress: ip,
      userAgent: ua,
    });
    return { admin: serialize(admin), accessToken: tokens.accessToken };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: CookieRequest, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies['super_refresh_token'];
    if (!refreshToken) {
      this.clearCookies(res);
      return { error: 'no refresh token' };
    }
    const { ip, ua } = clientMeta(req);
    const tokens = await this.auth.refresh(refreshToken, ip, ua);
    this.setCookies(res, tokens.accessToken, tokens.refreshToken, tokens.expiresAt);
    return { accessToken: tokens.accessToken };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: CookieRequest, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies['super_refresh_token'];
    await this.auth.logout(refreshToken);
    this.clearCookies(res);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(SuperJwtGuard)
  me(@CurrentPlatformAdmin() admin: PlatformAdmin) {
    return serialize(admin);
  }
}
