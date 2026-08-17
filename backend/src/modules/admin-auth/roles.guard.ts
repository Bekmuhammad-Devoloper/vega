import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole, type Admin } from '@prisma/client';

const ROLES_KEY = 'admin_roles';

export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<AdminRole[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;
    const req = ctx.switchToHttp().getRequest<{ admin?: Admin }>();
    if (!req.admin) throw new ForbiddenException('No admin');
    if (!roles.includes(req.admin.role)) throw new ForbiddenException('Insufficient role');
    return true;
  }
}

export const CurrentAdmin = (() => {
  const { createParamDecorator } = require('@nestjs/common');
  return createParamDecorator((_data: unknown, ctx: ExecutionContext): Admin => {
    return ctx.switchToHttp().getRequest<{ admin: Admin }>().admin;
  });
})();
