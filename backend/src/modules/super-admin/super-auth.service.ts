import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { SuperJwtService } from './super-jwt.service';
import type { PlatformAdmin } from '@prisma/client';

export interface SuperAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface LoginResult {
  admin: PlatformAdmin;
  tokens?: SuperAuthTokens;
  requires2FA?: boolean;
  tempToken?: string;
}

@Injectable()
export class SuperAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: SuperJwtService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async login(
    email: string,
    password: string,
    ip?: string,
    userAgent?: string,
  ): Promise<LoginResult> {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (!admin || !admin.isActive) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    // Agar 2FA yoqilgan bo'lsa — temp token qaytaramiz
    if (admin.twoFactorEnabled) {
      const tempToken = this.jwt.signTemp({ sub: admin.id });
      return { admin, requires2FA: true, tempToken };
    }

    const tokens = await this.issueTokens(admin, ip, userAgent);
    return { admin, tokens };
  }

  async verify2FA(
    tempToken: string,
    code: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{ admin: PlatformAdmin; tokens: SuperAuthTokens }> {
    let payload;
    try {
      payload = this.jwt.verifyTemp(tempToken);
    } catch {
      throw new UnauthorizedException('Invalid temp token');
    }

    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id: payload.sub },
    });
    if (!admin || !admin.isActive || !admin.twoFactorSecret) {
      throw new UnauthorizedException('Invalid admin');
    }

    const valid = await this.verifyTotpCode(admin.twoFactorSecret, code);
    if (!valid) throw new UnauthorizedException('Invalid 2FA code');

    const tokens = await this.issueTokens(admin, ip, userAgent);
    return { admin, tokens };
  }

  async issueTokens(
    admin: PlatformAdmin,
    ip?: string,
    userAgent?: string,
  ): Promise<SuperAuthTokens> {
    const jti = randomUUID();
    const accessToken = this.jwt.signAccess({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    });
    const refreshToken = this.jwt.signRefresh({ sub: admin.id, jti });
    const ttl = this.jwt.refreshTtlMs();
    const expiresAt = new Date(Date.now() + ttl);

    await this.prisma.platformRefreshToken.create({
      data: {
        adminId: admin.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
        ipAddress: ip,
        userAgent: userAgent?.slice(0, 500),
      },
    });

    await this.prisma.platformAdmin.update({
      where: { id: admin.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ip ?? null,
      },
    });

    return { accessToken, refreshToken, expiresAt };
  }

  async refresh(refreshToken: string, ip?: string, userAgent?: string): Promise<SuperAuthTokens> {
    let payload;
    try {
      payload = this.jwt.verifyRefresh(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.platformRefreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }
    // Rotation
    await this.prisma.platformRefreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    const admin = await this.prisma.platformAdmin.findUnique({ where: { id: payload.sub } });
    if (!admin || !admin.isActive) throw new UnauthorizedException('Admin not found');
    return this.issueTokens(admin, ip, userAgent);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.platformRefreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getById(id: string): Promise<PlatformAdmin | null> {
    return this.prisma.platformAdmin.findUnique({ where: { id } });
  }

  // TOTP verification (RFC 6238)
  private async verifyTotpCode(secret: string, code: string): Promise<boolean> {
    if (!/^\d{6}$/.test(code)) return false;
    const now = Math.floor(Date.now() / 1000 / 30);
    for (const offset of [-1, 0, 1]) {
      const expected = await this.generateTotp(secret, now + offset);
      if (expected === code) return true;
    }
    return false;
  }

  private async generateTotp(secret: string, counter: number): Promise<string> {
    const { createHmac } = await import('crypto');
    const key = Buffer.from(this.base32Decode(secret));
    const buf = Buffer.alloc(8);
    buf.writeBigInt64BE(BigInt(counter));
    const hmac = createHmac('sha1', key).update(buf).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);
    return (code % 1_000_000).toString().padStart(6, '0');
  }

  private base32Decode(s: string): Uint8Array {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleaned = s.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
    const out: number[] = [];
    let buffer = 0;
    let bits = 0;
    for (const ch of cleaned) {
      const val = alphabet.indexOf(ch);
      if (val < 0) continue;
      buffer = (buffer << 5) | val;
      bits += 5;
      if (bits >= 8) {
        bits -= 8;
        out.push((buffer >> bits) & 0xff);
      }
    }
    return new Uint8Array(out);
  }
}
