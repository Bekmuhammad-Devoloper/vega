import { config } from "@/lib/config";
import type {
  BoughtNumber,
  OrderState,
  ProviderPrice,
  ProviderSms,
  SmsProvider,
} from "./types";

const BASE = config.fivesimBaseUrl;

// 5sim /guest/prices javob shakli:
// { [country]: { [product]: { [operator]: { cost, count, rate } } } }
type PricesResponse = Record<
  string,
  Record<string, Record<string, { cost: number; count: number; rate: number }>>
>;

// 5sim buyurtma obyekti
interface FiveSimOrder {
  id: number;
  phone: string;
  operator: string;
  product: string;
  price: number;
  status: string;
  expires: string | null;
  country: string;
  sms: Array<{
    sender: string;
    text: string;
    code: string;
    created_at: string;
  }> | null;
}

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${config.fivesimApiKey}`,
      Accept: "application/json",
    },
    // Narxlar tez-tez o'zgaradi — keshlamaymiz.
    cache: "no-store",
  });

  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(
      `5sim ${path} -> ${res.status}: ${bodyText.slice(0, 200) || res.statusText}`
    );
  }
  // Ba'zi endpointlar (masalan bo'sh natija) matn qaytaradi.
  try {
    return JSON.parse(bodyText) as T;
  } catch {
    return bodyText as unknown as T;
  }
}

function mapSms(order: FiveSimOrder): ProviderSms[] {
  return (order.sms ?? []).map((s) => ({
    code: s.code || null,
    text: s.text || null,
    sender: s.sender || null,
  }));
}

export const fiveSimProvider: SmsProvider = {
  name: "5sim",

  async getPrice(product, country): Promise<ProviderPrice | null> {
    const data = await api<PricesResponse>(
      `/guest/prices?country=${encodeURIComponent(country)}&product=${encodeURIComponent(product)}`
    );
    const operators = data?.[country]?.[product];
    if (!operators) return null;

    // Mavjud (count > 0) operatorlardan eng arzonini tanlaymiz.
    let best: ProviderPrice | null = null;
    for (const [operator, info] of Object.entries(operators)) {
      if (!info || info.count <= 0) continue;
      if (!best || info.cost < best.costRub) {
        best = {
          product,
          country,
          operator,
          costRub: info.cost,
          count: info.count,
        };
      }
    }
    return best;
  },

  async buy(product, country, operator = "any"): Promise<BoughtNumber> {
    const order = await api<FiveSimOrder>(
      `/user/buy/activation/${encodeURIComponent(country)}/${encodeURIComponent(
        operator
      )}/${encodeURIComponent(product)}`
    );
    if (!order || typeof order === "string" || !order.id) {
      throw new Error(`5sim: raqam sotib olinmadi (${String(order)})`);
    }
    return {
      providerId: String(order.id),
      phone: order.phone,
      operator: order.operator,
      costRub: order.price,
      expiresAt: order.expires ? new Date(order.expires) : null,
    };
  },

  async check(providerId): Promise<OrderState> {
    const order = await api<FiveSimOrder>(`/user/check/${providerId}`);
    return {
      status: order.status,
      phone: order.phone,
      sms: mapSms(order),
    };
  },

  async cancel(providerId): Promise<void> {
    await api(`/user/cancel/${providerId}`);
  },

  async finish(providerId): Promise<void> {
    await api(`/user/finish/${providerId}`);
  },

  async balanceRub(): Promise<number> {
    const profile = await api<{ balance: number }>(`/user/profile`);
    return profile?.balance ?? 0;
  },
};
