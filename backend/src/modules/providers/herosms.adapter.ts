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

/// HeroSMS — SMS-Activate protokoli (handler_api.php). Arzon, boshqa xizmatlar uchun.
/// Cloudflare oddiy so'rovni bloklaydi — brauzer User-Agent kerak.
@Injectable()
export class HeroSmsAdapter implements ProviderAdapter {
  readonly kind = ProviderKind.HEROSMS;
  private readonly logger = new Logger(HeroSmsAdapter.name);

  constructor(private readonly config: ConfigService) {}

  private get apiKey(): string {
    return this.config.get<string>('HEROSMS_API_KEY') ?? '';
  }
  private get baseUrl(): string {
    return (
      this.config.get<string>('HEROSMS_BASE_URL') ??
      'https://hero-sms.com/stubs/handler_api.php'
    );
  }
  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  private async api(
    action: string,
    params: Record<string, string | number> = {},
  ): Promise<string> {
    const url = new URL(this.baseUrl);
    url.searchParams.set('api_key', this.apiKey);
    url.searchParams.set('action', action);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }
    // TIMEOUT SHART: usiz osilgan so'rov polling cron'ini bloklaydi.
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': PROVIDER_UA, Accept: '*/*' },
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `HeroSMS ${action} -> ${res.status}: ${text.slice(0, 150)}`,
      );
    }
    return text.trim();
  }

  /**
   * Butun zaxira xaritasi BITTA so'rovda: davlat kodi -> zaxirasi bor xizmatlar.
   * Vitrinada har taklif uchun alohida so'rov yubormaslik uchun (50 taklif =
   * 50 so'rov bo'lib ketardi). Javob ~1MB, shuning uchun 3 daqiqa keshlanadi.
   */
  private stockCache: { at: number; map: Map<string, Set<string>> } | null = null;
  /**
   * TO'LIQ narx/zaxira jadvali: davlat -> xizmat -> { cost, count }.
   * `getPrices` (parametrsiz) baribir hammasini qaytaradi, shuning uchun bitta
   * so'rov ikkala ehtiyojni ham qoplaydi: zaxira (`availableMap`) va narx
   * (`getPriceUsd`). Narxlar sahifasida har kartochka alohida so'rov
   * yubormasligi uchun shu kesh MUHIM.
   */
  private priceCache: { at: number; map: Map<string, Map<string, { cost: number; count: number }>> } | null =
    null;
  /**
   * Ayni damda ketayotgan so'rov. Kesh SOVUQ bo'lganda vitrina o'nlab taklif
   * uchun bu metodni BIR VAQTDA chaqiradi; kesh esa javob kelgandan keyingina
   * yoziladi, ya'ni hammasi provayderga alohida so'rov yuborardi (Cloudflare
   * ularni cheklab, vitrina "Xatolik yuz berdi" bo'lib qolardi).
   * Shu maydon orqali barcha chaqiruvlar BITTA so'rovni kutadi.
   */
  private stockInFlight: Promise<Map<string, Set<string>>> | null = null;

  async availableMap(): Promise<Map<string, Set<string>>> {
    const now = Date.now();
    if (this.stockCache && now - this.stockCache.at < 3 * 60 * 1000) {
      return this.stockCache.map;
    }
    if (this.stockInFlight) return this.stockInFlight;

    this.stockInFlight = (async () => {
      try {
        const text = await this.api('getPrices');
        const data = JSON.parse(text) as Record<
          string,
          Record<string, { cost?: number; count?: number }>
        >;
        const map = new Map<string, Set<string>>();
        const prices = new Map<string, Map<string, { cost: number; count: number }>>();
        for (const [country, services] of Object.entries(data ?? {})) {
          const set = new Set<string>();
          const row = new Map<string, { cost: number; count: number }>();
          for (const [svc, info] of Object.entries(services ?? {})) {
            const count = Number(info?.count ?? 0);
            const cost = Number(info?.cost);
            row.set(svc, { cost: Number.isFinite(cost) ? cost : NaN, count });
            if (count > 0) set.add(svc);
          }
          if (row.size) prices.set(country, row);
          if (set.size) map.set(country, set);
        }
        const at = Date.now();
        if (map.size) this.stockCache = { at, map };
        // Narx keshini ham SHU javobdan to'ldiramiz — `getPriceUsd` endi
        // tashqi so'rov yubormaydi.
        if (prices.size) this.priceCache = { at, map: prices };
        return map;
      } catch (e) {
        this.logger.warn(`availableMap: ${String(e)}`);
        // Xato bo'lsa eski keshni beramiz — vitrina to'satdan bo'shab qolmasin.
        return this.stockCache?.map ?? new Map();
      } finally {
        this.stockInFlight = null;
      }
    })();

    return this.stockInFlight;
  }

