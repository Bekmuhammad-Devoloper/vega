import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@/prisma/prisma.service';
import { TenantBotService } from './tenant-bot.service';

/**
 * `sale.completed` hodisasini tinglaydi va har muvaffaqiyatli sotuvni
 * reseller'ning "otziv" kanaliga chiroyli e'lon (ijtimoiy isbot) sifatida
 * joylaydi. Xato bo'lsa — jim (faqat log): otziv sotuv oqimini buzmasin.
 */
@Injectable()
export class SaleReviewListener {
  private readonly logger = new Logger(SaleReviewListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantBot: TenantBotService,
  ) {}

  @OnEvent('sale.completed', { async: true })
  async onSale({
    orderId,
    kind,
  }: {
    orderId: string;
    kind: 'NUMBER' | 'DIGITAL';
  }): Promise<void> {
    try {
      if (kind === 'NUMBER') {
        const order = await this.prisma.numberOrder.findUnique({
          where: { id: orderId },
          include: { service: true, country: true, user: true },
        });
        if (!order) return;
        await this.tenantBot.sendSaleReview(order.tenantId, {
          type: 'NUMBER',
          orderNumber: order.orderNumber,
          price: Number(order.retailPrice),
          phone: order.phone,
          serviceName: order.service.nameUz,
          serviceEmoji: order.service.emoji,
          countryName: order.country.nameUz,
          countryFlag: order.country.flag,
          buyerUsername: order.user.username,
          buyerTelegramId: order.user.telegramId,
        });
      } else {
        const order = await this.prisma.digitalOrder.findUnique({
          where: { id: orderId },
          include: { digitalProduct: true, user: true },
        });
        if (!order) return;
        await this.tenantBot.sendSaleReview(order.tenantId, {
          type: 'DIGITAL',
          kind: order.kind,
          orderNumber: order.orderNumber,
          price: Number(order.retailPrice),
          username: order.username,
          label: order.digitalProduct.label,
          buyerUsername: order.user.username,
          buyerTelegramId: order.user.telegramId,
        });
      }
    } catch (err) {
      this.logger.warn(`sale.completed listener xatosi: ${(err as Error).message}`);
    }
  }
}
