import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '../admin-auth/jwt.service';

const ADMIN_ROOM = 'admin-live';

@WebSocketGateway({
  namespace: '/admin',
  cors: { origin: true, credentials: true },
})
@Injectable()
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer() server!: Server;

  constructor(private readonly jwt: JwtService) {}

  private extractToken(client: Socket): string | undefined {
    const authToken = client.handshake.auth?.token as string | undefined;
    if (authToken) return authToken;
    const queryToken = client.handshake.query?.token as string | undefined;
    if (queryToken) return queryToken;
    const cookie = client.handshake.headers.cookie ?? '';
    const match = /access_token=([^;]+)/.exec(cookie);
    return match?.[1];
  }

  handleConnection(client: Socket): void {
    const token = this.extractToken(client);
    if (!token) {
      this.logger.warn(`Socket reject (no token): ${client.id}`);
      client.disconnect(true);
      return;
    }
    try {
      const payload = this.jwt.verifyAccess(token);
      client.data.adminId = payload.sub;
      client.data.role = payload.role;
      client.join(ADMIN_ROOM);
      this.logger.debug(`Admin socket connected: ${client.id} (admin=${payload.sub})`);
      client.emit('connected', { ok: true });
    } catch {
      this.logger.warn(`Socket reject (invalid token): ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Admin socket disconnected: ${client.id}`);
  }

  emitToAdmins(event: string, payload: unknown): void {
    this.server?.to(ADMIN_ROOM).emit(event, payload);
  }

  @OnEvent('user.event')
  onUserEvent(payload: unknown): void {
    this.emitToAdmins('user-event', payload);
  }

  @OnEvent('order.created')
  onOrderCreated(payload: unknown): void {
    this.emitToAdmins('order-created', payload);
  }

  @OnEvent('order.status_changed')
  onOrderStatusChanged(payload: unknown): void {
    this.emitToAdmins('order-status-changed', payload);
  }

  @OnEvent('support.ticket_created')
  onSupportTicket(payload: unknown): void {
    this.emitToAdmins('support-new-ticket', payload);
  }
}
