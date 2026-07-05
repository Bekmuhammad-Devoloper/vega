import { config } from "@/lib/config";
import { COUNTRIES, PRODUCTS } from "@/lib/catalog";
import type {
  BoughtNumber,
  OrderState,
  ProviderPrice,
  SmsProvider,
} from "./types";

// HeroSMS — SMS-Activate protokoli (handler_api.php).
// UZB raqamlari 5sim'dan sezilarli arzon.

const BASE = config.herosmsBaseUrl;
// Cloudflare oddiy so'rovni bloklaydi — brauzerga o'xshash User-Agent kerak.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// Katalogdan slug -> HeroSMS kod xaritalari (yagona manba).
const COUNTRY: Record<string, string> = Object.fromEntries(
  COUNTRIES.map((c) => [c.slug, c.hero])
);
const SERVICE: Record<string, string> = Object.fromEntries(
  PRODUCTS.map((p) => [p.slug, p.hero])
);

async function api(
  action: string,
  params: Record<string, string | number> = {}
): Promise<string> {
  const url = new URL(BASE);
  url.searchParams.set("api_key", config.herosmsApiKey);
  url.searchParams.set("action", action);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": UA, Accept: "*/*" },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HeroSMS ${action} -> ${res.status}: ${text.slice(0, 150)}`);
  }
  return text.trim();
}

export const heroSmsProvider: SmsProvider = {
  name: "herosms",

  async getPrice(product, country): Promise<ProviderPrice | null> {
    const c = COUNTRY[country];
    const s = SERVICE[product];
    if (!c || !s) return null;

    const text = await api("getPrices", { country: c, service: s });
    let data: Record<string, Record<string, { cost: number; count: number }>>;
    try {
      data = JSON.parse(text);
    } catch {
      return null;
    }
    const info = data?.[c]?.[s];
    if (!info || (info.count ?? 0) <= 0) return null;
    return {
      product,
      country,
      operator: "any",
      costRub: Number(info.cost), // USD
      count: Number(info.count),
    };
  },

  async buy(product, country): Promise<BoughtNumber> {
    const c = COUNTRY[country];
    const s = SERVICE[product];
    if (!c || !s) throw new Error("Bu yo'nalish qo'llab-quvvatlanmaydi");

    let text: string;
    try {
      text = await api("getNumberV2", { service: s, country: c });
    } catch (e) {
      // HeroSMS hisobimiz bo'sh bo'lsa 402 qaytaradi (mijoz aybi emas).
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("402")) {
        throw new Error("Raqam hozircha mavjud emas. Birozdan keyin urinib ko'ring.");
      }
      throw e;
    }

    // Xato satrlari (SMS-Activate uslubi).
    if (text.includes("NO_NUMBERS")) {
      throw new Error("Bu yo'nalishda raqam tugagan. Boshqa davlatni tanlang.");
    }
    if (text.includes("NO_BALANCE")) {
      throw new Error("Raqam hozircha mavjud emas. Birozdan keyin urinib ko'ring.");
    }

    // Muvaffaqiyatda JSON.
    let data: {
      activationId?: number | string;
      phoneNumber?: string;
      activationCost?: string | number;
    };
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Xatolik: ${text}`);
    }
    if (!data.activationId || !data.phoneNumber) {
      throw new Error(`Xatolik: ${text}`);
    }
    return {
      providerId: String(data.activationId),
      phone: data.phoneNumber.startsWith("+")
        ? data.phoneNumber
        : "+" + data.phoneNumber,
      operator: "any",
      costRub: Number(data.activationCost) || 0, // USD
      expiresAt: new Date(Date.now() + 20 * 60 * 1000),
    };
  },

  async check(providerId): Promise<OrderState> {
    const text = await api("getStatus", { id: providerId });
    // STATUS_WAIT_CODE | STATUS_OK:code | STATUS_WAIT_RETRY:code | STATUS_CANCEL
    if (text.startsWith("STATUS_OK") || text.startsWith("STATUS_WAIT_RETRY")) {
      const code = text.split(":")[1] || null;
      if (code) {
        return { status: "RECEIVED", sms: [{ code, text: code, sender: null }] };
      }
    }
    if (text.startsWith("STATUS_CANCEL")) {
      return { status: "CANCELED", sms: [] };
    }
    return { status: "PENDING", sms: [] };
  },

  async cancel(providerId): Promise<void> {
    // status 8 = bekor qilish
    await api("setStatus", { id: providerId, status: 8 });
  },

  async finish(providerId): Promise<void> {
    // status 6 = yakunlash (SMS olindi)
    await api("setStatus", { id: providerId, status: 6 });
  },

  async balanceRub(): Promise<number> {
    const text = await api("getBalance"); // ACCESS_BALANCE:0.00
    const val = text.split(":")[1];
    return val ? Number(val) : 0;
  },
};
