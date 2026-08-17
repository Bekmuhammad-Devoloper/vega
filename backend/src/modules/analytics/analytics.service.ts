import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventType, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

export interface IncomingEvent {
  type: EventType;
  /** Xizmat (Telegram/WhatsApp...) — eski `productId` maydoni bilan mos. */
  productId?: string;
  /** Davlat — eski `categoryId` maydoni bilan mos. */
  categoryId?: string;
  payload?: Record<string, unknown>;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async record(userId: string, event: IncomingEvent, tenantId?: string | null): Promise<void> {
    try {
      const created = await this.prisma.userEvent.create({
        data: {
          userId,
          tenantId: tenantId ?? null,
          type: event.type,
          serviceId: event.productId,
          countryId: event.categoryId,
          payload: event.payload as Prisma.InputJsonValue | undefined,
        },
      });
      this.events.emit('user.event', { id: created.id, userId, tenantId, ...event });
    } catch (err) {
      this.logger.warn(`Failed to record event: ${(err as Error).message}`);
    }
  }

  async recordBatch(userId: string, batch: IncomingEvent[], tenantId?: string | null): Promise<void> {
    if (batch.length === 0) return;
    await this.prisma.userEvent.createMany({
      data: batch.map((e) => ({
        userId,
        tenantId: tenantId ?? null,
        type: e.type,
        serviceId: e.productId,
        countryId: e.categoryId,
        payload: e.payload as Prisma.InputJsonValue | undefined,
      })),
    });
    // Emit individually for admin live feed (lightweight)
    for (const e of batch) {
      this.events.emit('user.event', { userId, tenantId, ...e });
    }
  }

  async cleanupOld(retentionDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const result = await this.prisma.userEvent.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return result.count;
  }
}
