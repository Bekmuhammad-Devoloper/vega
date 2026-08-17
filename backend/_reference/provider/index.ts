import { config } from "@/lib/config";
import { spiderProvider } from "./spider";
import { heroSmsProvider } from "./herosms";
import { fiveSimProvider } from "./fivesim";
import { mockProvider } from "./mock";
import type { BoughtNumber, OrderState, ProviderPrice, SmsProvider } from "./types";

// Barcha mavjud provayderlar (nom -> adapter). check/cancel routing uchun.
const REGISTRY: Record<string, SmsProvider> = {
  spider: spiderProvider,
  hero: heroSmsProvider,
  "5sim": fiveSimProvider,
  mock: mockProvider,
};

// "Boshqa" xizmatlar (Telegram'dan tashqari) uchun provayder.
function otherProvider(): { name: string; p: SmsProvider } {
  if (config.herosmsApiKey) return { name: "hero", p: heroSmsProvider };
  if (config.fivesimApiKey) return { name: "5sim", p: fiveSimProvider };
  return { name: "mock", p: mockProvider };
}

// Mahsulotга qarab provayder tanlash.
// Telegram -> SPIDER (real SIM, ishlaydi), boshqasi -> HeroSMS/5sim.
function pick(product: string): { name: string; p: SmsProvider } {
  if (product === "telegram" && config.spiderApiKey) {
    return { name: "spider", p: spiderProvider };
  }
  return otherProvider();
}

// providerId "prefiks:asl_id" ko'rinishida — qaysi provayder bo'lganini biladi.
function route(providerId: string): { p: SmsProvider; id: string } {
  const i = providerId.indexOf(":");
  if (i < 0) return { p: otherProvider().p, id: providerId }; // eski format
  const name = providerId.slice(0, i);
  return { p: REGISTRY[name] ?? otherProvider().p, id: providerId.slice(i + 1) };
}

// Router provayder — Vega qolgan qismi buni bitta provayder deb ishlatadi.
export const provider: SmsProvider = {
  name: "router",

  getPrice(product, country): Promise<ProviderPrice | null> {
    return pick(product).p.getPrice(product, country);
  },

  async buy(product, country): Promise<BoughtNumber> {
    const { name, p } = pick(product);
    const bought = await p.buy(product, country);
    // Kelajakda check/cancel to'g'ri provayderga borishi uchun prefiks qo'shamiz.
    return { ...bought, providerId: `${name}:${bought.providerId}` };
  },

  check(providerId): Promise<OrderState> {
    const { p, id } = route(providerId);
    return p.check(id);
  },

  cancel(providerId): Promise<void> {
    const { p, id } = route(providerId);
    return p.cancel(id);
  },

  finish(providerId): Promise<void> {
    const { p, id } = route(providerId);
    return p.finish(id);
  },

  balanceRub(): Promise<number> {
    // Asosiy (Telegram) manba balansi.
    return (config.spiderApiKey ? spiderProvider : otherProvider().p).balanceRub();
  },
};

export * from "./types";
