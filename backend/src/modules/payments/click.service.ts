import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createHash } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';

/** Click Merchant API (Prepare/Complete) — har sotuvchi o'z service_id bilan. */

interface ClickParams {
  click_trans_id?: string;
  service_id?: string;
  merchant_trans_id?: string; // bizning order id
  merchant_prepare_id?: string;
  amount?: string;
  action?: string;
  sign_time?: string;
  sign_string?: string;
  error?: string;
}

@Injectable()
export class ClickService {
  private readonly logger = new Logger(ClickService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  private async tenantByService(serviceId?: string) {
    if (!serviceId) return null;
    return this.prisma.tenant.findFirst({
      where: { clickServiceId: serviceId },
      select: { id: true, clickSecretKey: true },
    });
  }

  private sign(parts: (string | number | undefined)[]): string {
    return createHash('md5').update(parts.map((p) => p ?? '').join('')).digest('hex');
  }

  async prepare(p: ClickParams) {
    const tenant = await this.tenantByService(p.service_id);
    if (!tenant?.clickSecretKey) return { error: -1, error_note: 'SIGN CHECK FAILED' };

    const expected = this.sign([
      p.click_trans_id, p.service_id, tenant.clickSecretKey, p.merchant_trans_id,
      p.amount, p.action, p.sign_time,
    ]);
    if (expected !== p.sign_string) return { error: -1, error_note: 'SIGN CHECK FAILED' };

    const order = await this.prisma.numberOrder.findFirst({
      where: { id: p.merchant_trans_id, tenantId: tenant.id },
    });
    if (!order) return { error: -5, error_note: 'Order not found' };
    if (Math.round(Number(p.amount)) !== Math.round(Number(order.retailPrice))) {
      return { error: -2, error_note: 'Incorrect amount' };
    }
    if (order.paidAt) return { error: -4, error_note: 'Already paid' };

    let tx = await this.prisma.paymentTransaction.findUnique({
      where: { provider_providerTxId: { provider: 'CLICK', providerTxId: String(p.click_trans_id) } },
    });
    if (!tx) {
      tx = await this.prisma.paymentTransaction.create({
        data: {
          tenantId: tenant.id,
          orderId: order.id,
          provider: 'CLICK',
          providerTxId: String(p.click_trans_id),
          amount: order.retailPrice,
          state: 1,
          createTime: BigInt(Date.now()),
        },
      });
    }
    return {
      click_trans_id: p.click_trans_id,
      merchant_trans_id: p.merchant_trans_id,
      merchant_prepare_id: tx.id,
      error: 0,
      error_note: 'Success',
    };
  }

  async complete(p: ClickParams) {
    const tenant = await this.tenantByService(p.service_id);
    if (!tenant?.clickSecretKey) return { error: -1, error_note: 'SIGN CHECK FAILED' };

    const expected = this.sign([
      p.click_trans_id, p.service_id, tenant.clickSecretKey, p.merchant_trans_id,
      p.merchant_prepare_id, p.amount, p.action, p.sign_time,
    ]);
    if (expected !== p.sign_string) return { error: -1, error_note: 'SIGN CHECK FAILED' };

    const tx = await this.prisma.paymentTransaction.findUnique({
      where: { provider_providerTxId: { provider: 'CLICK', providerTxId: String(p.click_trans_id) } },
    });
    if (!tx || tx.id !== p.merchant_prepare_id) {
      return { error: -6, error_note: 'Transaction not found' };
    }

    // Click tomonidan xato/bekor
    if (p.error && Number(p.error) < 0) {
      if (tx.state === 1) {
        await this.prisma.paymentTransaction.update({
          where: { id: tx.id },
          data: { state: -1, cancelTime: BigInt(Date.now()), reason: Number(p.error) },
        });
      }
      return { error: -9, error_note: 'Transaction cancelled' };
    }

    if (tx.state === 2) {
      return {
        click_trans_id: p.click_trans_id,
        merchant_trans_id: p.merchant_trans_id,
        merchant_confirm_id: tx.id,
        error: 0,
        error_note: 'Success',
      };
    }
    if (tx.state !== 1) return { error: -9, error_note: 'Transaction cancelled' };

    await this.prisma.$transaction([
      this.prisma.paymentTransaction.update({
        where: { id: tx.id },
        data: { state: 2, performTime: BigInt(Date.now()) },
      }),
      this.prisma.numberOrder.update({
        where: { id: tx.orderId },
        data: { paidAt: new Date(), paymentMethod: 'CLICK' },
      }),
    ]);
    this.events.emit('order.paid', { orderId: tx.orderId, provider: 'CLICK' });

    return {
      click_trans_id: p.click_trans_id,
      merchant_trans_id: p.merchant_trans_id,
      merchant_confirm_id: tx.id,
      error: 0,
      error_note: 'Success',
    };
  }
}
