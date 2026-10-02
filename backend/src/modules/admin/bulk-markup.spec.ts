import { CatalogService } from '../catalog/catalog.service';
import { AdminNumbersService } from './admin-numbers.service';

/**
 * Ommaviy ustama (avto-narx):
 *   sotuv narxi = JORIY tan narxi + sotuvchi ustamasi (100 so'mga yuqoriga).
 * Narxi yo'q davlat o'tkazib yuboriladi (taklif yaratilmaydi), qo'lda narx
 * kiritilsa taklif qat'iy rejimga o'tadi (markupUzs = null).
 */
describe('Ommaviy ustama', () => {
  it('autoRetail: tan narxi + ustama, 100 so\'mga YUQORIGA yaxlit', () => {
    expect(CatalogService.autoRetail(7800, 2000)).toBe(9800);
    expect(CatalogService.autoRetail(7850, 2000)).toBe(9900); // hech qachon pastga emas
    expect(CatalogService.autoRetail(6200, 0)).toBe(6200); // 0 ustama = sof tan narxi
  });

  function makeService(quotes: Record<string, number | null>) {
    const upserts: Array<{ countryId: string; retail: number; markup: number | null }> = [];
    const prisma = {
      resellerOffer: {
        upsert: async (args: {
          where: { tenantId_serviceId_countryId: { countryId: string } };
          update: { retailPrice: number; markupUzs: number | null };
        }) => {
          upserts.push({
            countryId: args.where.tenantId_serviceId_countryId.countryId,
            retail: args.update.retailPrice,
            markup: args.update.markupUzs,
          });
          return {};
        },
      },
    };
    const catalog = {
      serviceCountries: async () => Object.keys(quotes).map((id) => ({ id })),
      quoteFor: async (_t: string, _s: string, countryId: string) =>
        quotes[countryId] == null ? null : { totalUzs: quotes[countryId] },
    };
    const svc = new AdminNumbersService(prisma as never, catalog as never);
    return { svc, upserts };
  }

  async function waitDone(svc: AdminNumbersService) {
    for (let i = 0; i < 100 && svc.bulkMarkupStatus('t1').running; i++) {
      await new Promise((r) => setTimeout(r, 5));
    }
    return svc.bulkMarkupStatus('t1');
  }

  it('barcha davlatlarga ustama qo\'yadi, narxsizini o\'tkazib yuboradi', async () => {
    const { svc, upserts } = makeService({ UZ: 7800, KZ: 6000, XX: null });

    await svc.startBulkMarkup('t1', { serviceId: 's1', all: true, markupUzs: 2000 });
    const st = await waitDone(svc);

    expect(st.priced).toBe(2);
    expect(st.skipped).toBe(1);
    expect(upserts).toEqual([
      { countryId: 'UZ', retail: 9800, markup: 2000 },
      { countryId: 'KZ', retail: 8000, markup: 2000 },
    ]);
  });

  it('faqat tanlangan (va ruxsat etilgan) davlatlarga', async () => {
    const { svc, upserts } = makeService({ UZ: 7800, KZ: 6000 });

    // 'HACK' — bu xizmatda yo'q davlat id'si, filtrlanishi shart
    await svc.startBulkMarkup('t1', { serviceId: 's1', countryIds: ['KZ', 'HACK'], markupUzs: 500 });
    await waitDone(svc);

    expect(upserts.map((u) => u.countryId)).toEqual(['KZ']);
  });

  it('jarayon ketayotganda ikkinchisini boshlab bo\'lmaydi', async () => {
    const { svc } = makeService({ UZ: 7800 });
    await svc.startBulkMarkup('t1', { serviceId: 's1', all: true, markupUzs: 1 });
    await expect(
      svc.startBulkMarkup('t1', { serviceId: 's1', all: true, markupUzs: 1 }),
    ).rejects.toThrow();
    await waitDone(svc);
  });

  it('noto\'g\'ri ustama rad etiladi', async () => {
    const { svc } = makeService({ UZ: 7800 });
    await expect(
      svc.startBulkMarkup('t1', { serviceId: 's1', all: true, markupUzs: -100 }),
    ).rejects.toThrow();
  });
});
