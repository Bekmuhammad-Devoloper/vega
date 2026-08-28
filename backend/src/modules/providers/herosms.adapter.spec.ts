import { HeroSmsAdapter } from './herosms.adapter';

/**
 * Vitrina ("Xatolik yuz berdi") xatosining sababi: kesh sovuq bo'lganda
 * `availableMap()` o'nlab marta BIR VAQTDA chaqirilardi va har biri
 * provayderga alohida HTTP so'rov yuborardi. Bu test shu holatni qaytadan
 * yuzaga keltirib, endi BITTA so'rov ketishini tekshiradi.
 */
describe('HeroSmsAdapter.availableMap — bir vaqtdagi chaqiruvlar', () => {
  function makeAdapter(onApiCall: () => void) {
    // ConfigService o'rniga minimal soxta obyekt — adapter faqat kalitni o'qiydi.
    const config = { get: () => 'test-key' } as never;
    const adapter = new HeroSmsAdapter(config);

    // Tashqi HTTP o'rniga sekin javob beruvchi soxta `api`.
    (adapter as unknown as { api: () => Promise<string> }).api = async () => {
      onApiCall();
      await new Promise((r) => setTimeout(r, 30));
      return JSON.stringify({ '40': { tg: { count: 5 }, wa: { count: 0 } } });
    };
    return adapter;
  }

  it('50 ta parallel chaqiruv provayderga FAQAT 1 marta boradi', async () => {
    let calls = 0;
    const adapter = makeAdapter(() => calls++);

    const results = await Promise.all(
      Array.from({ length: 50 }, () => adapter.availableMap()),
    );

    expect(calls).toBe(1);
    // Hamma bir xil natijani oldi
    for (const map of results) {
      expect(map.get('40')?.has('tg')).toBe(true);
      // count = 0 bo'lgan xizmat ro'yxatga tushmaydi
      expect(map.get('40')?.has('wa')).toBe(false);
    }
  });

  it('so\'rov tugagach kesh ishlaydi — keyingi chaqiruvlar so\'rov yubormaydi', async () => {
    let calls = 0;
    const adapter = makeAdapter(() => calls++);

    await adapter.availableMap();
    await adapter.availableMap();
    await adapter.availableMap();

    expect(calls).toBe(1);
  });

  it('provayder xato bersa ham yiqilmaydi — bo\'sh xarita qaytadi', async () => {
    const config = { get: () => 'test-key' } as never;
    const adapter = new HeroSmsAdapter(config);
    (adapter as unknown as { api: () => Promise<string> }).api = async () => {
      throw new Error('Cloudflare 403');
    };

    // Rad etilmasligi (reject bo'lmasligi) SHART — aks holda butun vitrina
    // 500 xato bilan qulaydi.
    const map = await adapter.availableMap();
    expect(map.size).toBe(0);
  });
});

/**
 * "Narxlar" sahifasi sekinligining sababi: har bir taklif kartochkasi
 * `getPriceUsd` chaqirar, u esa HAR SAFAR provayderga alohida HTTP so'rov
 * yuborardi (keshsiz). 20 ta kartochka = 20 ta tashqi so'rov.
 */
describe('HeroSmsAdapter.getPriceUsd — narx keshi', () => {
  function makeAdapter(onApiCall: () => void) {
    const config = { get: () => 'test-key' } as never;
    const adapter = new HeroSmsAdapter(config);
    (adapter as unknown as { api: () => Promise<string> }).api = async () => {
      onApiCall();
      await new Promise((r) => setTimeout(r, 20));
      return JSON.stringify({
        '40': { tg: { cost: 0.5, count: 7 }, wa: { cost: 1.2, count: 3 } },
        '187': { tg: { cost: 0.9, count: 0 } }, // zaxira yo'q
      });
    };
    return adapter;
  }

  it('20 ta parallel narx so\'rovi provayderga FAQAT 1 marta boradi', async () => {
    let calls = 0;
    const adapter = makeAdapter(() => calls++);

    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        adapter.getPriceUsd({ countryHeroCode: '40', serviceHeroCode: 'tg' } as never),
      ),
    );

    expect(calls).toBe(1);
    expect(results.every((r) => r === 0.5)).toBe(true);
  });

  it('turli yo\'nalishlar bitta keshdan xizmat qilinadi', async () => {
    let calls = 0;
    const adapter = makeAdapter(() => calls++);

    const [tg, wa] = await Promise.all([
      adapter.getPriceUsd({ countryHeroCode: '40', serviceHeroCode: 'tg' } as never),
      adapter.getPriceUsd({ countryHeroCode: '40', serviceHeroCode: 'wa' } as never),
    ]);

    expect(calls).toBe(1);
    expect(tg).toBe(0.5);
    expect(wa).toBe(1.2);
  });

  it('zaxirasi tugagan yo\'nalish narx bermaydi', async () => {
    const adapter = makeAdapter(() => undefined);
    const p = await adapter.getPriceUsd({ countryHeroCode: '187', serviceHeroCode: 'tg' } as never);
    expect(p).toBeNull();
  });
});
