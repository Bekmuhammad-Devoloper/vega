import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Premium oylari -> Bot API MAJBURIY qilgan Stars narxi. Boshqa qiymat xato beradi. */
export const PREMIUM_STAR_COST: Readonly<Record<number, number>> = {
  3: 1000,
  6: 1500,
  12: 2500,
};

export type GiftResult = { ok: true } | { ok: false; error: string };

/**
 * RASMIY Telegram Bot API orqali Premium sovg'a qilish — Fragment SHART EMAS.
 *   POST https://api.telegram.org/bot<TOKEN>/giftPremiumSubscription
 *        { user_id, month_count: 3|6|12, star_count: 1000|1500|2500, text? }
 *
 * Bot O'Z Stars balansidan to'laydi, shuning uchun balans oldindan
 * to'ldirilgan bo'lishi kerak (getMyStarBalance bilan tekshiriladi).
 *
 * DIQQAT — ikkita cheklov:
 *  1) `user_id` RAQAM bo'lishi shart. Bot API'da @username -> id yechish
 *     metodi YO'Q, shuning uchun oluvchi bizning bazamizda bo'lishi kerak.
 *  2) Quruq Stars o'tkazish metodi YO'Q — faqat Premium va sovg'alar.
 *     Stars mahsuloti SMM panel yoki qo'lda yetkazishda qoladi.
 */
@Injectable()
export class TelegramGiftProvider {
  private readonly logger = new Logger(TelegramGiftProvider.name);
  constructor(private readonly config: ConfigService) {}

  private get token(): string {
    return (this.config.get<string>('TELEGRAM_BOT_TOKEN') ?? '').trim();
  }

  /** Placeholder token bilan urinib 401 olmaslik uchun format ham tekshiriladi. */
  isConfigured(): boolean {
    return /^\d{5,}:[A-Za-z0-9_-]{30,}$/.test(this.token);
  }

  starCostFor(months: number): number | null {
    return PREMIUM_STAR_COST[months] ?? null;
  }

  private async call<T>(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<T> {
    const res = await fetch(
      `https://api.telegram.org/bot${this.token}/${method}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      },
    );
    const data = (await res.json()) as {
      ok: boolean;
      result?: T;
      description?: string;
    };
    if (!data.ok) throw new Error(data.description ?? `${method}: noma'lum xato`);
    return data.result as T;
  }

  /** Botning joriy Stars balansi. Sozlanmagan/xato bo'lsa null. */
  async starBalance(): Promise<number | null> {
    if (!this.isConfigured()) return null;
    try {
      const r = await this.call<{ amount: number }>('getMyStarBalance');
      return r.amount;
    } catch (e) {
      this.logger.warn(`getMyStarBalance: ${(e as Error).message}`);
      return null;
    }
  }

  /** Premium sovg'a qiladi. userId — Telegram RAQAM id (username emas!). */
  async giftPremium(
    userId: bigint,
    months: number,
    text?: string,
  ): Promise<GiftResult> {
    const starCount = this.starCostFor(months);
    if (!starCount) {
      return {
        ok: false,
        error: `Premium ${months} oy qo'llab-quvvatlanmaydi (faqat 3/6/12)`,
      };
    }
    try {
      await this.call<boolean>('giftPremiumSubscription', {
        user_id: Number(userId),
        month_count: months,
        star_count: starCount,
        ...(text ? { text: text.slice(0, 128) } : {}),
      });
      this.logger.log(`Premium ${months} oy -> tg:${userId} (${starCount} Stars)`);
      return { ok: true };
    } catch (e) {
      const error = (e as Error).message;
      this.logger.warn(`giftPremiumSubscription tg:${userId}: ${error}`);
      return { ok: false, error };
    }
  }
}
