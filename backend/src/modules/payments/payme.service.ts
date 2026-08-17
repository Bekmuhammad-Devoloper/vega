import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@/prisma/prisma.service';

/** Payme Merchant API (JSON-RPC) — har sotuvchi o'z merchant hisobi bilan. */

const PaymeError = {
  Auth: { code: -32504, message: 'Авторизация не пройдена' },
  MethodNotFound: { code: -32601, message: 'Метод не найден' },
  InvalidAmount: { code: -31001, message: { ru: "Noto'g'ri summa", uz: "Noto'g'ri summa", en: 'Invalid amount' } },
  TxNotFound: { code: -31003, message: { ru: 'Tranzaksiya topilmadi', uz: 'Tranzaksiya topilmadi', en: 'Transaction not found' } },
  CantPerform: { code: -31008, message: { ru: 'Amalni bajarib bo\'lmaydi', uz: 'Amalni bajarib bo\'lmaydi', en: 'Unable to perform operation' } },
  OrderNotFound: {
    code: -31050,
    message: { ru: 'Buyurtma topilmadi', uz: 'Buyurtma topilmadi', en: 'Order not found' },
  },
};

interface JsonRpcReq {
  method?: string;
  params?: Record<string, unknown>;
  id?: number | string;
}

@Injectable()
export class PaymeService {
  private readonly logger = new Logger(PaymeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** Controller'dan: tenantId (URL), Authorization header, JSON-RPC body. */
  async handle(tenantId: string, authHeader: string | undefined, body: JsonRpcReq) {
    const id = body.id ?? null;
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, paymeKey: true },
    });
    if (!tenant?.paymeKey || !this.checkAuth(authHeader, tenant.paymeKey)) {
      return { error: PaymeError.Auth, id };
    }
    const params = body.params ?? {};
    try {
      switch (body.method) {
        case 'CheckPerformTransaction':
          return { result: await this.checkPerform(tenant.id, params), id };
        case 'CreateTransaction':
          return { result: await this.createTransaction(tenant.id, params), id };
        case 'PerformTransaction':
          return { result: await this.performTransaction(tenant.id, params), id };
        case 'CancelTransaction':
          return { result: await this.cancelTransaction(tenant.id, params), id };
        case 'CheckTransaction':
          return { result: await this.checkTransaction(params), id };
        case 'GetStatement':
          return { result: await this.getStatement(tenant.id, params), id };
        default:
          return { error: PaymeError.MethodNotFound, id };
      }
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err) return { error: err, id };
      this.logger.error(`Payme error: ${(err as Error).message}`);
      return { error: PaymeError.CantPerform, id };
    }
  }

  private checkAuth(header: string | undefined, key: string): boolean {
    if (!header?.startsWith('Basic ')) return false;
    try {
      const decoded = Buffer.from(header.slice(6), 'base64').toString('utf-8');
      const pass = decoded.split(':')[1] ?? '';
      return pass === key;
    } catch {
      return false;
    }
  }

  private orderIdFrom(params: Record<string, unknown>): string {
    const acc = (params.account ?? {}) as Record<string, unknown>;
    return String(acc.order_id ?? acc.orderId ?? '');
  }

  /** Buyurtmani topib, summa mosligini tekshiradi (tiyin). */
  private async loadOrder(tenantId: string, params: Record<string, unknown>) {
    const orderId = this.orderIdFrom(params);
    const order = await this.prisma.numberOrder.findFirst({
      where: { id: orderId, tenantId },
    });
    if (!order) throw PaymeError.OrderNotFound;
    const expected = Math.round(Number(order.retailPrice) * 100);
    if (typeof params.amount === 'number' && params.amount !== expected) {
      throw PaymeError.InvalidAmount;
    }
    return order;
  }

  private async checkPerform(tenantId: string, params: Record<string, unknown>) {
    const order = await this.loadOrder(tenantId, params);
    if (order.paidAt) throw PaymeError.CantPerform;
    return { allow: true };
  }

  private async createTransaction(tenantId: string, params: Record<string, unknown>) {
    const paymeId = String(params.id);
    const existing = await this.prisma.paymentTransaction.findUnique({
      where: { provider_providerTxId: { provider: 'PAYME', providerTxId: paymeId } },
    });
    if (existing) {
      if (existing.state !== 1) throw PaymeError.CantPerform;
      return {
        create_time: Number(existing.createTime),
        transaction: existing.id,
        state: 1,
      };
    }
    const order = await this.loadOrder(tenantId, params);
    if (order.paidAt) throw PaymeError.CantPerform;
    // Bitta buyurtmaga bitta faol tranzaksiya
    const active = await this.prisma.paymentTransaction.findFirst({
      where: { orderId: order.id, provider: 'PAYME', state: 1 },
    });
    if (active) throw PaymeError.CantPerform;

    const createTime = Number(params.time) || Date.now();
    const tx = await this.prisma.paymentTransaction.create({
      data: {
        tenantId,
        orderId: order.id,
        provider: 'PAYME',
        providerTxId: paymeId,
        amount: order.retailPrice,
        state: 1,
        createTime: BigInt(createTime),
      },
    });
    return { create_time: createTime, transaction: tx.id, state: 1 };
  }

  private async performTransaction(_tenantId: string, params: Record<string, unknown>) {
    const tx = await this.findTx(String(params.id));
    if (tx.state === 2) {
      return { transaction: tx.id, perform_time: Number(tx.performTime), state: 2 };
    }
    if (tx.state !== 1) throw PaymeError.CantPerform;
    const performTime = Date.now();
    await this.prisma.$transaction([
      this.prisma.paymentTransaction.update({
        where: { id: tx.id },
        data: { state: 2, performTime: BigInt(performTime) },
      }),
      this.prisma.numberOrder.update({
        where: { id: tx.orderId },
        data: { paidAt: new Date(), paymentMethod: 'PAYME' },
      }),
    ]);
    this.events.emit('order.paid', { orderId: tx.orderId, provider: 'PAYME' });
    return { transaction: tx.id, perform_time: performTime, state: 2 };
  }

  private async cancelTransaction(_tenantId: string, params: Record<string, unknown>) {
    const tx = await this.findTx(String(params.id));
    const reason = typeof params.reason === 'number' ? params.reason : null;
    if (tx.state === 1 || tx.state === 2) {
      const cancelTime = Date.now();
      const newState = tx.state === 2 ? -2 : -1;
      await this.prisma.$transaction([
        this.prisma.paymentTransaction.update({
          where: { id: tx.id },
          data: { state: newState, cancelTime: BigInt(cancelTime), reason },
        }),
        // To'langan bo'lsa — buyurtmani to'lanmagan holatga qaytaramiz
        ...(tx.state === 2
          ? [this.prisma.numberOrder.update({ where: { id: tx.orderId }, data: { paidAt: null } })]
          : []),
      ]);
      return { transaction: tx.id, cancel_time: cancelTime, state: newState };
    }
    return {
      transaction: tx.id,
      cancel_time: Number(tx.cancelTime),
      state: tx.state,
    };
  }

  private async checkTransaction(params: Record<string, unknown>) {
    const tx = await this.findTx(String(params.id));
    return {
      create_time: Number(tx.createTime) || 0,
      perform_time: Number(tx.performTime) || 0,
      cancel_time: Number(tx.cancelTime) || 0,
      transaction: tx.id,
      state: tx.state,
      reason: tx.reason ?? null,
    };
  }

  private async getStatement(tenantId: string, params: Record<string, unknown>) {
    const from = Number(params.from) || 0;
    const to = Number(params.to) || Date.now();
    const rows = await this.prisma.paymentTransaction.findMany({
      where: {
        tenantId,
        provider: 'PAYME',
        createTime: { gte: BigInt(from), lte: BigInt(to) },
      },
    });
    return {
      transactions: rows.map((t) => ({
        id: t.providerTxId,
        time: Number(t.createTime),
        amount: Math.round(Number(t.amount) * 100),
        account: { order_id: t.orderId },
        create_time: Number(t.createTime) || 0,
        perform_time: Number(t.performTime) || 0,
        cancel_time: Number(t.cancelTime) || 0,
        transaction: t.id,
        state: t.state,
        reason: t.reason ?? null,
      })),
    };
  }

  private async findTx(paymeId: string) {
    const tx = await this.prisma.paymentTransaction.findUnique({
      where: { provider_providerTxId: { provider: 'PAYME', providerTxId: paymeId } },
    });
    if (!tx) throw PaymeError.TxNotFound;
    return tx;
  }
}
