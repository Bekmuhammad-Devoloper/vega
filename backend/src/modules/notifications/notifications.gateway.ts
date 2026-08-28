import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '../admin-auth/jwt.service';
import { PrismaService } from '@/prisma/prisma.service';

/**
 * Do'kon egasi socket'i.
 *
 * DIQQAT — ko'p-ijarachi izolyatsiya: ilgari HAMMA admin bitta `admin-live`
 * xonasiga qo'shilardi, ya'ni har bir do'kon egasi BOSHQA do'konlarning
 * buyurtmalari, mijoz harakatlari va support murojaatlarini jonli ko'rib
 * turardi. Endi har bir admin faqat O'Z do'koni xonasiga qo'shiladi va
 * hodisalar shu xonagagina yuboriladi.
 */
const roomFor = (tenantId: string): string => `admin-live:${tenantId}`;
/** Platforma egalari (tenantId yo'q) — hamma do'konni kuzatadi. */
const PLATFORM_ROOM = 'admin-live:platform';

/** Hodisa yuki qaysi do'konga tegishli ekanini bildirishi kerak. */
type TenantScoped = { tenantId?: string | null };

@WebSocketGateway({
  namespace: '/admin',
  cors: { origin: true, credentials: true },
})
@Injectable()
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer() server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  private extractToken(client: Socket): string | undefined {
    const authToken = client.handshake.auth?.token as string | undefined;
    if (authToken) return authToken;
    const queryToken = client.handshake.query?.token as string | undefined;
    if (queryToken) return queryToken;
    const cookie = client.handshake.headers.cookie ?? '';
    const match = /access_token=([^;]+)/.exec(cookie);
    return match?.[1];
  }

  async handleConnection(client: Socket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) {
      this.logger.warn(`Socket reject (no token): ${client.id}`);
      client.disconnect(true);
      return;
    }
    try {
      const payload = this.jwt.verifyAccess(token);
      // Tenant JWT'da yo'q — HTTP guard'i kabi bazadan o'qiymiz. Bu bir
      // ULANISHGA bitta so'rov (har xabarga emas), shu bois arzon.
      const admin = await this.prisma.admin.findUnique({
        where: { id: payload.sub },
        select: { id: true, tenantId: true, isActive: true },
      });
      if (!admin || !admin.isActive) {
        this.logger.warn(`Socket reject (admin not found/inactive): ${client.id}`);
        client.disconnect(true);
        return;
      }

      client.data.adminId = admin.id;
      client.data.role = payload.role;
      client.data.tenantId = admin.tenantId;
      client.join(admin.tenantId ? roomFor(admin.tenantId) : PLATFORM_ROOM);

      this.logger.debug(
        `Admin socket connected: ${client.id} (admin=${admin.id} tenant=${admin.tenantId ?? 'platform'})`,
      );
      client.emit('connected', { ok: true });
    } catch {
      this.logger.warn(`Socket reject (invalid token): ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Admin socket disconnected: ${client.id}`);
  }

  /**
   * Hodisani FAQAT tegishli do'kon xonasiga yuboradi.
   * tenantId noma'lum bo'lsa — hech kimga yubormaymiz (fail-closed). Ilgari
   * bunday hodisa HAMMAGA ketardi; jim tushib qolish sizib chiqishdan yaxshi,
   * shuning uchun ogohlantirish yozamiz.
   */
  private emitToTenant(tenantId: string | null | undefined, event: string, payload: unknown): void {
    if (!this.server) return;
    if (!tenantId) {
      this.logger.warn(`'${event}' hodisasida tenantId yo'q — yuborilmadi`);
      return;
    }
    this.server.to(roomFor(tenantId)).emit(event, payload);
    // Platforma egalari hamma do'konni kuzatadi.
    this.server.to(PLATFORM_ROOM).emit(event, payload);
  }

  @OnEvent('user.event')
  onUserEvent(payload: TenantScoped): void {
    this.emitToTenant(payload?.tenantId, 'user-event', payload);
  }

  @OnEvent('order.status_changed')
  onOrderStatusChanged(payload: TenantScoped): void {
    this.emitToTenant(payload?.tenantId, 'order-status-changed', payload);
  }

  @OnEvent('support.ticket_created')
  onSupportTicket(payload: TenantScoped): void {
    this.emitToTenant(payload?.tenantId, 'support-new-ticket', payload);
  }
}
