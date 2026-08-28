import { TenantBotService } from './tenant-bot.service';

/**
 * Kanal uchun QO'LDA e'lon (marketing) qo'yilganda xaridor ANONIM qolishi shart:
 *  - raqamning oxirgi 4 xonasi yashiriladi,
 *  - e'londa xaridor ismi/username ko'rsatilmaydi,
 *  - "Raqam egasi" tugmasi CHIQMAYDI (u profilga olib borardi).
 */
describe("Sotuv e'loni — xaridor anonimligi", () => {
  type Sent = { text: string; markup: unknown };

  function makeService(): { svc: TenantBotService; sent: Sent[] } {
    const sent: Sent[] = [];
    const bot = {
      api: {
        getChat: async () => ({}),
        getMe: async () => ({ id: 1 }),
        sendMessage: async (_chat: unknown, text: string, opts: { reply_markup?: unknown }) => {
          sent.push({ text, markup: opts?.reply_markup });
          return { message_id: 1 };
        },
      },
    };

    const prisma = {
      tenant: {
        findUnique: async () => ({
          reviewsEnabled: true,
          reviewsChannelId: '@shopchannel',
          botToken: 'tenant-token',
          botUsername: 'myshopbot',
          shopName: 'Mening Do\'konim',
          slug: 'myshop',
          totalOrders: 42,
        }),
      },
    };

    const config = { get: () => '' } as never;
    const globalBot = { bot } as never;
    const tenantCustomers = { touch: async () => undefined } as never;
    const svc = new TenantBotService(
      prisma as never,
      {} as never,
      globalBot,
      tenantCustomers,
      config,
    );
    return { svc, sent };
  }

  const review = {
    type: 'NUMBER' as const,
    orderNumber: '',
    price: 19000,
    phone: '+998901234567',
    serviceName: 'WhatsApp',
    serviceEmoji: '💬',
    countryName: 'Saudiya',
    countryFlag: '🇸🇦',
  };

  it('raqam maskalanadi — to\'liq raqam kanalga CHIQMAYDI', async () => {
    const { svc, sent } = makeService();
    await svc.sendSaleReview('t1', review);

    expect(sent).toHaveLength(1);
    expect(sent[0].text).not.toContain('+998901234567');
    expect(sent[0].text).toContain('+99890123****');
  });

  it('xaridor berilmasa "Raqam egasi" tugmasi chiqmaydi', async () => {
    const { svc, sent } = makeService();
    await svc.sendSaleReview('t1', review);

    const markup = JSON.stringify(sent[0].markup ?? {});
    expect(markup).not.toContain('Raqam egasi');
    // "Bizning botimiz" tugmasi esa qolishi kerak (marketing maqsadi).
    expect(markup).toContain('botimiz');
  });

  it('xaridor berilsa — tugma chiqadi (haqiqiy sotuv yo\'li o\'zgarmagan)', async () => {
    const { svc, sent } = makeService();
    await svc.sendSaleReview('t1', { ...review, buyerUsername: 'someone' });

    const markup = JSON.stringify(sent[0].markup ?? {});
    expect(markup).toContain('Raqam egasi');
  });

  it('narx e\'londa ko\'rsatiladi', async () => {
    const { svc, sent } = makeService();
    await svc.sendSaleReview('t1', review);
    // ru-RU formatlash UZILMAS probel ishlatadi — ajratuvchini normallashtiramiz.
    const normalized = sent[0].text.replace(/[\s  ]/g, ' ');
    expect(normalized).toContain("19 000 so'm");
  });
});
