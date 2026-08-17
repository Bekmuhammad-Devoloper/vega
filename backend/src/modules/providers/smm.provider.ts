import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PROVIDER_UA } from './provider.types';

export type SmmStatus =
  | 'completed'
  | 'processing'
  | 'pending'
  | 'canceled'
  | 'error';

/**
 * Standart SMM-panel API (Perfect Panel formati) — Stars/Premium AVTO-yetkazish.
 * `POST {url}` form-urlencoded: { key, action, ... }. Ko'pchilik panellar shu formatда.
 *   add:     { key, action:add, service, link, quantity } -> { order }
 *   status:  { key, action:status, order } -> { status: 'Completed'|... }
 *   balance: { key, action:balance } -> { balance, currency }
 * Sozlanmagan bo'lsa (URL/kalit yo'q) — qo'lда yetkazishga fallback.
 */
@Injectable()
export class SmmProvider {
  private readonly logger = new Logger(SmmProvider.name);
  constructor(private readonly config: ConfigService) {}

  private get apiUrl(): string {
    return (this.config.get<string>('SMM_API_URL') ?? '').trim();
  }
  private get apiKey(): string {
    return (this.config.get<string>('SMM_API_KEY') ?? '').trim();
  }
  isConfigured(): boolean {
    return this.apiUrl.length > 0 && this.apiKey.length > 0;
  }

  /** @username'ni panel talab qilgan formatga aylantiradi (SMM_LINK_FORMAT). */
  linkFor(username: string): string {
    const u = username.replace(/^@/, '');
    const fmt = (this.config.get<string>('SMM_LINK_FORMAT') ?? 'at').toLowerCase();
    if (fmt === 'plain') return u;
    if (fmt === 'tme') return `https://t.me/${u}`;
    return `@${u}`; // default
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async call(params: Record<string, string | number>): Promise<any> {
    const body = new URLSearchParams();
    body.set('key', this.apiKey);
    for (const [k, v] of Object.entries(params)) body.set(k, String(v));
    const res = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': PROVIDER_UA,
        Accept: 'application/json',
      },
      body,
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`SMM ${params.action}: ${text.slice(0, 150)}`);
    }
  }

  /** Buyurtma joylaydi -> provayder order id. */
  async placeOrder(
    serviceId: string,
    link: string,
    quantity: number,
  ): Promise<string> {
    const d = await this.call({
      action: 'add',
      service: serviceId,
      link,
      quantity,
    });
    if (d?.order) return String(d.order);
    throw new Error(
      `SMM add xato: ${d?.error ?? JSON.stringify(d).slice(0, 150)}`,
    );
  }

  /** Buyurtma holati (normalizatsiya qilingan). */
  async orderStatus(orderId: string): Promise<SmmStatus> {
    const d = await this.call({ action: 'status', order: orderId });
    const s = String(d?.status ?? '').toLowerCase();
    if (s.includes('complet') || s.includes('partial')) return 'completed';
    if (s.includes('cancel') || s.includes('refund') || s.includes('fail')) {
      return 'canceled';
    }
    if (s.includes('error')) return 'error';
    if (s.includes('progress') || s.includes('process')) return 'processing';
    return 'pending';
  }

  /** Panel balansi (owner tekshirishi uchun). */
  async balance(): Promise<{ balance: number; currency: string }> {
    const d = await this.call({ action: 'balance' });
    return {
      balance: Number(d?.balance ?? 0),
      currency: String(d?.currency ?? 'USD'),
    };
  }
}
