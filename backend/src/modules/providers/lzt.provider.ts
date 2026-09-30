import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface LztItem {
  itemId: number;
  priceRub: number;
  title: string;
  /** Akkaunt kelib chiqishi: autoreg/personal/... (`phishing` va h.k. — o'g'irlangan). */
  origin: string | null;
  /** Kafolat muddati (soat). null bo'lsa kafolat YO'Q. */
  guaranteeHours: number | null;
  publishedAt: Date | null;
}

/** Sotib olingan akkaunt ma'lumoti (fast-buy javobidan). */
export interface LztPurchase {
  itemId: number;
  priceRub: number;
  /** Telegram raqami (+ bilan). Javobdan ajratib bo'lmasa null. */
  phone: string | null;
  /** Premium gift havolasi (t.me/giftcode/...), bo'lsa. */
  giftLink: string | null;
}

export interface LztLoginCode {
  code: string;
  /** Unix soniya; LZT bermasa 0. */
  date: number;
  text: string;
}

/**
 * Faqat QONUNIY kelib chiqqan akkauntlar. LZT'dagi eng arzon Telegram
 * akkauntlari ko'pincha `phishing` / `brute` / `stealer` — ya'ni O'G'IRLANGAN
 * (2026-10 tekshiruvi: Hindiston/Indoneziyadagi 10 ₽ lik e'lonlarning
 * hammasi `phishing`). Ularni sotmaymiz. `resale` asl kelib chiqishini
 * yashiradi — uni ham olmaymiz.
 */
export const LZT_SAFE_ORIGINS = ['autoreg', 'self_registration', 'personal'];

/** LZT javobidagi xato matnini bitta satrga yig'adi. */
function lztError(body: unknown): string {
  const b = body as { errors?: unknown[]; error?: string; error_description?: string };
  if (Array.isArray(b?.errors) && b.errors.length) return String(b.errors[0]);
  return b?.error_description ?? b?.error ?? 'LZT xatosi';
}

/**
 * LZT Market (lzt.market) — Telegram akkauntlari va Premium sovg'a havolalari.
 *
 * Base: https://prod-api.lzt.market
 * Auth: `Authorization: Bearer <JWT>`
 *
 * DIQQAT — bu PROVAYDER EMAS, BOZOR (C2C marketplace):
 *   • Avval e'lonlar ichidan mosini QIDIRIB topish, keyin o'shani sotib olish
 *     kerak. Har e'lon bitta sotuvchining bitta tovari.
 *   • Xarid QAYTARILMAYDI — bekor qilish endpointi yo'q.
 *   • `fast-buy` ga joriy narx (`price`) majburiy: narx o'zgargan bo'lsa LZT
 *     rad etadi — bu bizni kutilmagan qimmat xariddan himoya qiladi.
 *
 * Narxlar RUBLDA. Limit: qidiruv ~120/daqiqa, fast-buy 300/daqiqa — quyida
 * sodda navbat bor. `retry_request` xatosida AYNAN SHU so'rov qaytariladi.
 */
