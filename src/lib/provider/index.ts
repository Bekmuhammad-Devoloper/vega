import { config, isMockMode } from "@/lib/config";
import { lztProvider } from "./lzt";
import { istarProvider } from "./istar";
import { spiderProvider } from "./spider";
import { heroSmsProvider } from "./herosms";
import { fiveSimProvider } from "./fivesim";
import { mockProvider } from "./mock";
import type { BoughtNumber, BuyExtra, OrderState, ProviderPrice, SmsProvider } from "./types";

// Barcha mavjud provayderlar (nom -> adapter). check/cancel routing uchun.
const REGISTRY: Record<string, SmsProvider> = {
  lzt: lztProvider,
  istar: istarProvider,
  spider: spiderProvider,
  hero: heroSmsProvider,
  "5sim": fiveSimProvider,
  mock: mockProvider,
};

// "Boshqa" xizmatlar (Telegram'dan tashqari) uchun provayder.
// MUHIM: mock (soxta raqam) FAQAT hech qanday provayder kaliti yo'q bo'lganda
// ishlatiladi. Aks holda (masalan faqat SPIDER kaliti sozlangan bo'lsa) mock'ga
// tushib, mijozdan REAL pul olib SOXTA raqam berib qo'yish xavfi bor edi.
function otherProvider(): { name: string; p: SmsProvider } | null {
  if (config.herosmsApiKey) return { name: "hero", p: heroSmsProvider };
  if (config.fivesimApiKey) return { name: "5sim", p: fiveSimProvider };
  if (isMockMode) return { name: "mock", p: mockProvider };
  return null; // kalit bor, lekin bu yo'nalish uchun manba yo'q
}

// Mahsulotga qarab provayder tanlash:
//   Telegram raqam + Premium -> LZT Market (SPIDER — Telegram zaxirasi)
//   Stars                    -> iStar
//   boshqa xizmatlar         -> HeroSMS (5sim zaxira)
function pick(product: string): { name: string; p: SmsProvider } | null {
  if (product === "tg_stars") {
    return config.istarApiKey ? { name: "istar", p: istarProvider } : null;
  }
  if (product === "tg_premium") {
    return config.lztApiKey ? { name: "lzt", p: lztProvider } : null;
  }
  if (product === "telegram") {
    if (config.lztApiKey) return { name: "lzt", p: lztProvider };
    if (config.spiderApiKey) return { name: "spider", p: spiderProvider };
  }
  return otherProvider();
}

// providerId "prefiks:asl_id" ko'rinishida — qaysi provayder bo'lganini biladi.
// Mavjud buyurtmalarni check/cancel qilish uchun REGISTRY'dan to'g'ridan-to'g'ri
// olamiz (bu yerda mock'ga tushib qolish xavfi yo'q — prefiks aniq).
function route(providerId: string): { p: SmsProvider; id: string } | null {
  const i = providerId.indexOf(":");
  if (i < 0) {
    const o = otherProvider();
    return o ? { p: o.p, id: providerId } : null; // eski format
  }
  const name = providerId.slice(0, i);
  const p = REGISTRY[name];
  return p ? { p, id: providerId.slice(i + 1) } : null;
}

// Router provayder — Vega qolgan qismi buni bitta provayder deb ishlatadi.
export const provider: SmsProvider = {
  name: "router",

  async getPrice(product, country): Promise<ProviderPrice | null> {
    const sel = pick(product);
    if (!sel) return null; // bu xizmat uchun sozlangan manba yo'q
    return sel.p.getPrice(product, country);
  },

  async buy(product, country, operator, extra?: BuyExtra): Promise<BoughtNumber> {
    const sel = pick(product);
    if (!sel) {
      throw new Error("Bu xizmat hozircha mavjud emas");
    }
    // operator — getPrice'da tanlangan operator (5sim narxi shu operatorga tegishli).
    const bought = await sel.p.buy(product, country, operator, extra);
    // Kelajakda check/cancel to'g'ri provayderga borishi uchun prefiks qo'shamiz.
    return { ...bought, providerId: `${sel.name}:${bought.providerId}` };
  },

  async check(providerId): Promise<OrderState> {
    const r = route(providerId);
    if (!r) return { status: "PENDING", sms: [] }; // noma'lum manba — holatni o'zgartirmaymiz
    return r.p.check(r.id);
  },

  async cancel(providerId): Promise<void> {
    const r = route(providerId);
    if (!r) return;
    return r.p.cancel(r.id);
  },

  async finish(providerId): Promise<void> {
    const r = route(providerId);
    if (!r) return;
    return r.p.finish(r.id);
  },

  async balanceRub(): Promise<number> {
    // Asosiy (Telegram) manba balansi.
    if (config.lztApiKey) return lztProvider.balanceRub();
    if (config.spiderApiKey) return spiderProvider.balanceRub();
    const o = otherProvider();
    return o ? o.p.balanceRub() : 0;
  },
};

export * from "./types";
