import { config } from "@/lib/config";
import { COUNTRIES, PREMIUM_PLANS, planBySlug } from "@/lib/catalog";
import type {
  BoughtNumber,
  OrderState,
  ProviderPrice,
  ProviderSms,
  SmsProvider,
} from "./types";

// LZT Market (lzt.market) — Telegram AKKAUNTLARI va Telegram Premium gift.
// SMS-activation emas: tayyor akkaunt sotib olinadi, mijoz shu raqam bilan
// Telegram'ga kiradi va kirish kodi LZT API orqali olinadi
// (GET /{item_id}/telegram-login-code). Premium — xariddayoq havola (giftcode).
//
// DIQQAT: LZT'da xaridni bekor qilib bo'lmaydi — pul qaytmaydi. Shuning uchun
// bu manbaning buyurtmalari refundable=false (ilova ham pul qaytarmaydi).
// Narxlar RUB'da.

const BASE = config.lztBaseUrl.replace(/\/+$/, "");

// Katalogdan slug -> ISO2 (LZT telegram_country bilan bir xil).
const COUNTRY: Record<string, string> = Object.fromEntries(
  COUNTRIES.map((c) => [c.slug, c.spider])
);

class LztError extends Error {}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function api(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.lztApiKey}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let d: any;
  try {
    d = JSON.parse(text);
  } catch {
    throw new LztError(`LZT ${res.status}: ${text.slice(0, 150)}`);
  }
  const errs = d?.errors ?? d?.error;
  if (!res.ok || errs) {
    const msg = Array.isArray(errs) ? errs.join("; ") : String(errs ?? res.status);
    throw new LztError(msg);
  }
  return d;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Qidiruv (eng arzon takliflar) — 45 soniya keshlanadi (LZT rate limit).

interface Offer {
  id: number;
  price: number; // RUB
}

const offerCache = new Map<string, { at: number; offers: Offer[]; total: number }>();
const OFFER_TTL = 45_000;

