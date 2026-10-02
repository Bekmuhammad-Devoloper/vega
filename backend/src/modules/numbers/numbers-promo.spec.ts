import { BadRequestException } from '@nestjs/common';
import { NumbersService } from './numbers.service';

/** Promokod bilan raqam xaridi: chegirma, limitni band qilish, xato kodda xarid yo'q. */
function make(opts: { promoError?: boolean; discount?: number } = {}) {
  const calls = { buy: 0, debit: 0, consumed: 0, created: null as null | Record<string, unknown> };
  const tx = {
    user: {
      updateMany: async (a: { data: { balance: { decrement: number } } }) => {
        calls.debit = a.data.balance.decrement;
        return { count: 1 };
      },
    },
    numberOrder: {
      create: async (a: { data: Record<string, unknown> }) => {
        calls.created = a.data;
        return { id: 'o1', ...a.data };
      },
    },
    numberOrderEvent: { create: async () => ({}) },
    tenant: { update: async () => ({}) },
  };
  const prisma = {
    resellerOffer: {
      findUnique: async () => ({
        isActive: true, markupUzs: 1000, retailPrice: 7000,
        service: { slug: 'telegram' }, country: { slug: 'uz', iso2: 'UZ' },
      }),
    },
    user: { findUnique: async () => ({ id: 'u1', balance: 100000 }) },
    $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
  };
  const catalog = {
    assertCanSell: async () => undefined,
    quoteFor: async () => ({ provider: 'LZT', totalUzs: 7800, costUsd: 0.5 }),
  };
  const providers = {
    buy: async () => {
      calls.buy++;
      return { providerId: 'p1', phone: '+998901234567', costUsd: 0.5, expiresAt: new Date() };
    },
    cancel: async () => undefined,
  };
  const promos = {
    evaluate: async () => {
      if (opts.promoError) throw new BadRequestException('Bunday promokod topilmadi');
      return { promo: { id: 'pr1', code: 'SALE' }, discountAmount: opts.discount ?? 2000 };
    },
    consume: async () => {
      calls.consumed++;
    },
  };
  const svc = new NumbersService(
    prisma as never, catalog as never, providers as never, {} as never, {} as never,
    { emit: () => true } as never, {} as never, {} as never, promos as never,
  );
  return { svc, calls };
}

const base = { tenantId: 't1', userId: 'u1', serviceId: 's1', countryId: 'c1' };

describe('Promokod bilan xarid', () => {
  it('chegirma narxdan ayriladi va promokod band qilinadi', async () => {
    const { svc, calls } = make({ discount: 2000 });
    await svc.createOrder({ ...base, promoCode: 'sale' });
    expect(calls.debit).toBe(6800); // 7800 + 1000 = 8800 - 2000
    expect(calls.created?.retailPrice).toBe(6800);
    expect(calls.created?.promoCodeId).toBe('pr1');
    expect(calls.consumed).toBe(1);
  });

  it('noto\'g\'ri promokodda provayderdan raqam OLINMAYDI', async () => {
    const { svc, calls } = make({ promoError: true });
    await expect(svc.createOrder({ ...base, promoCode: 'XATO' })).rejects.toThrow('promokod');
    expect(calls.buy).toBe(0);
  });

  it('chegirma narxdan katta bo\'lsa — 0 so\'m, manfiy emas', async () => {
    const { svc, calls } = make({ discount: 50000 });
    await svc.createOrder({ ...base, promoCode: 'ALL' });
    expect(calls.debit).toBe(0);
  });

  it('promokodsiz — oddiy narx', async () => {
    const { svc, calls } = make();
    await svc.createOrder(base);
    expect(calls.debit).toBe(8800);
    expect(calls.consumed).toBe(0);
  });
});
