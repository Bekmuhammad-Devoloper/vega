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
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': PROVIDER_UA, Accept: '*/*' },
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `HeroSMS ${action} -> ${res.status}: ${text.slice(0, 150)}`,
      );
    }
    return text.trim();
  }

  async getPriceUsd(input: BuyInput): Promise<number | null> {
    const c = input.countryHeroCode;
    const s = input.serviceHeroCode;
    if (!c || !s) return null;
    try {
      const text = await this.api('getPrices', { country: c, service: s });
      let data: Record<
        string,
        Record<string, { cost?: number; count?: number }>
      >;
      try {
        data = JSON.parse(text);
      } catch {
        return null;
      }
      const info = data?.[c]?.[s];
      if (!info || (info.count ?? 0) <= 0) return null;
      const n = Number(info.cost);
      return Number.isFinite(n) ? n : null;
    } catch (e) {
      this.logger.warn(`getPriceUsd(${c}/${s}): ${String(e)}`);
      return null;
    }
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

    let data: {
      activationId?: number | string;
      phoneNumber?: string;
      activationCost?: string | number;
    };
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Xatolik: ${text}`);
    }
    if (!data.activationId || !data.phoneNumber) {
      throw new Error(`Xatolik: ${text}`);
    }
    return {
      providerId: String(data.activationId),
      phone: data.phoneNumber.startsWith('+')
        ? data.phoneNumber
        : '+' + data.phoneNumber,
      costUsd: Number(data.activationCost) || 0,
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