function searchPath(product: string, variant: string): string | null {
  if (product === "telegram") {
    const iso = COUNTRY[variant];
    if (!iso) return null;
    const q = new URLSearchParams({
      "country[]": iso,
      spam: "no", // spam-blokli akkauntlar yozolmaydi
      password: "no", // 2FA paroli yo'q — mijoz faqat kod bilan kiradi
      order_by: "price_to_up",
    });
    return `/telegram?${q}`;
  }
  if (product === "tg_premium") {
    const plan = planBySlug(variant);
    if (!plan) return null;
    const q = new URLSearchParams({
      subscription: "telegram_premium",
      subscription_length: String(plan.months),
      subscription_period: "month",
      order_by: "price_to_up",
    });
    return `/gifts?${q}`;
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function usable(product: string, i: any): boolean {
  if (i?.item_state && i.item_state !== "active") return false;
  if (i?.canBuyItem === false) return false;
  if (!(Number(i?.price) > 0)) return false;
  if (product === "tg_premium") {
    // Faqat HAVOLA bilan beriladigan gift'lar — avtomatik yetkazib bo'ladi.
    // ("на аккаунт" kabi sotuvchi qo'lda faollashtiradiganlari emas.)
    const t = `${i.title ?? ""} ${i.title_en ?? ""}`.toLowerCase();
    const desc = `${i.descriptionEnPlain ?? ""}`.toLowerCase();
    return /ссылк|link/.test(t) || /gift link|activation link/.test(desc);
  }
  return true;
}

async function offers(product: string, variant: string, fresh = false) {
  const path = searchPath(product, variant);
  if (!path) return null;
  const key = `${product}:${variant}`;
  const hit = offerCache.get(key);
  if (!fresh && hit && Date.now() - hit.at < OFFER_TTL) return hit;

  const d = await api(path);
  const list: Offer[] = (d?.items ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((i: any) => usable(product, i))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((i: any) => ({ id: Number(i.item_id), price: Number(i.price) }))
    .sort((a: Offer, b: Offer) => a.price - b.price);
  const entry = { at: Date.now(), offers: list, total: Number(d?.totalItems) || list.length };
  offerCache.set(key, entry);
  return entry;
}

// ---------------------------------------------------------------------------
// Narxlar taxtasi — barcha davlatlar (yoki Premium muddatlari) bo'yicha eng
// arzon narx + zaxira. UI'da har bir tugma ustida narx ko'rsatish va eng
// arzonidan tartiblash uchun. LZT qidiruv limiti ~120 so'rov/daqiqa, shuning
// uchun 10 daqiqa keshlanadi va bir vaqtda faqat bitta yangilash ketadi.

export interface BoardRow {
  slug: string;
  costRub: number | null; // null — hozir taklif yo'q yoki aniqlanmadi
  count: number;
}

const BOARD_TTL = 10 * 60_000;
const boardCache = new Map<string, { at: number; rows: BoardRow[] }>();
const boardInflight = new Map<string, Promise<BoardRow[]>>();

async function buildBoard(product: string): Promise<BoardRow[]> {
  const slugs =
    product === "tg_premium"
      ? PREMIUM_PLANS.map((p) => p.slug)
      : COUNTRIES.filter((c) => c.spider).map((c) => c.slug);
  const prev = new Map((boardCache.get(product)?.rows ?? []).map((r) => [r.slug, r]));
  const rows: BoardRow[] = [];
  let next = 0;

  // 4 ta parallel ishchi, har so'rovdan keyin kichik pauza — ~60 so'rov
  // ~15 soniyada, limit (120/daqiqa) ichida.
  async function worker() {
    while (next < slugs.length) {
      const slug = slugs[next++];
      try {
        const o = await offers(product, slug, true);
        rows.push({
          slug,
          costRub: o && o.offers.length ? o.offers[0].price : null,
          count: o && o.offers.length ? o.total : 0,
        });
      } catch (e) {
        // Vaqtinchalik xato (429 va h.k.) — eski qiymatni saqlab qolamiz.
        console.warn(`[lzt] board ${product}/${slug}:`, e instanceof Error ? e.message : e);
        rows.push(prev.get(slug) ?? { slug, costRub: null, count: 0 });
      }
      await sleep(250);
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  return rows;
}

/** Mahsulot bo'yicha narxlar taxtasi (keshdan; eskirgan bo'lsa fonda yangilanadi). */
export async function lztBoard(product: string): Promise<BoardRow[] | null> {
  if (product !== "telegram" && product !== "tg_premium") return null;
  const hit = boardCache.get(product);
  const stale = !hit || Date.now() - hit.at > BOARD_TTL;

  if (stale && !boardInflight.has(product)) {
    const job = buildBoard(product)
      .then((rows) => {
        boardCache.set(product, { at: Date.now(), rows });
        return rows;
      })
      .finally(() => boardInflight.delete(product));
    boardInflight.set(product, job);
  }
  // Eski qiymat bo'lsa — darhol qaytaramiz (stale-while-revalidate),
  // birinchi marta esa yig'ilishini kutamiz.
  if (hit) return hit.rows;
  return boardInflight.get(product) ?? null;
}

// ---------------------------------------------------------------------------
// Xarid

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fastBuy(id: number, price: number): Promise<any> {
  // LZT hujjati: "retry_request" xatosida xuddi shu so'rovni qaytarish kerak.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await api(`/${id}/fast-buy`, {
        method: "POST",
        body: JSON.stringify({ price }),
      });
    } catch (e) {
      if (e instanceof LztError && /retry_request/i.test(e.message)) {
        await sleep(1000);
        continue;
      }
      throw e;
    }
  }
  throw new LztError("retry_request");
}

function isBalanceError(msg: string): boolean {
  return /balance|баланс|недостаточно|insufficient|not enough/i.test(msg);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findGiftLink(item: any): string | null {
  const m = JSON.stringify(item ?? {}).match(
    /https?:\\?\/\\?\/(?:t\.me|telegram\.me)\\?\/giftcode\\?\/[A-Za-z0-9_-]+/
  );
  return m ? m[0].replace(/\\\//g, "/") : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findPhone(item: any): string | null {
  const cands = [
    item?.loginData?.login,
    item?.login,
    item?.telegram_phone,
    item?.loginData?.raw,
  ];
  for (const c of cands) {
    const m = String(c ?? "").match(/\+?\d{9,15}/);
    if (m) return m[0].startsWith("+") ? m[0] : "+" + m[0];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Kirish kodi — har bir item uchun 5 soniya keshlanadi (mijoz har 3s so'raydi).

const codeCache = new Map<string, { at: number; state: OrderState }>();
const CODE_TTL = 5_000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractCodes(d: any): { code: string; date: number; text: string }[] {
  const raw: unknown[] = [];
  const push = (v: unknown) => {
    if (Array.isArray(v)) raw.push(...v);
    else if (v != null) raw.push(v);
  };
  push(d?.codes);
  push(d?.code);
  push(d?.item?.codes);
  push(d?.item?.code);

  const out: { code: string; date: number; text: string }[] = [];
  for (const r of raw) {
    let text: string;
    let date = 0;
    if (typeof r === "object" && r) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const o = r as any;
      text = String(o.code ?? o.value ?? o.textPlain ?? o.text ?? o.message ?? "");
      date = Number(o.date ?? o.time ?? o.created_at ?? 0) || 0;
    } else {
      text = String(r);
    }
    const m = text.match(/\b\d{5,6}\b/) || text.match(/\d{5,6}/);
    if (m) out.push({ code: m[0], date, text });
  }
  return out.sort((a, b) => b.date - a.date);
}

// ---------------------------------------------------------------------------

export const lztProvider: SmsProvider = {
  name: "lzt",

  async getPrice(product, country): Promise<ProviderPrice | null> {
    const o = await offers(product, country);
    if (!o || o.offers.length === 0) return null;
    return {
      product,
      country,
      operator: "any",
      costRub: o.offers[0].price,
      currency: "RUB",
      count: o.total,
    };
  },

  async buy(product, country): Promise<BoughtNumber> {
    // getPrice (mijozga ko'rsatilgan narx) keshdan — undan QIMMAT taklifni
    // olmaymiz: LZT xaridi qaytmaydi, mijoz balansi esa aynan shu narxga
    // tekshirilgan. Keyin yangi ro'yxatdan shu chegaradagilarni sinaymiz.
    const shown = await offers(product, country);
    if (!shown || shown.offers.length === 0) {
      throw new Error("Bu yo'nalishda hozircha mavjud emas. Boshqasini tanlang.");
    }
    const cap = shown.offers[0].price;
    const fresh = await offers(product, country, true);
    const queue = [...shown.offers, ...(fresh?.offers ?? [])]
      .filter((x, i, a) => x.price <= cap && a.findIndex((y) => y.id === x.id) === i)
      .slice(0, 5);
    if (queue.length === 0) {
      throw new Error("Narx o'zgardi. Sahifani yangilab, qayta urinib ko'ring.");
    }

    // Eng arzon bir nechta takliflarni navbat bilan sinaymiz — kimdir bizdan
    // oldin sotib olgan bo'lishi mumkin.
    let lastErr = "";
    for (const offer of queue) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let d: any;
      try {
        d = await fastBuy(offer.id, offer.price);
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
        if (isBalanceError(lastErr)) {
          console.error("[lzt] balans yetarli emas:", lastErr);
          throw new Error("Hozircha mavjud emas. Birozdan keyin urinib ko'ring.");
        }
        console.warn(`[lzt] item ${offer.id} olinmadi:`, lastErr);
        continue;
      }

      offerCache.delete(`${product}:${country}`);
      const item = d?.item ?? {};
      const paid = offer.price; // fast-buy aynan shu narxda o'tadi (<= cap)
      const boughtAt = Math.floor(Date.now() / 1000);

      if (product === "tg_premium") {
        const link = findGiftLink(item);
        const raw = String(item?.loginData?.raw ?? item?.loginData?.login ?? "");
        const delivered: ProviderSms = link
          ? { code: link, text: link, sender: "LZT" }
          : {
              code: null,
              // Havola topilmasa ham — to'langan! Admin LZT'dan tekshiradi.
              text: raw || `LZT #${offer.id}: havola tayyorlanmoqda, admin bilan bog'laning`,
              sender: "LZT",
            };
        return {
          providerId: `${offer.id}:${boughtAt}`,
          phone: `Premium · LZT #${offer.id}`,
          operator: "any",
          costRub: paid,
          currency: "RUB",
          expiresAt: null,
          delivered,
          refundable: false,
        };
      }

      // Telegram akkaunt. Raqam topilmasa ham xarid bo'lgan — buyurtma
      // yaratamiz (kod item_id bo'yicha olinadi), admin raqamni LZT'dan ko'radi.
      const phone = findPhone(item) ?? `LZT #${offer.id}`;
      return {
        providerId: `${offer.id}:${boughtAt}`,
        phone,
        operator: "any",
        costRub: paid,
        currency: "RUB",
        expiresAt: null, // LZT'da muddat yo'q — akkaunt mijozniki
        refundable: false,
      };
    }

    console.error("[lzt] hech bir taklif olinmadi:", lastErr);
    throw new Error("Hozircha mavjud emas. Birozdan keyin urinib ko'ring.");
  },

  async check(providerId): Promise<OrderState> {
    const [itemId, ts] = providerId.split(":");
    const hit = codeCache.get(itemId);
    if (hit && Date.now() - hit.at < CODE_TTL) return hit.state;

    let state: OrderState = { status: "PENDING", sms: [] };
    try {
      const d = await api(`/${itemId}/telegram-login-code`);
      const since = (Number(ts) || 0) - 60;
      // Sana bor bo'lsa — faqat xariddan keyingi kodlar (sotuvchining eski
      // tekshiruv kodlari mijozga chiqib qolmasin).
      const code = extractCodes(d).find((c) => !c.date || c.date >= since);
      if (code) {
        state = {
          status: "RECEIVED",
          sms: [{ code: code.code, text: code.text, sender: "Telegram" }],
        };
      }
    } catch {
      // Kod hali yo'q yoki vaqtinchalik xato — kutishda davom etamiz.
    }
    codeCache.set(itemId, { at: Date.now(), state });
    return state;
  },

  async cancel(): Promise<void> {
    // LZT'da xaridni bekor qilib bo'lmaydi.
  },

  async finish(): Promise<void> {},

  async balanceRub(): Promise<number> {
    const d = await api("/me");
    return Number(d?.user?.balance ?? 0);
  },
};
