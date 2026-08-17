import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { PlatformAdmin, PlatformRole } from '@prisma/client';
import { SuperJwtService } from './super-jwt.service';
import { SuperAuthService } from './super-auth.service';

export interface SuperAuthedRequest extends Request {
  platformAdmin?: PlatformAdmin;
}

@Injectable()
export class SuperJwtGuard implements CanActivate {
  constructor(
    private readonly jwt: SuperJwtService,
    private readonly auth: SuperAuthService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<SuperAuthedRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Missing token');
    const token = header.slice(7);

    let payload;
    try {
      payload = this.jwt.verifyAccess(token);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    const admin = await this.auth.getById(payload.sub);
    if (!admin || !admin.isActive) throw new UnauthorizedException('Admin not found');
    req.platformAdmin = admin;
    return true;
  }
}

// ─── Roles guard ───────────────────────────────────────────────
const PLATFORM_ROLES_KEY = 'platformRoles';
export const PlatformRoles = (...roles: PlatformRole[]) =>
  SetMetadata(PLATFORM_ROLES_KEY, roles);

@Injectable()
export class PlatformRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PlatformRole[]>(PLATFORM_ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const req = ctx.switchToHttp().getRequest<SuperAuthedRequest>();
    if (!req.platformAdmin) throw new UnauthorizedException();
    // OWNER hammasiga ruxsat
    if (req.platformAdmin.role === 'OWNER') return true;
    return required.includes(req.platformAdmin.role);
  }
}

// ─── @CurrentPlatformAdmin() decorator ─────────────────────────
export const CurrentPlatformAdmin = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): PlatformAdmin => {
    const req = ctx.switchToHttp().getRequest<SuperAuthedRequest>();
    if (!req.platformAdmin) throw new UnauthorizedException();
    return req.platformAdmin;
  },
);
