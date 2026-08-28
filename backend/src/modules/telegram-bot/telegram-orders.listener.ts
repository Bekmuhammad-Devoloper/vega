import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { NumberOrderStatus, PaymentMethod } from '@prisma/client';
import { InlineKeyboard } from 'grammy';
import { PrismaService } from '@/prisma/prisma.service';
import { TelegramBotService } from './telegram-bot.service';
import { TenantBotService } from './tenant-bot.service';

@Injectable()
export class TelegramOrdersListener implements OnModuleInit {
  private readonly logger = new Logger(TelegramOrdersListener.name);

  /**
   * orderId → kanaldagi xabar message_id. NumberOrder'да `channelMessageId`
   * maydoni yo'q — holat o'zgarganda xabarni tahrirlash uchun jarayon ichida
   * saqlaymiz (restart'да yo'qoladi — u holda faqat mijozga xabar boradi).
   */
  private readonly channelMessages = new Map<string, number>();

  constructor(
    private readonly bot: TelegramBotService,
    private readonly tenantBot: TenantBotService,
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Mijozга xabar yuboradi — avval do'kon (sotuvchi) boti orqali, ulanmagan
   * bo'lsa global botiga fallback. Mijoz do'konni o'z boti orqali
   * ochgani uchun xabar shu botdan kelishi to'g'ri.
   */
  private async notifyCustomer(
    tenantId: string | null,
    telegramId: bigint,
    text: string,
  ): Promise<void> {
    const sent = await this.tenantBot.sendToCustomer(tenantId, telegramId, text);
    if (!sent) await this.bot.sendDirectMessage(telegramId, text);
  }

  onModuleInit(): void {
    this.bot.setCallbackEmitter(this.events);
    this.events.on(
      'callback',
      async (payload: { action: string; orderId: string; ctx: unknown }) => {
        try {
          await this.handleCallback(payload.action, payload.orderId);
        } catch (err) {
          this.logger.error(`Callback handling failed: ${(err as Error).message}`);
        }
      },
    );
  }

  private statusEmoji(status: NumberOrderStatus): string {
    switch (status) {
      case 'WAITING_CODE':
        return '⏳';
      case 'RECEIVED':
        return '✅';
      case 'CANCELLED':
        return '❌';
      case 'EXPIRED':
        return '⌛';
      case 'ERROR':
        return '⚠️';
      default:
        return '•';
    }
  }

  private statusLabel(status: NumberOrderStatus): string {
    switch (status) {
      case 'WAITING_CODE':
        return 'Kod kutilmoqda';
      case 'RECEIVED':
        return 'Kod keldi';
      case 'CANCELLED':
        return 'Bekor qilindi';
      case 'EXPIRED':
        return 'Muddati tugadi';
      case 'ERROR':
        return 'Xatolik';
      default:
        return status;
    }
  }

  private formatPaymentMethod(pm: PaymentMethod): string {
    switch (pm) {
      case 'BALANCE':
        return 'Balans';
      case 'PAYME':
        return 'Payme';
      case 'CLICK':
        return 'Click';
      case 'CARD_TRANSFER':
        return "Karta o'tkazma";
      case 'MANUAL':
        return "Qo'lda";
      default:
        return pm;
    }
  }

  private formatMoney(n: number | string): string {
    const v = Number(n);
    return v.toLocaleString('ru-RU').replace(/,/g, ' ') + ' so\'m';
  }

  private buildChannelMessage(order: {
    id: string;
    orderNumber: string;
    status: NumberOrderStatus;
    paymentMethod: PaymentMethod;
    phone: string;
    code: string | null;
    retailPrice: number | string;
    createdAt: Date;
    service: { nameUz: string; emoji: string | null };
    country: { nameUz: string; flag: string };
    user: { telegramId: bigint; username: string | null; firstName: string | null };
  }): { text: string; keyboard: InlineKeyboard } {
    const userLine = order.user.username
      ? `@${order.user.username}`
      : order.user.firstName ?? `ID ${order.user.telegramId}`;

    const date = order.createdAt.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const serviceLabel = `${order.service.emoji ? `${order.service.emoji} ` : ''}${order.service.nameUz}`;
    const countryLabel = `${order.country.flag} ${order.country.nameUz}`;

    const text =
      `${this.statusEmoji(order.status)} <b>Buyurtma #${order.orderNumber}</b> — ${this.statusLabel(order.status)}\n\n` +
      `<b>Xizmat:</b> ${serviceLabel}\n` +
      `<b>Davlat:</b> ${countryLabel}\n` +
      `<b>Raqam:</b> <code>${order.phone}</code>\n` +
      `<b>Mijoz:</b> ${userLine}\n` +
      `<b>To'lov:</b> ${this.formatPaymentMethod(order.paymentMethod)}\n` +
      `<b>Narx:</b> ${this.formatMoney(order.retailPrice)}\n` +
      (order.code ? `<b>Kod:</b> <code>${order.code}</code>\n` : '') +
      `\n<i>${date}</i>`;

    const keyboard = new InlineKeyboard();
    // Raqam-buyurtmasida sotuvchi qo'lda faqat bekor qila oladi (kod kutilayotganda).
    if (order.status === 'WAITING_CODE') {
      keyboard.text('❌ Bekor qilish', `order:cancel:${order.id}`);
    }
    return { text, keyboard };
  }

  @OnEvent('order.created', { async: true })
  async onOrderCreated(payload: { orderId: string }): Promise<void> {
    const order = await this.prisma.numberOrder.findUnique({
      where: { id: payload.orderId },
      include: { user: true, service: true, country: true },
    });
    if (!order) return;
    const { text, keyboard } = this.buildChannelMessage({
      ...order,
      retailPrice: Number(order.retailPrice),
    });
    // Buyurtma kartochkasi DO'KONNING O'Z kanaliga tushadi. Ilgari bu bitta
    // GLOBAL kanalga borardi va do'konlar bir-birining buyurtmalarini ko'rardi.
    // Kanal sozlanmagan bo'lsa — hech qayerga yuborilmaydi (opt-in).
    try {
      const messageId = await this.tenantBot.sendOrderToChannel(order.tenantId, text, keyboard);
      if (messageId) this.channelMessages.set(order.id, messageId);
    } catch (err) {
      this.logger.error(`Failed to post order to channel: ${(err as Error).message}`);
    }

    // Mijozga xabar (do'kon boti orqali)
    await this.notifyCustomer(
      order.tenantId,
      order.user.telegramId,
      `✅ <b>Buyurtmangiz qabul qilindi!</b>\n\n` +
        `Raqami: <b>#${order.orderNumber}</b>\n` +
        `Xizmat: ${order.service.emoji ? `${order.service.emoji} ` : ''}${order.service.nameUz}\n` +
        `Raqam: <b>${order.phone}</b>\n` +
        `Narx: <b>${this.formatMoney(Number(order.retailPrice))}</b>\n\n` +
        `SMS kodi kelishi bilan sizga yuboramiz.`,
    );
  }

  @OnEvent('order.status_changed', { async: true })
  async onOrderStatusChanged(payload: { orderId: string }): Promise<void> {
    const order = await this.prisma.numberOrder.findUnique({
      where: { id: payload.orderId },
      include: { user: true, service: true, country: true },
    });
    if (!order) return;

    const messageId = this.channelMessages.get(order.id);
    if (messageId) {
      const { text, keyboard } = this.buildChannelMessage({
        ...order,
        retailPrice: Number(order.retailPrice),
      });
      // Kartochka do'konning O'Z kanalida — tahrirlash ham o'sha yerda.
      await this.tenantBot.editOrderChannelMessage(order.tenantId, messageId, text, keyboard);
    }

    const userMessages: Record<NumberOrderStatus, string | null> = {
      WAITING_CODE: null,
      RECEIVED: order.code
        ? `✅ <b>Kod keldi!</b>\n\nBuyurtma <b>#${order.orderNumber}</b>\nRaqam: <b>${order.phone}</b>\nKod: <code>${order.code}</code>`
        : `✅ Buyurtmangiz #${order.orderNumber} uchun kod keldi.`,
      CANCELLED: `❌ Buyurtmangiz #${order.orderNumber} bekor qilindi. Mablag' qaytarildi.`,
      EXPIRED: `⌛ Buyurtmangiz #${order.orderNumber} muddati tugadi — kod kelmadi. Mablag' qaytarildi.`,
      ERROR: `⚠️ Buyurtmangiz #${order.orderNumber} bo'yicha xatolik yuz berdi. Sotuvchi bilan bog'laning.`,
    };
    const msg = userMessages[order.status];
    if (msg) await this.notifyCustomer(order.tenantId, order.user.telegramId, msg);
  }

  private async handleCallback(action: string, orderId: string): Promise<void> {
    // Raqam-buyurtmasida provayder oqimi holatni boshqaradi; kanaldan faqat
    // qo'lда bekor qilish mumkin (kod hali kutilayotganда).
    if (action !== 'cancel') return;

    const order = await this.prisma.numberOrder.findUnique({ where: { id: orderId } });
    if (!order || order.status !== 'WAITING_CODE') return;

    await this.prisma.numberOrder.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        events: { create: { status: 'CANCELLED', comment: 'Kanal tugmasi: bekor qilindi' } },
      },
    });

    // tenantId SHART: admin socket'i hodisani faqat SHU do'kon xonasiga yuboradi.
    this.events.emit('order.status_changed', {
      orderId,
      status: 'CANCELLED',
      tenantId: order.tenantId,
    });
  }
}
