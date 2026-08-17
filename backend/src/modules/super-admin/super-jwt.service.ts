import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import type { PlatformRole } from '@prisma/client';

export interface SuperAccessPayload {
  sub: string;
  email: string;
  role: PlatformRole;
  type: 'super-access';
}

export interface SuperRefreshPayload {
  sub: string;
  jti: string;
  type: 'super-refresh';
}

export interface SuperTempPayload {
  sub: string;
  type: 'super-temp';
}

@Injectable()
export class SuperJwtService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly tempSecret: string;
  private readonly accessTtl: string;
  private readonly refreshTtl: string;

  constructor(config: ConfigService) {
    // Alohida secretlar — admin token bilan kesishmasin
    this.accessSecret = config.get('SUPER_JWT_ACCESS_SECRET') ?? config.getOrThrow('JWT_ACCESS_SECRET') + ':super';
    this.refreshSecret = config.get('SUPER_JWT_REFRESH_SECRET') ?? config.getOrThrow('JWT_REFRESH_SECRET') + ':super';
    this.tempSecret = this.accessSecret + ':temp';
    this.accessTtl = config.get('SUPER_JWT_ACCESS_TTL') ?? '15m';
    this.refreshTtl = config.get('SUPER_JWT_REFRESH_TTL') ?? '7d';
  }

  signAccess(payload: Omit<SuperAccessPayload, 'type'>): string {
    return jwt.sign({ ...payload, type: 'super-access' }, this.accessSecret, {
      expiresIn: this.accessTtl,
    } as jwt.SignOptions);
  }

  signRefresh(payload: Omit<SuperRefreshPayload, 'type'>): string {
    return jwt.sign({ ...payload, type: 'super-refresh' }, this.refreshSecret, {
      expiresIn: this.refreshTtl,
    } as jwt.SignOptions);
  }

  signTemp(payload: Omit<SuperTempPayload, 'type'>): string {
    return jwt.sign({ ...payload, type: 'super-temp' }, this.tempSecret, {
      expiresIn: '5m',
    } as jwt.SignOptions);
  }

  verifyAccess(token: string): SuperAccessPayload {
    const payload = jwt.verify(token, this.accessSecret) as SuperAccessPayload;
    if (payload.type !== 'super-access') throw new Error('Invalid token type');
    return payload;
  }

  verifyRefresh(token: string): SuperRefreshPayload {
    const payload = jwt.verify(token, this.refreshSecret) as SuperRefreshPayload;
    if (payload.type !== 'super-refresh') throw new Error('Invalid token type');
    return payload;
  }

  verifyTemp(token: string): SuperTempPayload {
    const payload = jwt.verify(token, this.tempSecret) as SuperTempPayload;
    if (payload.type !== 'super-temp') throw new Error('Invalid token type');
    return payload;
  }

  refreshTtlMs(): number {
    return parseTtl(this.refreshTtl);
  }
}

function parseTtl(s: string): number {
  const m = /^(\d+)([smhd])$/.exec(s);
  if (!m) return 7 * 24 * 60 * 60 * 1000;
  const n = Number(m[1]);
  switch (m[2]) {
    case 's': return n * 1000;
    case 'm': return n * 60_000;
    case 'h': return n * 3_600_000;
    case 'd': return n * 86_400_000;
    default: return 7 * 24 * 60 * 60 * 1000;
  }
}
