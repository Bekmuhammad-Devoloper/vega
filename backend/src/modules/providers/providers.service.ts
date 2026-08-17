import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProviderKind } from '@prisma/client';
import {
  BuyInput,
  BuyResult,
  CheckResult,
  ProviderAdapter,
} from './provider.types';
import { SpiderAdapter } from './spider.adapter';
import { HeroSmsAdapter } from './herosms.adapter';
import { FragmentAdapter } from './fragment.adapter';
import { MockAdapter } from './mock.adapter';

/// Barcha provayderlarni birlashtiruvchi router.
/// NumberOrder.provider (ProviderKind) bo'yicha to'g'ri adapterga yo'naltiradi —
/// providerId'da prefiks-hack kerak emas, DB provayderni biladi.
@Injectable()
export class ProvidersService {
  private readonly map: Map<ProviderKind, ProviderAdapter>;

  constructor(
    private readonly spider: SpiderAdapter,
    hero: HeroSmsAdapter,
    fragment: FragmentAdapter,
    mock: MockAdapter,
    private readonly config: ConfigService,
  ) {
    this.map = new Map<ProviderKind, ProviderAdapter>([
      [ProviderKind.SPIDER, this.spider],
      [ProviderKind.HEROSMS, hero],
      [ProviderKind.FRAGMENT, fragment],
      [ProviderKind.MOCK, mock],
    ]);
  }

  /** SPIDER (Telegram) qo'llaydigan davlat ISO2 to'plami. */
  spiderSupportedIso2(): Promise<Set<string>> {
    return this.spider.supportedIso2();
  }

  adapter(kind: ProviderKind): ProviderAdapter {
    const a = this.map.get(kind);
    if (!a) throw new Error("Noma'lum provayder: " + kind);
    return a;
  }

  /**
   * Xizmatga mos, sozlangan provayderni tanlash.
   * Real provayder (masalan SPIDER=Telegram) sozlanmagan bo'lsa — MOCK (soxta
   * raqam) BERILMAYDI, aniq xato tashlanadi. Shunda mijoz soxta raqamga
   * to'lamaydi. MOCK faqat dev rejimda (ALLOW_MOCK_PROVIDER=true) ishlaydi.
   */
  resolveFor(kind: ProviderKind): ProviderAdapter {
    const a = this.adapter(kind);
    if (a.isConfigured()) return a;
    if (this.config.get('ALLOW_MOCK_PROVIDER') === 'true') {
      return this.adapter(ProviderKind.MOCK);
    }
    throw new BadRequestException(
      "Bu yo'nalish uchun provayder hozircha ulanmagan. Birozdan keyin urinib ko'ring.",
    );
  }

  /** Jonli tannarx (USD) — ulgurji hisobi uchun. Topilmasa null. */
  getPriceUsd(kind: ProviderKind, input: BuyInput): Promise<number | null> {
    return this.adapter(kind).getPriceUsd(input);
  }
  buy(kind: ProviderKind, input: BuyInput): Promise<BuyResult> {
    return this.resolveFor(kind).buy(input);
  }
  check(kind: ProviderKind, providerId: string): Promise<CheckResult> {
    return this.adapter(kind).check(providerId);
  }
  cancel(kind: ProviderKind, providerId: string): Promise<void> {
    return this.adapter(kind).cancel(providerId);
  }
  finish(kind: ProviderKind, providerId: string): Promise<void> {
    return this.adapter(kind).finish(providerId);
  }
  balanceUsd(kind: ProviderKind): Promise<number> {
    return this.adapter(kind).balanceUsd();
  }
  isConfigured(kind: ProviderKind): boolean {
    return this.adapter(kind).isConfigured();
  }
}
