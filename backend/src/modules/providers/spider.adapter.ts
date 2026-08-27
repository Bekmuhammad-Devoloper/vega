import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProviderKind } from '@prisma/client';
import {
  BuyInput,
  BuyResult,
  CheckResult,
  ProviderAdapter,
  PROVIDER_UA,
} from './provider.types';

/// SPIDER TG API — real SIM, Telegram uchun ISHLAYDI.
/// Endpoint: ?apiKay=<KEY>&action=getNumber&country=ISO2 | getCode&hash_code=X
/// (auth param imlosi "apiKay" — ularning imlosi, shunday qoladi).
@Injectable()
export class SpiderAdapter implements ProviderAdapter {
  readonly kind = ProviderKind.SPIDER;
  private readonly logger = new Logger(SpiderAdapter.name);
  private countryCache: { at: number; set: Set<string> } | null = null;

  constructor(private readonly config: ConfigService) {}

  private get apiKey(): string {
    return this.config.get<string>('SPIDER_API_KEY') ?? '';
  }
  private get baseUrl(): string {
    return (
      this.config.get<string>('SPIDER_BASE_URL') ??
      'https://api.spider-service.com'
    );
  }
  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async api(
    action: string,
    params: Record<string, string> = {},
  ): Promise<any> {
    const url = new URL(this.baseUrl);
    url.searchParams.set('apiKay', this.apiKey);
    url.searchParams.set('action', action);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': PROVIDER_UA, Accept: 'application/json' },
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`SPIDER ${action}: ${text.slice(0, 150)}`);
    }
  }

  async getPriceUsd(input: BuyInput): Promise<number | null> {
    const iso = input.countryIso2;
    if (!iso) return null;
    try {
      const d = await this.api('getCountrys');
      const groups = d?.result?.countries ?? {};
      // countries — guruhlar obyekti; har guruh ichida { ISO2: narx }.
      for (const grp of Object.values(groups)) {
        const g = grp as Record<string, unknown>;
        if (g && g[iso] != null) {
          const n = Number(g[iso]);
          return Number.isFinite(n) ? n : null;
        }
      }
      return null;
    } catch (e) {
      this.logger.warn(`getPriceUsd(${iso}): ${String(e)}`);
      return null;
    }
  }

  /**
   * SPIDER'da AYNI PAYTDA mavjud davlat ISO2 kodlari.
   * SPIDER `getCountrys` faqat zaxirasi bor davlatlarni qaytaradi — ya'ni bu
   * bir vaqtning o'zida "qo'llab-quvvatlanadi" va "hozir bor" degani.
   * TTL qisqa (3 daqiqa): zaxira tugaganda vitrinada uzoq turib qolmasin.
   */
  async supportedIso2(): Promise<Set<string>> {
    const now = Date.now();
    if (this.countryCache && now - this.countryCache.at < 3 * 60 * 1000) {
      return this.countryCache.set;
    }
    try {
      const d = await this.api('getCountrys');
      const groups = d?.result?.countries ?? {};
      const set = new Set<string>();
      for (const grp of Object.values(groups)) {
        const g = grp as Record<string, unknown>;
        for (const k of Object.keys(g ?? {})) set.add(k.toUpperCase());
      }
      if (set.size) this.countryCache = { at: now, set };
      return set;
    } catch (e) {
      this.logger.warn(`supportedIso2: ${String(e)}`);
      return this.countryCache?.set ?? new Set();
    }
  }

  async buy(input: BuyInput): Promise<BuyResult> {
    const iso = input.countryIso2;
    if (!iso) throw new Error("Bu davlat qo'llab-quvvatlanmaydi");

    const d = await this.api('getNumber', { country: iso });
    if (!d?.ok) {
      const e = String(d?.error || '').toUpperCase();
      if (e.includes('BALANCE')) {
        throw new Error(
          "Raqam hozircha mavjud emas. Birozdan keyin urinib ko'ring.",
        );
      }
      if (
        e.includes('NO_NUMBER') ||
        e.includes('NOT_FOUND') ||
        e.includes('EMPTY')
      ) {
        throw new Error("Bu yo'nalishda raqam tugagan. Boshqa davlatni tanlang.");
      }
      throw new Error(`Xatolik: ${d?.error || "noma'lum"}`);
    }

    const r = d.result || {};
    const phone = r.number ?? r.phone ?? r.phoneNumber ?? r.tel;
    const hash = r.hash_code ?? r.hash ?? r.hashCode ?? r.id;
    if (!phone || !hash) {
      throw new Error(
        `SPIDER javobi tushunarsiz: ${JSON.stringify(r).slice(0, 140)}`,
      );
    }
    return {
      providerId: String(hash),
      phone: String(phone).startsWith('+')
        ? String(phone)
        : '+' + String(phone),
      costUsd: Number(r.price ?? r.cost) || 0,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };
  }

  async check(providerId: string): Promise<CheckResult> {
    const d = await this.api('getCode', { hash_code: providerId });
    const r = d?.result;
    let code: string | null = null;
    if (r && typeof r === 'object') {
      code = r.code ?? r.sms ?? r.otp ?? null;
    } else if (typeof r === 'string') {
      code = r;
    }
    if (d?.ok && code && /\d/.test(String(code))) {
      return { status: 'RECEIVED', code: String(code), text: String(code) };
    }
    const err = String(d?.error || '').toUpperCase();
    // "WITE_CODE" = kutish (ularning imlosi). CANCEL/TIMEOUT/EXPIRE = bekor.
    if (
      err.includes('CANCEL') ||
      err.includes('TIMEOUT') ||
      err.includes('EXPIRE')
    ) {
      return { status: 'CANCELLED', code: null, text: null };
    }
    return { status: 'WAITING', code: null, text: null };
  }

  async cancel(): Promise<void> {
    // SPIDER'da bekor qilish action yo'q — kod kelmasa avtomatik tugaydi.
  }

  async finish(): Promise<void> {}

  async balanceUsd(): Promise<number> {
    const d = await this.api('getBalance');
    return Number(d?.result?.wallet ?? 0);
  }
}
