import { config } from "@/lib/config";
import { COUNTRIES } from "@/lib/catalog";
import type {
  BoughtNumber,
  OrderState,
  ProviderPrice,
  SmsProvider,
} from "./types";

// SPIDER TG API — real SIM, Telegram uchun ishlaydi.
// Faqat Telegram raqamlari (getNumber&country=ISO). Narx USD'da.

const BASE = config.spiderBaseUrl;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// Katalogdan slug -> SPIDER ISO2 kodi (yagona manba).
const COUNTRY: Record<string, string> = Object.fromEntries(
  COUNTRIES.map((c) => [c.slug, c.spider])
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function api(action: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(BASE);
  url.searchParams.set("apiKay", config.spiderApiKey); // ha, "apiKay" (ularning imlosi)
  url.searchParams.set("action", action);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": UA, Accept: "application/json" },
    cache: "no-store",
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`SPIDER ${action}: ${text.slice(0, 150)}`);
  }
}

// Berilgan ISO uchun Telegram narxi (USD).
async function priceOf(iso: string): Promise<number | null> {
  const d = await api("getCountrys");
  const groups = d?.result?.countries || {};
  for (const grp of Object.values(groups)) {
    const g = grp as Record<string, string>;
    if (g && g[iso] != null) return Number(g[iso]);
  }
  return null;
}

export const spiderProvider: SmsProvider = {
  name: "spider",

  async getPrice(product, country): Promise<ProviderPrice | null> {
    if (product !== "telegram") return null; // SPIDER faqat Telegram
    const iso = COUNTRY[country];
    if (!iso) return null;
    const p = await priceOf(iso);
    if (p == null) return null;
    return { product, country, operator: "any", costRub: p, count: 999 }; // USD; stock bermaydi
  },

  async buy(product, country): Promise<BoughtNumber> {
    if (product !== "telegram") {
      throw new Error("Bu xizmat bu manbada mavjud emas");
    }
    const iso = COUNTRY[country];
    if (!iso) throw new Error("Bu davlat qo'llab-quvvatlanmaydi");

    const d = await api("getNumber", { country: iso });
    if (!d?.ok) {
      const e = String(d?.error || "").toUpperCase();
      if (e.includes("BALANCE")) {
        throw new Error("Raqam hozircha mavjud emas. Birozdan keyin urinib ko'ring.");
      }
      if (e.includes("NO_NUMBER") || e.includes("NOT_FOUND") || e.includes("EMPTY")) {
        throw new Error("Bu yo'nalishda raqam tugagan. Boshqa davlatni tanlang.");
      }
      throw new Error(`Xatolik: ${d?.error || "noma'lum"}`);
    }

    const r = d.result || {};
    const phone = r.number ?? r.phone ?? r.phoneNumber ?? r.tel;
    const hash = r.hash_code ?? r.hash ?? r.hashCode ?? r.id;
    if (!phone || !hash) {
      throw new Error(`SPIDER javobi tushunarsiz: ${JSON.stringify(r).slice(0, 140)}`);
    }
    const cost = Number(r.price ?? r.cost) || (await priceOf(iso)) || 0;
    return {
      providerId: String(hash),
      phone: String(phone).startsWith("+") ? String(phone) : "+" + String(phone),
      operator: "any",
      costRub: cost, // USD
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };
  },

  async check(providerId): Promise<OrderState> {
    const d = await api("getCode", { hash_code: providerId });
    const r = d?.result;
    let code: string | null = null;
    if (r && typeof r === "object") {
      code = r.code ?? r.sms ?? r.otp ?? r.message ?? null;
    } else if (typeof r === "string") {
      code = r;
    }
    if (d?.ok && code && /\d/.test(String(code))) {
      return {
        status: "RECEIVED",
        sms: [{ code: String(code), text: String(code), sender: null }],
      };
    }
    // Bekor/muddat holati
    const err = String(d?.error || "").toUpperCase();
    if (err.includes("CANCEL") || err.includes("TIMEOUT") || err.includes("EXPIRE")) {
      return { status: "CANCELED", sms: [] };
    }
    return { status: "PENDING", sms: [] };
  },

  async cancel(): Promise<void> {
    // SPIDER'da bekor qilish action yo'q — kod kelmasa avtomatik bekor bo'ladi.
  },

  async finish(): Promise<void> {},

  async balanceRub(): Promise<number> {
    const d = await api("getBalance");
    return Number(d?.result?.wallet ?? 0);
  },
};
