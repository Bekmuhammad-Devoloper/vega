import type {
  BoughtNumber,
  OrderState,
  ProviderPrice,
  SmsProvider,
} from "./types";

// Demo (MOCK) provayder — API kaliti bo'lmaganda ishlaydi.
// Haqiqiy pul sarflamaydi: raqamni "generatsiya" qiladi va bir necha
// soniyadan so'ng "SMS kelgan"dek ko'rsatadi.

interface MockOrder {
  id: string;
  phone: string;
  product: string;
  country: string;
  costRub: number;
  createdAt: number; // ms
  status: string;
  code: string | null;
}

// Dev jarayoni davomida saqlanib turishi uchun global'da.
const store = globalThis as unknown as { __mockOrders?: Map<string, MockOrder> };
const orders: Map<string, MockOrder> = (store.__mockOrders ??= new Map());

// SMS shu vaqtdan keyin "keladi".
const SMS_DELAY_MS = 8000;

// Xizmat/davlatga qarab barqaror soxta narx (RUB).
function fakeCost(product: string, country: string): number {
  const seed = [...(product + country)].reduce(
    (a, c) => a + c.charCodeAt(0),
    0
  );
  return 8 + (seed % 40); // 8..47 RUB
}

function randomPhone(): string {
  let n = "";
  for (let i = 0; i < 10; i++) n += Math.floor(Math.random() * 10);
  return "+1" + n;
}

export const mockProvider: SmsProvider = {
  name: "mock",

  async getPrice(product, country): Promise<ProviderPrice | null> {
    return {
      product,
      country,
      operator: "any",
      costRub: fakeCost(product, country),
      count: 999,
    };
  },

  async buy(product, country): Promise<BoughtNumber> {
    const id = "mock_" + Math.random().toString(36).slice(2, 10);
    const order: MockOrder = {
      id,
      phone: randomPhone(),
      product,
      country,
      costRub: fakeCost(product, country),
      createdAt: Date.now(),
      status: "PENDING",
      code: null,
    };
    orders.set(id, order);
    return {
      providerId: id,
      phone: order.phone,
      operator: "any",
      costRub: order.costRub,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };
  },

  async check(providerId): Promise<OrderState> {
    const order = orders.get(providerId);
    if (!order) return { status: "CANCELED", sms: [] };

    if (order.status === "PENDING" && Date.now() - order.createdAt > SMS_DELAY_MS) {
      order.status = "RECEIVED";
      order.code = String(Math.floor(100000 + Math.random() * 900000));
    }

    return {
      status: order.status,
      phone: order.phone,
      sms: order.code
        ? [
            {
              code: order.code,
              text: `Your ${order.product} code is ${order.code}`,
              sender: order.product,
            },
          ]
        : [],
    };
  },

  async cancel(providerId): Promise<void> {
    const order = orders.get(providerId);
    if (order) order.status = "CANCELED";
  },

  async finish(providerId): Promise<void> {
    const order = orders.get(providerId);
    if (order) order.status = "FINISHED";
  },

  async balanceRub(): Promise<number> {
    return 1000; // demo balans
  },
};
