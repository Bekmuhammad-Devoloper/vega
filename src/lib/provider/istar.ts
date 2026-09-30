import { randomUUID } from "crypto";
import { config } from "@/lib/config";
import { STAR_PACKS, USERNAME_RE, starPackBySlug } from "@/lib/catalog";
import type {
  BoughtNumber,
  OrderState,
  ProviderPrice,
  SmsProvider,
} from "./types";

// iStar (istar.fragmentapi.com) — Telegram Stars'ni istalgan @username'ga
// yuboradi (Fragment'ni o'raydi, ~5% komissiya).
//
// Base:  https://v1.fragmentapi.com/api/v1/partner
// Auth:  `API-Key: <kalit>` sarlavhasi (Bearer EMAS)
// Limit: sekundiga 1 so'rov — quyida navbat bilan cheklanadi.
// Oqim:  star/recipient/search (@username -> hash) -> POST /orders/star
//        -> GET /orders/{id} (pending/processing/completed/failed)
//
// DIQQAT: search hash'ni `recipient` maydonida qaytaradi, buyurtma esa uni
// `recipient_hash` deb kutadi. Faqat haqiqiy user akkauntlari topiladi
// (kanal/bot emas). Narx API'da yo'q — config.istarUsdPerStar ishlatiladi.

const BASE = config.istarBaseUrl.replace(/\/+$/, "");

// ── Sekundiga 1 so'rov: so'rovlar ketma-ket, oraliq bilan ──
let queue: Promise<unknown> = Promise.resolve();
let lastCallAt = 0;
const MIN_GAP_MS = 1100;

function throttle<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = MIN_GAP_MS - (Date.now() - lastCallAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    try {
      return await fn();
    } finally {
      lastCallAt = Date.now();
    }
  });
  // Navbat xatodan to'xtab qolmasligi uchun.
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function call<T>(
  path: string,
  init?: { method?: "GET" | "POST"; body?: unknown; idempotencyKey?: string }
): Promise<T> {
  return throttle(async () => {
    const headers: Record<string, string> = {
      "API-Key": config.istarApiKey,
      Accept: "application/json",
    };
    if (init?.body) headers["Content-Type"] = "application/json";
    // Buyurtma yaratishda takroriy yechilishning oldini oladi.
    if (init?.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;

    const res = await fetch(BASE + path, {
      method: init?.method ?? "GET",
      headers,
      cache: "no-store",
      ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
    });
    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`iStar ${path}: ${res.status} ${text.slice(0, 120)}`);
    }
    const err = (data as { error?: string })?.error;
    if (err || !res.ok) throw new Error(`iStar ${path}: ${err ?? `HTTP ${res.status}`}`);
    return data as T;
  });
}

function cleanUsername(u: string | undefined): string | null {
  const v = (u ?? "").trim();
  return USERNAME_RE.test(v) ? v.replace(/^@/, "") : null;
}

// Holat keshi — mijoz har 3s so'raydi, iStar esa 1 so'rov/s beradi.
const statusCache = new Map<string, { at: number; state: OrderState }>();
const STATUS_TTL = 8_000;

export const istarProvider: SmsProvider = {
  name: "istar",

  async getPrice(product, country): Promise<ProviderPrice | null> {
    if (product !== "tg_stars") return null;
    const pack = starPackBySlug(country);
    if (!pack) return null;
    return {
      product,
      country,
      operator: "any",
      costRub: pack.stars * config.istarUsdPerStar, // USD
      currency: "USD",
      count: 999, // iStar zaxira bermaydi (hamyon balansi bilan cheklangan)
    };
  },

  async buy(product, country, _operator, extra): Promise<BoughtNumber> {
    const pack = product === "tg_stars" ? starPackBySlug(country) : undefined;
    if (!pack) throw new Error("Bu paket mavjud emas");
    const username = cleanUsername(extra?.username);
    if (!username) throw new Error("Telegram username noto'g'ri (masalan: @username)");

    // 1) @username -> recipient hash. Topilmasa — hech narsa yechilmaydi.
    let hash: string | undefined;
    try {
      const r = await call<{ success?: boolean; recipient?: string }>(
        `/star/recipient/search?username=${encodeURIComponent(username)}&quantity=${pack.stars}`
      );
      if (r.success) hash = r.recipient;
    } catch (e) {
      console.warn(`[istar] search @${username}:`, e instanceof Error ? e.message : e);
    }
    if (!hash) {
      throw new Error(
        `@${username} topilmadi. Username to'g'riligini tekshiring (kanal/bot emas, oddiy akkaunt bo'lsin).`
      );
    }

    // 2) Buyurtma.
    let id: string | undefined;
    try {
      const r = await call<{ id?: string; order_id?: string }>("/orders/star", {
        method: "POST",
        idempotencyKey: randomUUID(),
        body: {
          username,
          recipient_hash: hash,
          quantity: pack.stars,
          wallet_type: config.istarWallet,
        },
      });
      id = r.id ?? r.order_id;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[istar] order:", msg);
      if (/balance|insufficient|funds/i.test(msg)) {
        throw new Error("Stars hozircha mavjud emas. Birozdan keyin urinib ko'ring.");
      }
      throw new Error("Stars buyurtmasi qabul qilinmadi. Birozdan keyin urinib ko'ring.");
    }
    if (!id) throw new Error("Stars buyurtmasi qabul qilinmadi. Birozdan keyin urinib ko'ring.");

    return {
      providerId: String(id),
      phone: `@${username}`,
      operator: "any",
      costRub: pack.stars * config.istarUsdPerStar, // USD
      currency: "USD",
      expiresAt: null,
    };
  },

  async check(providerId): Promise<OrderState> {
    const hit = statusCache.get(providerId);
    if (hit && Date.now() - hit.at < STATUS_TTL) return hit.state;

    let state: OrderState = { status: "PENDING", sms: [] };
    try {
      const r = await call<{ status?: string }>(`/orders/${encodeURIComponent(providerId)}`);
      const s = (r.status ?? "").toLowerCase();
      if (s === "completed") {
        state = {
          status: "RECEIVED",
          sms: [{ code: null, text: "✓ Stars yetkazildi", sender: "iStar" }],
        };
      } else if (s === "failed") {
        state = { status: "CANCELED", sms: [] }; // pul qaytariladi
      }
    } catch (e) {
      console.warn("[istar] status:", e instanceof Error ? e.message : e);
    }
    statusCache.set(providerId, { at: Date.now(), state });
    return state;
  },

  async cancel(): Promise<void> {
    // iStar'da bekor qilish yo'q — buyurtma darhol ishlanadi.
  },

  async finish(): Promise<void> {},

  async balanceRub(): Promise<number> {
    const r = await call<{ balance?: number }>(
      `/wallet/balance?wallet_type=${config.istarWallet}`
    );
    return Number(r.balance ?? 0);
  },
};

/** Stars paketlari narxlari (UI taxtasi uchun, USD). */
export function istarBoard(): { slug: string; costUsd: number }[] {
  return STAR_PACKS.map((p) => ({ slug: p.slug, costUsd: p.stars * config.istarUsdPerStar }));
}
