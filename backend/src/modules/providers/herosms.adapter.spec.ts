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
