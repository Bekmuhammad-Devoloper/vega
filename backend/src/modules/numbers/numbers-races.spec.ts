import { NumbersService } from './numbers.service';
import { NumberOrderStatus } from '@prisma/client';

/**
 * TG raqam oqimidagi pul-poygalari uchun testlar.
 *
 * Uch yo'l bir vaqtda ishlaydi: cron poll (20s), webapp/bot poll, mijozning
 * cancel tugmasi. Ilgari holat o'tishlari guard'siz edi:
 *  - markReceived ikki marta -> totalRevenue x2, hatto CANCELLED ustiga RECEIVED
 *  - cancel EXPIRED'dan keyin -> refund IKKI marta
 *  - parallel cancel -> refund IKKI marta
 * Bu testlar atomik "band qilish" (updateMany + status filter) ni tekshiradi.
 */

type OrderState = {
  id: string;
  status: NumberOrderStatus;
  userId: string;
  tenantId: string;
  retailPrice: number;
  profit: number;
  providerId: string;
  provider: 'SPIDER';
  expiresAt: Date;
};

function makeFakes(initialStatus: NumberOrderStatus) {
  const order: OrderState = {
    id: 'o1',
    status: initialStatus,
    userId: 'u1',
    tenantId: 't1',
    retailPrice: 15000,
    profit: 3000,
    providerId: 'hash1',
    provider: 'SPIDER',
    expiresAt: new Date('2030-01-01'),
  };

  const counters = {
    balanceIncrements: 0,
    revenueIncrements: 0,
    events: [] as string[],
  };

  const prisma: Record<string, unknown> = {
    numberOrder: {
      findUnique: async () => ({ ...order, service: {}, country: {} }),
      findFirst: async () => ({ ...order, service: {}, country: {} }),
      // Haqiqiy DB semantikasi: filter mos kelsagina yozadi va count qaytaradi.
      updateMany: async (args: {
        where: { id: string; status?: NumberOrderStatus };
        data: Partial<OrderState>;
      }) => {
        if (args.where.status && order.status !== args.where.status) {
          return { count: 0 };
        }
        Object.assign(order, args.data);
        return { count: 1 };
      },
      update: async (args: { data: Partial<OrderState> }) => {
        Object.assign(order, args.data);
        return { ...order, service: {}, country: {} };
      },
    },
    numberOrderEvent: {
      create: async (args: { data: { comment?: string } }) => {
        counters.events.push(args.data.comment ?? '');
        return {};
      },
    },
    user: {
      update: async () => {
        counters.balanceIncrements++;
        return {};
      },
    },
    tenant: {
      update: async () => {
        counters.revenueIncrements++;
        return {};
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };

  const events = { emitted: [] as string[], emit(name: string) { this.emitted.push(name); } };
  const providers = { cancel: async () => undefined };

  const svc = new NumbersService(
    prisma as never,
    {} as never, // catalog
    providers as never,
    {} as never, // wallet
    { get: () => undefined } as never, // config
    events as never,
    {} as never, // uploads
    {} as never, // tenantBot
  );

  return { svc, order, counters, events };
}

describe('NumbersService — pul poygalari', () => {
  it('markReceived ikki marta chaqirilsa daromad BIR marta oshadi', async () => {
    const { svc, counters, events } = makeFakes(NumberOrderStatus.WAITING_CODE);
    const mark = (svc as unknown as {
      markReceived: (id: string, code: string, text: string | null) => Promise<unknown>;
    }).markReceived.bind(svc);

    await mark('o1', '12345', null);
    await mark('o1', '12345', null); // ikkinchi yo'l (cron/webapp poygasi)

    expect(counters.revenueIncrements).toBe(1);
    expect(events.emitted.filter((e) => e === 'sale.completed')).toHaveLength(1);
  });

  it('CANCELLED buyurtma RECEIVED bilan USTIDAN yozilmaydi', async () => {
    const { svc, order, counters } = makeFakes(NumberOrderStatus.CANCELLED);
    const mark = (svc as unknown as {
      markReceived: (id: string, code: string, text: string | null) => Promise<unknown>;
    }).markReceived.bind(svc);

    await mark('o1', '12345', null);

    expect(order.status).toBe(NumberOrderStatus.CANCELLED); // o'zgarmadi
    expect(counters.revenueIncrements).toBe(0);
  });

  it("EXPIRED buyurtmaga cancel chaqirilsa refund BERILMAYDI (allaqachon qaytarilgan)", async () => {
    const { svc, counters } = makeFakes(NumberOrderStatus.EXPIRED);

    await svc.cancel('o1', 'u1');

    expect(counters.balanceIncrements).toBe(0);
  });

  it('parallel ikki cancel — refund FAQAT bir marta', async () => {
    const { svc, counters } = makeFakes(NumberOrderStatus.WAITING_CODE);

    await Promise.all([svc.cancel('o1', 'u1'), svc.cancel('o1', 'u1')]);

    expect(counters.balanceIncrements).toBe(1);
  });

  it('RECEIVED buyurtmani bekor qilib bo‘lmaydi', async () => {
    const { svc, counters } = makeFakes(NumberOrderStatus.RECEIVED);

    await expect(svc.cancel('o1', 'u1')).rejects.toThrow();
    expect(counters.balanceIncrements).toBe(0);
  });
});
