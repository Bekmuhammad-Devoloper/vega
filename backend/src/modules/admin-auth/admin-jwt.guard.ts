import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from './jwt.service';
import { PrismaService } from '@/prisma/prisma.service';
import type { Admin } from '@prisma/client';

@Injectable()
export class AdminJwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      cookies?: Record<string, string | undefined>;
      admin?: Admin;
    }>();

    const auth = req.headers['authorization'];
    let token: string | undefined;
    if (auth && auth.startsWith('Bearer ')) token = auth.slice(7);
    if (!token) token = req.cookies?.['access_token'];
    if (!token) throw new UnauthorizedException('No access token');

    let payload;
    try {
      payload = this.jwt.verifyAccess(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    const admin = await this.prisma.admin.findUnique({ where: { id: payload.sub } });
    if (!admin || !admin.isActive) throw new UnauthorizedException('Admin not found or inactive');
    req.admin = admin;
    return true;
  }
}
