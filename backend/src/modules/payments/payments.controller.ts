import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { TelegramAuthGuard } from '../auth/telegram-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PaymeService } from './payme.service';
import { ClickService } from './click.service';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payme: PaymeService,
    private readonly click: ClickService,
  ) {}

  /** Payme Merchant API (JSON-RPC). URL Payme kabinetida sozlanadi. */
  @Post('payme/:tenantId')
  @HttpCode(200)
  paymeWebhook(
    @Param('tenantId') tenantId: string,
    @Headers('authorization') auth: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.payme.handle(tenantId, auth, body);
  }

  /** Click Prepare URL */
  @Post('click/prepare')
  @HttpCode(200)
  clickPrepare(@Body() body: Record<string, string>) {
    return this.click.prepare(body);
  }

  /** Click Complete URL */
  @Post('click/complete')
  @HttpCode(200)
  clickComplete(@Body() body: Record<string, string>) {
    return this.click.complete(body);
  }

  /** Mijoz uchun to'lov havolasini yaratadi (Payme yoki Click). */
  @Get('checkout')
  @UseGuards(TelegramAuthGuard)
  async checkout(
    @CurrentUser() user: User,
    @Query('orderId') orderId: string,
    @Query('provider') provider: string,
  ) {
    const order = await this.prisma.numberOrder.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== user.id) throw new NotFoundException('Buyurtma topilmadi');
    if (order.paidAt) throw new BadRequestException('Buyurtma allaqachon to\'langan');
    if (!order.tenantId) throw new BadRequestException('Do\'kon topilmadi');
    const t = await this.prisma.tenant.findUnique({ where: { id: order.tenantId } });
    if (!t) throw new BadRequestException('Do\'kon topilmadi');
    const amount = Number(order.retailPrice);

    if (provider === 'payme') {
      if (!t.paymeMerchantId) throw new BadRequestException('Payme sozlanmagan');
      const payload = `m=${t.paymeMerchantId};ac.order_id=${order.id};a=${Math.round(amount * 100)}`;
      const url = `https://checkout.paycom.uz/${Buffer.from(payload).toString('base64')}`;
      return { url };
    }
    if (provider === 'click') {
      if (!t.clickServiceId || !t.clickMerchantId) throw new BadRequestException('Click sozlanmagan');
      const url =
        `https://my.click.uz/services/pay?service_id=${t.clickServiceId}` +
        `&merchant_id=${t.clickMerchantId}&amount=${amount}&transaction_param=${order.id}`;
      return { url };
    }
    throw new BadRequestException('Noma\'lum to\'lov turi');
  }
}