  /**
   * (xizmat × davlat) tan narxi.
   *
   * TEZLIK: ilgari HAR chaqiruvda provayderga alohida HTTP so'rov ketardi —
   * "Narxlar" sahifasida har kartochka bittadan so'rov qilib, sahifa juda
   * sekin ochilardi (Cloudflare ham cheklab qo'yardi). Endi javob 3 daqiqalik
   * TO'LIQ narx keshidan olinadi: N ta kartochka = 1 ta tashqi so'rov.
   */
  async getPriceUsd(input: BuyInput): Promise<number | null> {
    const c = input.countryHeroCode;
    const s = input.serviceHeroCode;
    if (!c || !s) return null;

    const fresh =
      this.priceCache && Date.now() - this.priceCache.at < 3 * 60 * 1000
        ? this.priceCache
        : null;
    if (!fresh) {
      // Keshni to'ldiradi (bir vaqtdagi chaqiruvlar bitta so'rovni kutadi).
      await this.availableMap();
    }

    const info = this.priceCache?.map.get(c)?.get(s);
    if (!info || info.count <= 0) return null;
    return Number.isFinite(info.cost) ? info.cost : null;
  }

  async buy(input: BuyInput): Promise<BuyResult> {
    const c = input.countryHeroCode;
    const s = input.serviceHeroCode;
    if (!c || !s) throw new Error("Bu yo'nalish qo'llab-quvvatlanmaydi");

    let text: string;
    try {
      text = await this.api('getNumberV2', { service: s, country: c });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('402')) {
        throw new Error(
          "Raqam hozircha mavjud emas. Birozdan keyin urinib ko'ring.",
        );
      }
      throw e;
    }

    if (text.includes('NO_NUMBERS')) {
      throw new Error("Bu yo'nalishda raqam tugagan. Boshqa davlatni tanlang.");
    }
    if (text.includes('NO_BALANCE')) {
      throw new Error(
        "Raqam hozircha mavjud emas. Birozdan keyin urinib ko'ring.",
      );
    }

    // KLASSIK format: "ACCESS_NUMBER:<id>:<telefon>". Ba'zi SMS-Activate
    // uslubidagi panellar (masalan Tiger SMS) getNumberV2 dan ham shuni
    // qaytarishi mumkin — JSON'dan oldin shuni tekshiramiz.
    if (text.startsWith('ACCESS_NUMBER')) {
      const [, id, phone] = text.split(':');
      if (!id || !phone) throw new Error(`Xatolik: ${text}`);
      return {
        providerId: id.trim(),
        phone: phone.trim().startsWith('+') ? phone.trim() : '+' + phone.trim(),
        costUsd: 0, // klassik javobda narx yo'q — getPrices bilan hisoblanadi
        expiresAt: new Date(Date.now() + 20 * 60 * 1000),
      };
    }

    let data: {
      activationId?: number | string;
      phoneNumber?: string;
      activationCost?: string | number;
      // V2 imlo variantlari (panelga qarab farq qiladi)
      id?: number | string;
      phone?: string;
      cost?: string | number;
    };
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Xatolik: ${text}`);
    }
    const activationId = data.activationId ?? data.id;
    const phoneNumber = data.phoneNumber ?? data.phone;
    if (!activationId || !phoneNumber) {
      throw new Error(`Xatolik: ${text}`);
    }
    const ph = String(phoneNumber);
    return {
      providerId: String(activationId),
      phone: ph.startsWith('+') ? ph : '+' + ph,
      costUsd: Number(data.activationCost ?? data.cost) || 0,
      expiresAt: new Date(Date.now() + 20 * 60 * 1000),
    };
  }

  async check(providerId: string): Promise<CheckResult> {
    const text = await this.api('getStatus', { id: providerId });
    // STATUS_WAIT_CODE | STATUS_OK:code | STATUS_WAIT_RETRY:code | STATUS_CANCEL
    if (text.startsWith('STATUS_OK') || text.startsWith('STATUS_WAIT_RETRY')) {
      const code = text.split(':')[1] || null;
      if (code) return { status: 'RECEIVED', code, text: code };
    }
    if (text.startsWith('STATUS_CANCEL')) {
      return { status: 'CANCELLED', code: null, text: null };
    }
    return { status: 'WAITING', code: null, text: null };
  }

  async cancel(providerId: string): Promise<void> {
    await this.api('setStatus', { id: providerId, status: 8 }); // 8 = bekor
  }

  async finish(providerId: string): Promise<void> {
    await this.api('setStatus', { id: providerId, status: 6 }); // 6 = yakunlash
  }

  async balanceUsd(): Promise<number> {
    const text = await this.api('getBalance'); // ACCESS_BALANCE:0.00
    const val = text.split(':')[1];
    return val ? Number(val) : 0;
  }
}