@Injectable()
export class LztProvider {
  private readonly logger = new Logger(LztProvider.name);
  /** Ketma-ket so'rovlar orasidagi minimal masofa. */
  private static readonly MIN_GAP_MS = 550;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly config: ConfigService) {}

  private get token(): string {
    return (this.config.get<string>('LZT_API_KEY') ?? '').trim();
  }
  private get baseUrl(): string {
    return (
      this.config.get<string>('LZT_BASE_URL') ?? 'https://prod-api.lzt.market'
    ).replace(/\/$/, '');
  }
  isConfigured(): boolean {
    return this.token.length > 0;
  }

  /** So'rovlarni navbatga soladi — limitga urilib qolmaslik uchun. */
  private schedule<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      try {
        return await fn();
      } finally {
        await new Promise((r) => setTimeout(r, LztProvider.MIN_GAP_MS));
      }
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    query?: Record<string, string | number | string[] | undefined>,
    body?: Record<string, unknown>,
  ): Promise<T> {
    if (!this.isConfigured()) throw new Error('LZT_API_KEY sozlanmagan');
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(query ?? {})) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, x));
      else url.searchParams.set(k, String(v));
    }
    return this.schedule(async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        const res = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: 'application/json',
            ...(body ? { 'Content-Type': 'application/json' } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
          signal: AbortSignal.timeout(30_000),
        });
        const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        const hasErrors = Array.isArray(json.errors) && json.errors.length > 0;
        if (res.ok && !hasErrors) return json as T;
        if (/retry_request/i.test(JSON.stringify(json))) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        throw new Error(`LZT ${res.status}: ${lztError(json)}`);
      }
      throw new Error('LZT: retry_request 5 marta takrorlandi');
    });
  }

  /** Hisobdagi balans (rubl). */
  async balanceRub(): Promise<number> {
    const me = await this.request<{ user?: Record<string, unknown> } & Record<string, unknown>>(
      'GET',
      '/me',
    );
    const u = (me.user ?? me) as Record<string, unknown>;
    return Number(u.balance ?? 0);
  }

  private mapItem(raw: Record<string, unknown>): LztItem {
    const g = raw.guarantee_duration ?? raw.guarantee;
    return {
      itemId: Number(raw.item_id),
      priceRub: Number(raw.price ?? raw.rub_price ?? 0),
      title: String(raw.title_en ?? raw.title ?? '').trim(),
      origin: raw.item_origin == null ? null : String(raw.item_origin),
      guaranteeHours: g == null || typeof g === 'object' ? null : Number(g),
      publishedAt: raw.published_date ? new Date(Number(raw.published_date) * 1000) : null,
    };
  }

  /**
   * Berilgan davlatning sotib olsa bo'ladigan Telegram akkauntlari
   * (arzondan qimmatga) + umumiy zaxira soni.
   * Filtrlar: spam-blok yo'q, 2FA paroli yo'q (mijoz faqat kod bilan
   * kiradi), faqat qonuniy kelib chiqish (LZT_SAFE_ORIGINS).
   */
  async searchTelegram(iso2: string): Promise<{ items: LztItem[]; total: number }> {
    const res = await this.request<{
      items?: Record<string, unknown>[];
      totalItems?: number;
    }>('GET', '/telegram', {
      'country[]': [iso2.toUpperCase()],
      'origin[]': LZT_SAFE_ORIGINS,
      spam: 'no',
      password: 'no',
      order_by: 'price_to_up',
    });
    const items = (res.items ?? [])
      .filter((r) => r.canBuyItem !== false)
      .filter((r) => !r.item_state || r.item_state === 'active')
      .map((r) => this.mapItem(r))
      // Qidiruv filtri ishlamay qolsa ham o'g'irlangan akkaunt o'tib ketmasin.
      .filter((i) => LZT_SAFE_ORIGINS.includes(String(i.origin)))
      .filter((i) => i.priceRub > 0)
      .sort((a, b) => a.priceRub - b.priceRub);
    return { items, total: Number(res.totalItems) || items.length };
  }

  /**
   * Telegram Premium sovg'a havolasini qidiradi (3/6/12 oy).
   * Faqat HAVOLA bilan beriladiganlari — sotuvchi qo'lda faollashtiradiganlari emas.
   */
  async searchPremiumGift(months: 3 | 6 | 12): Promise<LztItem[]> {
    const res = await this.request<{ items?: Record<string, unknown>[] }>('GET', '/gifts', {
      subscription: 'telegram_premium',
      subscription_length: months,
      subscription_period: 'month',
      order_by: 'price_to_up',
    });
    return (res.items ?? [])
      .filter((r) => r.canBuyItem !== false)
      .filter((r) => {
        const t = `${r.title ?? ''} ${r.title_en ?? ''}`.toLowerCase();
        const d = String(r.descriptionEnPlain ?? '').toLowerCase();
        return /ссылк|link/.test(t) || /gift link|activation link/.test(d);
      })
      .map((r) => this.mapItem(r))
      .sort((a, b) => a.priceRub - b.priceRub);
  }

  /** E'lon hali sotuvdami va narxi o'zgarmaganmi. */
  async itemState(itemId: number): Promise<{ active: boolean; priceRub: number }> {
    const res = await this.request<{ item?: Record<string, unknown> }>('GET', `/${itemId}`);
    const it = (res.item ?? res) as Record<string, unknown>;
    return {
      active: String(it.item_state ?? '') === 'active',
      priceRub: Number(it.price ?? it.rub_price ?? 0),
    };
  }

  /**
   * Sotib olish. `price` MAJBURIY — LZT uni joriy narx bilan solishtiradi va
   * farq bo'lsa rad etadi (sotuvchi narxni ko'tarib yuborishidan himoya).
   * Javobdagi loginData'dan telefon raqami / gift havolasi ajratiladi.
   */
  async buy(itemId: number, priceRub: number): Promise<LztPurchase> {
    const res = await this.request<{ item?: Record<string, unknown> }>(
      'POST',
      `/${itemId}/fast-buy`,
      undefined,
      { price: priceRub },
    );
    const item = (res.item ?? {}) as Record<string, unknown>;
    this.logger.log(`LZT xarid: item ${itemId}, ${priceRub} rub`);
    return {
      itemId,
      priceRub,
      phone: LztProvider.findPhone(item),
      giftLink: LztProvider.findGiftLink(item),
    };
  }

  /**
   * Sotib olingan Telegram akkauntiga kelgan kirish kodlari (yangisi birinchi).
   * Mijoz raqamni Telegram'ga kiritadi, kodni biz shu yerdan olamiz —
   * ya'ni UX oddiy SMS-raqam mahsuloti bilan bir xil.
   */
  async telegramLoginCodes(itemId: number): Promise<LztLoginCode[]> {
    const res = await this.request<Record<string, unknown>>(
      'GET',
      `/${itemId}/telegram-login-code`,
    );
    // Javob shakli hujjatlashtirilmagan — bir necha variantni qo'llaymiz.
    const raw: unknown[] = [];
    const push = (v: unknown) => {
      if (Array.isArray(v)) raw.push(...v);
      else if (v != null) raw.push(v);
    };
    const item = res.item as Record<string, unknown> | undefined;
    push(res.codes);
    push(res.code ?? res.login_code ?? res.telegram_login_code);
    push(item?.codes);
    push(item?.code);

    const out: LztLoginCode[] = [];
    for (const r of raw) {
      let text: string;
      let date = 0;
      if (r && typeof r === 'object') {
        const o = r as Record<string, unknown>;
        text = String(o.code ?? o.value ?? o.textPlain ?? o.text ?? o.message ?? '');
        date = Number(o.date ?? o.time ?? o.created_at ?? 0) || 0;
      } else {
        text = String(r);
      }
      const m = text.match(/\b\d{5,6}\b/) ?? text.match(/\d{5,6}/);
      if (m) out.push({ code: m[0], date, text });
    }
    return out.sort((a, b) => b.date - a.date);
  }

  static findPhone(item: Record<string, unknown>): string | null {
    const ld = (item.loginData ?? {}) as Record<string, unknown>;
    for (const c of [ld.login, item.login, item.telegram_phone, ld.raw]) {
      const m = String(c ?? '').match(/\+?\d{9,15}/);
      if (m) return m[0].startsWith('+') ? m[0] : '+' + m[0];
    }
    return null;
  }

  static findGiftLink(item: Record<string, unknown>): string | null {
    const m = JSON.stringify(item).match(
      /https?:\\?\/\\?\/(?:t\.me|telegram\.me)\\?\/giftcode\\?\/[A-Za-z0-9_-]+/,
    );
    return m ? m[0].replace(/\\\//g, '/') : null;
  }
}
