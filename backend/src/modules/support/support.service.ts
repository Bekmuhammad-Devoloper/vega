import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async create(
    userId: string,
    input: { subject: string; message: string },
    tenantId?: string | null,
  ) {
    const ticket = await this.prisma.supportTicket.create({
      data: { userId, tenantId: tenantId ?? null, subject: input.subject, message: input.message },
    });
    this.events.emit('support.ticket_created', { ticketId: ticket.id });
    return ticket;
  }

  async listMy(userId: string) {
    return this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { responses: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async getMy(userId: string, id: string) {
    return this.prisma.supportTicket.findFirst({
      where: { id, userId },
      include: { responses: { orderBy: { createdAt: 'asc' } } },
    });
  }
}
