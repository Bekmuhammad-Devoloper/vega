import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { PlatformAdmin, Prisma } from '@prisma/client';

export interface AuditPayload {
  action: string;
  targetType?: string;
  targetId?: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class SuperAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(admin: PlatformAdmin, payload: AuditPayload): Promise<void> {
    await this.prisma.platformAuditLog.create({
      data: {
        adminId: admin.id,
        action: payload.action,
        targetType: payload.targetType ?? null,
        targetId: payload.targetId ?? null,
        changes: (payload.changes as Prisma.InputJsonValue | undefined) ?? undefined,
        ipAddress: payload.ipAddress ?? null,
        userAgent: payload.userAgent?.slice(0, 500) ?? null,
      },
    });
  }
}
