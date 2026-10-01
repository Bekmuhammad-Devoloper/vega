import { LztAdapter } from './lzt.adapter';

/**
 * Spamli / spamsiz — IKKI ALOHIDA bozor qatlami (raqobatchi botdagi kabi):
 * spam-blokli akkauntlar ancha arzon va alohida narxda sotiladi.
 * Bu testlar qatlamlar ARALASHIB ketmasligini tekshiradi: narx ham,
 * zaxira keshi ham, xarid ham o'z qatlamidan olinishi shart.
 */
describe('LztAdapter — spamli/spamsiz qatlamlar', () => {
  function makeAdapter() {
    const calls: Array<{ iso: string; spam: boolean }> = [];
    const lzt = {
      isConfigured: () => true,
      searchTelegram: async (iso: string, spam = false) => {
        calls.push({ iso, spam });
        // Spamli — arzon (10 ₽), spamsiz — qimmat (90 ₽)
        const price = spam ? 10 : 90;
        return {
          items: [
            { itemId: spam ? 111 : 999, priceRub: price, title: 't', origin: 'autoreg', guaranteeHours: null, publishedAt: null },
          ],
          total: 1,
        };
      },
      buy: async (itemId: number, priceRub: number) => ({
        itemId, priceRub, phone: '+998901234567', giftLink: null,
      }),
    };
    // RUB_TO_UZS=150, USD_TO_UZS=15000 -> 1 RUB = 0.01 USD (hisob oson)
    const config = {
      get: (k: string) => (k === 'RUB_TO_UZS' ? '150' : k === 'USD_TO_UZS' ? '15000' : undefined),
    };
    const adapter = new LztAdapter(lzt as never, config as never);
    return { adapter, calls };
  }

  it('narx: telegram_spam ARZON qatlamdan, telegram TOZA qatlamdan olinadi', async () => {
    const { adapter } = makeAdapter();

    const clean = await adapter.getPriceUsd({
      serviceSlug: 'telegram', countrySlug: 'uzbekistan', countryIso2: 'UZ',
    });
    const spam = await adapter.getPriceUsd({
      serviceSlug: 'telegram_spam', countrySlug: 'uzbekistan', countryIso2: 'UZ',
    });

    expect(clean).toBeCloseTo(0.9); // 90 RUB * 0.01
    expect(spam).toBeCloseTo(0.1);  // 10 RUB * 0.01 — ancha arzon
  });

  it('kesh qatlamlari ARALASHMAYDI: har qatlam o‘z so‘rovini yuboradi', async () => {
    const { adapter, calls } = makeAdapter();

    await adapter.getPriceUsd({ serviceSlug: 'telegram', countrySlug: 'x', countryIso2: 'UZ' });
    await adapter.getPriceUsd({ serviceSlug: 'telegram_spam', countrySlug: 'x', countryIso2: 'UZ' });
    // Takror chaqiruvlar keshdan — yangi so'rov ketmaydi
    await adapter.getPriceUsd({ serviceSlug: 'telegram', countrySlug: 'x', countryIso2: 'UZ' });
    await adapter.getPriceUsd({ serviceSlug: 'telegram_spam', countrySlug: 'x', countryIso2: 'UZ' });

    expect(calls).toEqual([
      { iso: 'UZ', spam: false },
      { iso: 'UZ', spam: true },
    ]);
  });

  it('zaxira (knownStock) ham qatlam bo‘yicha alohida', async () => {
    const { adapter } = makeAdapter();

    await adapter.getPriceUsd({ serviceSlug: 'telegram_spam', countrySlug: 'x', countryIso2: 'UZ' });

    // Faqat spam qatlami tekshirilgan — toza qatlam hali noma'lum (null)
    expect(adapter.knownStock('UZ', true)).toBe(true);
    expect(adapter.knownStock('UZ', false)).toBeNull();
  });

  it('xarid: telegram_spam ARZON e‘lonni oladi', async () => {
    const { adapter } = makeAdapter();

    const r = await adapter.buy({
      serviceSlug: 'telegram_spam', countrySlug: 'uzbekistan', countryIso2: 'UZ',
    });

    expect(r.costUsd).toBeCloseTo(0.1); // spam qatlam narxi
    expect(r.providerId.startsWith('111:')).toBe(true); // spam e'loni (itemId=111)
  });
});
