import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

export type IstarWallet = 'TON' | 'USDT';
export type IstarStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface IstarRecipient {
  hash: string;
  name: string;
}

export interface IstarPackage {
  months: number;
  usd_value: number;
  ton_value: number;
}

/**
 * iStar (istar.fragmentapi.com) — Telegram Stars va Premium AVTO-yetkazish.
 * Fragment'ning rasmiy API'si yo'q, iStar uni o'rab beradi (+5% komissiya).
 *
 * Base:  https://v1.fragmentapi.com/api/v1/partner
 * Auth:  `API-Key: <kalit>` sarlavhasi (Bearer EMAS)
 * Limit: kalitiga sekundiga 1 so'rov -> quyida navbat bilan cheklanadi.
 *
 * Oqim: recipient/search (@username -> hash) -> POST /orders/... -> GET /orders/{id}
 *
 * DIQQAT: search javobi `recipient` maydonida hash qaytaradi, lekin buyurtma
 * uni `recipient_hash` nomi bilan kutadi. Faqat HAQIQIY foydalanuvchi
 * akkauntlari topiladi — kanal/bot uchun search xato beradi.
 */
@Injectable()
export class IstarProvider {
  private readonly logger = new Logger(IstarProvider.name);
  constructor(private readonly config: ConfigService) {}

  private get apiKey(): string {
    return (this.config.get<string>('ISTAR_API_KEY') ?? '').trim();
  }
  private get baseUrl(): string {
    return (
      this.config.get<string>('ISTAR_BASE_URL') ??
      'https://v1.fragmentapi.com/api/v1/partner'
    ).replace(/\/$/, '');
  }
  private get wallet(): IstarWallet {
    const w = (this.config.get<string>('ISTAR_WALLET') ?? 'TON').toUpperCase();
    return w === 'USDT' ? 'USDT' : 'TON';
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  // ── Sekundiga 1 so'rov limiti: so'rovlar ketma-ket, oraliq bilan ──
  private queue: Promise<unknown> = Promise.resolve();
  private lastCallAt = 0;
  private static readonly MIN_GAP_MS = 1100;

  private throttle<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const wait = IstarProvider.MIN_GAP_MS - (Date.now() - this.lastCallAt);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      try {
        return await fn();
      } finally {
        this.lastCallAt = Date.now();
      }
    });
    // Navbat xatodan to'xtab qolmasligi uchun zanjirni tozalaymiz.
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async call<T>(
    path: string,
    init?: { method?: 'GET' | 'POST'; body?: unknown; idempotent?: boolean },
  ): Promise<T> {
    return this.throttle(async () => {
      const headers: Record<string, string> = {
        'API-Key': this.apiKey,
        Accept: 'application/json',
      };
      if (init?.body) headers['Content-Type'] = 'application/json';
      // Buyurtma yaratishda takroriy yechilishning oldini oladi.
      if (init?.idempotent) headers['Idempotency-Key'] = randomUUID();

      const res = await fetch(`${this.baseUrl}${path}`, {
        method: init?.method ?? 'GET',
        headers,
        ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
      });
      const text = await res.text();
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`iStar ${path}: JSON emas (${res.status}) ${text.slice(0, 120)}`);
      }
      const err = (data as { error?: string })?.error;
      if (err || !res.ok) {
        throw new Error(`iStar ${path}: ${err ?? `HTTP ${res.status}`}`);
      }
      return data as T;
    });
  }

  /** Premium paket narxlari (3/6/12 oy). */
  packages(): Promise<IstarPackage[]> {
    return this.call<IstarPackage[]>('/premium/packages');
  }

  /** Hamyon balansi (sozlangan valyutada). */
  async balance(): Promise<{ balance: number; currency: string }> {
    return this.call(`/wallet/balance?wallet_type=${this.wallet}`);
  }

  /**
   * @username -> recipient hash. Topilmasa null (kanal/bot/mavjud emas).
   * Stars uchun quantity, Premium uchun months berilishi shart.
   */
  async findRecipient(
    kind: 'star' | 'premium',
    username: string,
    amount: number,
  ): Promise<IstarRecipient | null> {
    const u = encodeURIComponent(username.replace(/^@/, ''));
    const qs =
      kind === 'star' ? `quantity=${amount}` : `months=${amount}`;
    try {
      const r = await this.call<{
        success: boolean;
        recipient?: string;
        name?: string;
      }>(`/${kind}/recipient/search?username=${u}&${qs}`);
      if (!r.success || !r.recipient) return null;
      return { hash: r.recipient, name: r.name ?? username };
    } catch (e) {
      this.logger.warn(`recipient search @${username}: ${(e as Error).message}`);
      return null;
    }
  }

  /** Stars buyurtmasi (50 - 1 000 000). Buyurtma id qaytaradi. */
  async orderStars(
    username: string,
    recipientHash: string,
    quantity: number,
  ): Promise<string> {
    const r = await this.call<{ id?: string; order_id?: string }>(
      '/orders/star',
      {
        method: 'POST',
        idempotent: true,
        body: {
          username: username.replace(/^@/, ''),
          recipient_hash: recipientHash,
          quantity,
          wallet_type: this.wallet,
        },
      },
    );
    const id = r.id ?? r.order_id;
    if (!id) throw new Error('iStar: buyurtma id qaytmadi');
    return id;
  }

  /** Premium buyurtmasi (3/6/12 oy). Buyurtma id qaytaradi. */
  async orderPremium(
    username: string,
    recipientHash: string,
    months: number,
  ): Promise<string> {
    const r = await this.call<{ id?: string; order_id?: string }>(
      '/orders/premium',
      {
        method: 'POST',
        idempotent: true,
        body: {
          username: username.replace(/^@/, ''),
          recipient_hash: recipientHash,
          months,
          wallet_type: this.wallet,
        },
      },
    );
    const id = r.id ?? r.order_id;
    if (!id) throw new Error('iStar: buyurtma id qaytmadi');
    return id;
  }

  /** Buyurtma holati. */
  async orderStatus(orderId: string): Promise<IstarStatus> {
    const r = await this.call<{ status?: string }>(
      `/orders/${encodeURIComponent(orderId)}`,
    );
    const s = (r.status ?? '').toLowerCase();
    if (s === 'completed' || s === 'failed' || s === 'processing') return s;
    return 'pending';
  }
}
