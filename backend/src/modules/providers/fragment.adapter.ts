import { Injectable } from '@nestjs/common';
import { ProviderKind } from '@prisma/client';
import {
  BuyInput,
  BuyResult,
  CheckResult,
  ProviderAdapter,
} from './provider.types';

/// Fragment — Telegram Stars / Premium manbasi.
/// SMS raqam oqimidan farq qiladi (username'ga sovg'a) — keyingi bosqichda to'liq ulanadi.
@Injectable()
export class FragmentAdapter implements ProviderAdapter {
  readonly kind = ProviderKind.FRAGMENT;

  isConfigured(): boolean {
    return false;
  }

  async getPriceUsd(_input: BuyInput): Promise<number | null> {
    return null;
  }

  async buy(_input: BuyInput): Promise<BuyResult> {
    throw new Error('Fragment (Stars/Premium) hali ulanmagan');
  }

  async check(_providerId: string): Promise<CheckResult> {
    return { status: 'ERROR', code: null, text: null };
  }

  async cancel(): Promise<void> {}
  async finish(): Promise<void> {}
  async balanceUsd(): Promise<number> {
    return 0;
  }
}
