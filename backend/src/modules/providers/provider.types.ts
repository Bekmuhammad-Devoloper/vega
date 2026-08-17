import { ProviderKind } from '@prisma/client';

/// Raqam sotib olish uchun kirish (DB Service/Country modellaridan olinadi).
export interface BuyInput {
  serviceSlug: string;
  serviceHeroCode?: string | null; // HeroSMS xizmat kodi (tg, wa...)
  countrySlug: string;
  countryIso2: string; // SPIDER kodi (UZ)
  countryHeroCode?: string | null; // HeroSMS davlat kodi (40)
}

export interface BuyResult {
  providerId: string; // provayder hash_code / activation id
  phone: string;
  costUsd: number;
  expiresAt: Date;
}

export type CheckStatus = 'WAITING' | 'RECEIVED' | 'CANCELLED' | 'ERROR';

export interface CheckResult {
  status: CheckStatus;
  code: string | null;
  text: string | null;
}

/// Har bir provayder shu interfeysга moslashadi — orders qatlami bittasini biladi.
export interface ProviderAdapter {
  readonly kind: ProviderKind;
  /** Kalit sozlanganmi (env). */
  isConfigured(): boolean;
  /** Jonli tannarx (ulgurji hisobi uchun) — USD. Topilmasa null. */
  getPriceUsd(input: BuyInput): Promise<number | null>;
  /** Raqam sotib olish. */
  buy(input: BuyInput): Promise<BuyResult>;
  /** SMS kodni tekshirish. */
  check(providerId: string): Promise<CheckResult>;
  /** Bekor qilish (kod kelmasa). */
  cancel(providerId: string): Promise<void>;
  /** Yakunlash (kod olindi). */
  finish(providerId: string): Promise<void>;
  /** Provayderdagi balans (USD) — superadmin monitoring. */
  balanceUsd(): Promise<number>;
}

export const PROVIDER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
