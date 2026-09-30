import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProviderKind } from '@prisma/client';
import { BuyInput, BuyResult, CheckResult, ProviderAdapter } from './provider.types';
import { LztItem, LztProvider } from './lzt.provider';

/// LZT Market — Telegram raqami (tayyor AKKAUNT + kirish kodi API orqali).
/// SMS-activation emas: akkaunt sotib olinadi, mijoz shu raqam bilan
/// Telegram'ga kiradi, kod `telegram-login-code` dan olinadi.
///
/// MUHIM FARQLAR (numbers.service shularni hisobga oladi):
///   • Xarid QAYTARILMAYDI — cancel() provayderda hech narsa qilmaydi;
///     mijoz o'zi bekor qila olmaydi, muddat tugasa pul avtomatik qaytmaydi.
///   • Narx RUB'da — RUB_TO_UZS / USD_TO_UZS orqali USD'ga o'giriladi
///     (katalog qatlami USD bilan ishlaydi).
@Injectable()
export class LztAdapter implements ProviderAdapter {
  readonly kind = ProviderKind.LZT;
  private readonly logger = new Logger(LztAdapter.name);

  /** ISO2 -> eng arzon takliflar. Mijozga ko'rsatilgan narx shu yerdan. */
  private offers = new Map<string, { at: number; items: LztItem[]; total: number }>();
  private static readonly OFFER_TTL = 60_000;
  /** Vitrina filtri uchun: ISO2 -> zaxira bormi (uzoqroq kesh). */
  private stock = new Map<string, { at: number; ok: boolean }>();
  private static readonly STOCK_TTL = 15 * 60_000;
  /** Kod so'rovlari keshi — cron + mijoz poll'i LZT'ni bombardimon qilmasin. */
  private codeCache = new Map<string, { at: number; res: CheckResult }>();
  private static readonly CODE_TTL = 5_000;
  /** Kod kelmagan akkaunt qancha kutiladi (keyin EXPIRED, pul qaytmaydi). */
  static readonly WAIT_MS = 2 * 60 * 60_000;

  constructor(
    private readonly lzt: LztProvider,
    private readonly config: ConfigService,
  ) {}

  isConfigured(): boolean {
    return this.lzt.isConfigured();
  }

  private num(key: string, def: number): number {
    const v = Number(this.config.get(key));
    return Number.isFinite(v) && v > 0 ? v : def;
  }
  /** 1 RUB necha USD (RUB_TO_UZS / USD_TO_UZS). */
  private get rubToUsd(): number {
    return this.num('RUB_TO_UZS', 150) / this.num('USD_TO_UZS', 12000);
  }

  private async load(iso2: string, fresh = false) {
    const iso = iso2.toUpperCase();
    const hit = this.offers.get(iso);
    if (!fresh && hit && Date.now() - hit.at < LztAdapter.OFFER_TTL) return hit;
    const r = await this.lzt.searchTelegram(iso);
    const entry = { at: Date.now(), items: r.items, total: r.total };
    this.offers.set(iso, entry);
    this.stock.set(iso, { at: Date.now(), ok: r.items.length > 0 });
    return entry;
  }

  /**
   * Vitrina filtri: davlat bo'yicha zaxira ma'lumi bo'lsa true/false,
   * hali tekshirilmagan bo'lsa null (yashirmaymiz — xaridda tekshiriladi).
   */
  knownStock(iso2: string): boolean | null {
    const s = this.stock.get(iso2.toUpperCase());
    return s && Date.now() - s.at < LztAdapter.STOCK_TTL ? s.ok : null;
  }

  async getPriceUsd(input: BuyInput): Promise<number | null> {
    if (!input.countryIso2) return null;
    const o = await this.load(input.countryIso2);
    const cheapest = o.items[0];
    return cheapest ? cheapest.priceRub * this.rubToUsd : null;
  }

  async buy(input: BuyInput): Promise<BuyResult> {
    const iso = (input.countryIso2 ?? '').toUpperCase();
    if (!iso) throw new BadRequestException("Bu davlat qo'llab-quvvatlanmaydi");

    // Mijozga ko'rsatilgan (quote) narx keshda — undan QIMMAT e'lonni
    // olmaymiz: xarid qaytmaydi, ulgurji esa shu narx bo'yicha hisoblangan.
    const shown = await this.load(iso);
    if (!shown.items.length) {
      throw new BadRequestException("Bu yo'nalishda hozircha raqam yo'q. Boshqa davlatni tanlang.");
    }
    const cap = shown.items[0].priceRub;
    const fresh = await this.load(iso, true);
    const queue = [...shown.items, ...fresh.items]
      .filter((x, i, a) => x.priceRub <= cap && a.findIndex((y) => y.itemId === x.itemId) === i)
      .slice(0, 5);
    if (!queue.length) {
      throw new BadRequestException("Narx o'zgardi. Qayta urinib ko'ring.");
    }

    // Eng arzonlarini navbat bilan sinaymiz — kimdir bizdan oldin olgan bo'lishi mumkin.
    let lastErr = '';
    for (const item of queue) {
      try {
        const p = await this.lzt.buy(item.itemId, item.priceRub);
        this.offers.delete(iso);
        return {
          // Xarid vaqti — shundan oldingi (sotuvchining eski) kodlari mijozga chiqmaydi.
          providerId: `${item.itemId}:${Math.floor(Date.now() / 1000)}`,
          // Raqam ajratilmasa ham xarid bo'lgan — kod item_id bo'yicha olinadi.
          phone: p.phone ?? `LZT #${item.itemId}`,
          costUsd: item.priceRub * this.rubToUsd,
          expiresAt: new Date(Date.now() + LztAdapter.WAIT_MS),
        };
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
        if (/balance|баланс|недостаточно|insufficient|not enough/i.test(lastErr)) {
          this.logger.error(`LZT balansi yetarli emas: ${lastErr}`);
          throw new BadRequestException("Raqam hozircha mavjud emas. Birozdan keyin urinib ko'ring.");
        }
        this.logger.warn(`LZT item ${item.itemId} olinmadi: ${lastErr}`);
      }
    }
    this.logger.error(`LZT ${iso}: hech bir e'lon olinmadi: ${lastErr}`);
    throw new BadRequestException("Raqam hozircha mavjud emas. Birozdan keyin urinib ko'ring.");
  }

  async check(providerId: string): Promise<CheckResult> {
    const hit = this.codeCache.get(providerId);
    if (hit && Date.now() - hit.at < LztAdapter.CODE_TTL) return hit.res;

    const [itemId, ts] = providerId.split(':');
    let res: CheckResult = { status: 'WAITING', code: null, text: null };
    try {
      const since = (Number(ts) || 0) - 60;
      const codes = await this.lzt.telegramLoginCodes(Number(itemId));
      // Sana bo'lsa — faqat xariddan keyingi kod (sotuvchining tekshiruv kodi emas).
      const c = codes.find((x) => !x.date || x.date >= since);
      if (c) res = { status: 'RECEIVED', code: c.code, text: c.text };
    } catch {
      // Kod hali yo'q yoki vaqtinchalik xato — kutishda davom etamiz.
    }
    this.codeCache.set(providerId, { at: Date.now(), res });
    return res;
  }

  async cancel(): Promise<void> {
    // LZT'da xaridni bekor qilib bo'lmaydi.
  }

  async finish(): Promise<void> {}

  async balanceUsd(): Promise<number> {
    return (await this.lzt.balanceRub()) * this.rubToUsd;
  }
}
