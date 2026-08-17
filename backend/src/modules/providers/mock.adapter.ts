import { Injectable } from '@nestjs/common';
import { ProviderKind } from '@prisma/client';
import {
  BuyInput,
  BuyResult,
  CheckResult,
  ProviderAdapter,
} from './provider.types';

/// Demo/test provayder — kalit sozlanmaganda ishlatiladi (real xarid yo'q).
@Injectable()
export class MockAdapter implements ProviderAdapter {
  readonly kind = ProviderKind.MOCK;

  isConfigured(): boolean {
    return true;
  }

  async getPriceUsd(_input: BuyInput): Promise<number | null> {
    return 0.1;
  }

  async buy(_input: BuyInput): Promise<BuyResult> {
    const rnd = Math.floor(1000000 + Math.random() * 8999999);
    return {
      providerId: 'mock_' + Date.now(),
      phone: '+99890' + rnd,
      costUsd: 0.1,
      expiresAt: new Date(Date.now() + 20 * 60 * 1000),
    };
  }

  async check(_providerId: string): Promise<CheckResult> {
    const code = String(Math.floor(10000 + Math.random() * 89999));
    return { status: 'RECEIVED', code, text: 'Vega demo kod: ' + code };
  }

  async cancel(): Promise<void> {}
  async finish(): Promise<void> {}
  async balanceUsd(): Promise<number> {
    return 999;
  }
}
