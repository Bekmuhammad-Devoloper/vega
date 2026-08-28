import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@/prisma/prisma.service';
import { TenantBotService } from './tenant-bot.service';

interface OrderPaidEvent {
  orderId: string;
  provider: 'PAYME' | 'CLICK';
}

/** Chek/tranzaksiya izohida ishlatiladigan belgi — takror ishlovni aniqlash uchun. */
const PAID_COMMENT_PREFIX = "Onlayn to'lov qabul qilindi";

/**
 * Onlayn to'lov (Payme/Click) tasdiqlangach bajariladigan ishlar.
 *
 * Ilgari `order.paid` hodisasini HECH KIM tinglamasdi: Payme/Click faqat
 * `paidAt` ni yozardi, mijoz esa to'lov o'tgani haqida hech qanday xabar
 * olmasdi va admin panelida hech narsa jonlanmasdi. Bu yerda qo'lda chek
 * tasdiqlash yo'li (`handlePaymentCallback`) bilan bir xil ishlar bajariladi.
 *
 * DIQQAT — daromad hisobi bu yerda YANGILANMAYDI: `Tenant.totalRevenue`
 * sotuv yakunlanganda (`numbers.service` / `digital.service`) hisoblanadi.
 * Bu yerda ham qo'shsak, summa ikki marta sanalardi.
 */
@Injectable()
export class TelegramOrderPaidListener {
  private readonly logger = new Logger(TelegramOrderPaidListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantBot: TenantBotService,
    private readonly events: EventEmitter2,
  ) {}

  @OnEvent('order.paid', { async: true })
  async onOrderPaid({ orderId, provider }: OrderPaidEvent): Promise<void> {
    try {
      const order = await this.prisma.numberOrder.findUnique({
        where: { id: orderId },
        include: { user: true, service: true, country: true },
      });
      if (!order) return;

      // IDEMPOTENTLIK: Payme "Perform" ni qayta yuborishi mumkin. Shu buyurtma
      // uchun to'lov yozuvi allaqachon bo'lsa — mijozga ikkinchi marta xabar
      // yubormaymiz.
      const already = await this.prisma.numberOrderEvent.findFirst({
        where: { orderId, comment: { startsWith: PAID_COMMENT_PREFIX } },
        select: { id: true },
      });
      if (already) return;

      await this.prisma.numberOrderEvent.create({
        data: {
          orderId,
          status: order.status,
          comment: `${PAID_COMMENT_PREFIX} (${provider})`,
        },
      });

      // Admin paneli + mijoz WebApp real-time.
      this.events.emit('order.status_changed', {
        orderId,
        status: order.status,
        tenantId: order.tenantId,
      });
      this.events.emit('user.order.status_changed', {
        userId: order.userId,
        orderId,
        status: order.status,
        orderNumber: order.orderNumber,
      });

      // Mijozga tasdiq xabari — do'konning O'Z boti orqali.
      if (order.user?.telegramId) {
        const price = new Intl.NumberFormat('ru-RU').format(Number(order.retailPrice));
        const svc = `${order.service.emoji ? `${order.service.emoji} ` : ''}${order.service.nameUz}`;
        const text =
          `✅ <b>To'lovingiz qabul qilindi!</b>\n\n` +
          `Buyurtma <b>#${order.orderNumber}</b> — ${price} so'm (${provider})\n` +
          `${svc} — ${order.country.flag} ${order.country.nameUz}\n` +
          (order.phone ? `Raqam: <b>${order.phone}</b>\n` : '') +
          `\nSMS kodi kelishi bilan shu yerda yuboramiz.`;
        await this.tenantBot.sendToCustomer(order.tenantId, order.user.telegramId, text);
      }
    } catch (err) {
      // To'lov allaqachon o'tgan — bu yerdagi xato uni bekor qilmasligi kerak.
      this.logger.error(`order.paid ishlovi xatosi (${orderId}): ${(err as Error).message}`);
    }
  }
}
