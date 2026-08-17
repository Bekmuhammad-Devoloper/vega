import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import type { AdminRole } from '@prisma/client';

export interface AccessPayload {
  sub: string;
  email: string;
  role: AdminRole;
  type: 'access';
}

export interface RefreshPayload {
  sub: string;
  jti: string;
  type: 'refresh';
}

@Injectable()
export class JwtService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtl: string;
  private readonly refreshTtl: string;

  constructor(config: ConfigService) {
    this.accessSecret = config.getOrThrow('JWT_ACCESS_SECRET');
    this.refreshSecret = config.getOrThrow('JWT_REFRESH_SECRET');
    this.accessTtl = config.get('JWT_ACCESS_TTL') ?? '15m';
    this.refreshTtl = config.get('JWT_REFRESH_TTL') ?? '30d';
  }

  signAccess(payload: Omit<AccessPayload, 'type'>): string {
    return jwt.sign({ ...payload, type: 'access' }, this.accessSecret, {
      expiresIn: this.accessTtl,
    } as jwt.SignOptions);
  }

  signRefresh(payload: Omit<RefreshPayload, 'type'>): string {
    return jwt.sign({ ...payload, type: 'refresh' }, this.refreshSecret, {
      expiresIn: this.refreshTtl,
    } as jwt.SignOptions);
  }

  verifyAccess(token: string): AccessPayload {
    const payload = jwt.verify(token, this.accessSecret) as AccessPayload;
    if (payload.type !== 'access') throw new Error('Invalid token type');
    return payload;
  }

  verifyRefresh(token: string): RefreshPayload {
    const payload = jwt.verify(token, this.refreshSecret) as RefreshPayload;
    if (payload.type !== 'refresh') throw new Error('Invalid token type');
    return payload;
  }

  refreshTtlMs(): number {
    return parseTtl(this.refreshTtl);
  }
}

function parseTtl(s: string): number {
  const m = /^(\d+)([smhd])$/.exec(s);
  if (!m) return 30 * 24 * 60 * 60 * 1000;
  const n = Number(m[1]);
  switch (m[2]) {
    case 's': return n * 1000;
    case 'm': return n * 60_000;
    case 'h': return n * 3_600_000;
    case 'd': return n * 86_400_000;
    default: return 30 * 24 * 60 * 60 * 1000;
  }
}
