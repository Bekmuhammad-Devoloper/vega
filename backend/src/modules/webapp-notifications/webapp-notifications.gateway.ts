import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';

/**
 * Foydalanuvchi WebApp uchun real-time gateway.
 * Namespace: /user
 * Auth: handshake.auth.initData (Telegram WebApp initData)
 *
 * Per-user rooms: `user:<userId>` (faqat o'zining order/support yangiliklari)
 * Global broadcast rooms: `all` (mahsulotlar, kategoriyalar, bannerlar)
 */
@WebSocketGateway({
  namespace: '/user',
  cors: { origin: true, credentials: true },
})
@Injectable()
export class WebAppNotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(WebAppNotificationsGateway.name);

  @WebSocketServer() server!: Server;

  constructor(private readonly auth: AuthService) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const initData =
        (client.handshake.auth?.initData as string | undefined) ??
        (client.handshake.query?.initData as string | undefined);

      let userId: string | null = null;
      if (initData) {
        try {
          const user = await this.auth.authenticate(initData);
          userId = user.id;
        } catch {
          // Dev mode bypass — devLogin via guard
        }
      }

      // Dev mode'da initData yo'q bo'lsa ham ulanish mumkin (faqat broadcast eshitadi)
      client.join('all');
      if (userId) {
        client.join(`user:${userId}`);
        client.data.userId = userId;
        this.logger.debug(`User socket connected: ${userId}`);
      } else {
        this.logger.debug(`Anonymous user socket: ${client.id} (broadcast only)`);
      }
      client.emit('connected', { ok: true, userId });
    } catch (err) {
      this.logger.warn(`User socket connection failed: ${(err as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    if (client.data?.userId) {
      this.logger.debug(`User socket disconnected: ${client.data.userId}`);
    }
  }

  /** Foydalanuvchining buyurtmasi status o'zgardi (admin tomonidan) */
  @OnEvent('user.order.status_changed')
  onOrderStatus(payload: { userId: string; orderId: string; status: string; orderNumber: string }) {
    this.server?.to(`user:${payload.userId}`).emit('order:status_changed', payload);
  }

  /** Support tiketga admin javob berdi */
  @OnEvent('user.support.response')
  onSupportResponse(payload: { userId: string; ticketId: string }) {
    this.server?.to(`user:${payload.userId}`).emit('support:new_response', payload);
  }

  /** Mahsulot yangilandi/o'chirildi — barcha userlarga */
  @OnEvent('product.updated')
  onProductUpdated(payload: { productId: string }) {
    this.server?.to('all').emit('product:updated', payload);
  }

  @OnEvent('product.deleted')
  onProductDeleted(payload: { productId: string }) {
    this.server?.to('all').emit('product:deleted', payload);
  }

  @OnEvent('product.created')
  onProductCreated(payload: { productId: string }) {
    this.server?.to('all').emit('product:created', payload);
  }

  @OnEvent('categories.invalidate')
  onCategoriesInvalidate() {
    this.server?.to('all').emit('categories:invalidate', {});
  }

  @OnEvent('banners.invalidate')
  onBannersInvalidate() {
    this.server?.to('all').emit('banners:invalidate', {});
  }

  @OnEvent('promo-codes.invalidate')
  onPromoInvalidate() {
    this.server?.to('all').emit('promo-codes:invalidate', {});
  }
}
