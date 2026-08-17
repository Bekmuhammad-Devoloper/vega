import { TariffPlan, TenantStatus } from '@prisma/client';

/** -1 = cheksiz */
export interface TariffLimits {
  maxServices: number; // reseller nechta xizmat taklif eta oladi
  maxCountries: number;
  maxAdmins: number;
  customBot: boolean; // o'z botini ulash
  customDomain: boolean;
  whiteLabel: boolean;
  analytics: boolean;
  onlinePayment: boolean;
  branding: boolean;
  prioritySupport: boolean;
  maxBanners: number;
  maxStores: number;
  maxModerators: number;
  maxCreators: number;
}

export type TariffFeature =
  | 'analytics'
  | 'onlinePayment'
  | 'branding'
  | 'prioritySupport'
  | 'customBot'
  | 'customDomain'
  | 'whiteLabel';

export const TARIFF_LIMITS: Record<TariffPlan, TariffLimits> = {
  FREE: {
    maxServices: 3,
    maxCountries: 5,
    maxAdmins: 1,
    customBot: false,
    customDomain: false,
    whiteLabel: false,
    analytics: false,
    onlinePayment: false,
    branding: false,
    prioritySupport: false,
    maxBanners: 1,
    maxStores: 1,
    maxModerators: 0,
    maxCreators: 0,
  },
  STANDARD: {
    maxServices: 20,
    maxCountries: 20,
    maxAdmins: 2,
    customBot: true,
    customDomain: false,
    whiteLabel: false,
    analytics: true,
    onlinePayment: true,
    branding: true,
    prioritySupport: true,
    maxBanners: 5,
    maxStores: 1,
    maxModerators: 1,
    maxCreators: 1,
  },
  PRO: {
    maxServices: -1,
    maxCountries: -1,
    maxAdmins: 5,
    customBot: true,
    customDomain: false,
    whiteLabel: false,
    analytics: true,
    onlinePayment: true,
    branding: true,
    prioritySupport: true,
    maxBanners: 10,
    maxStores: 1,
    maxModerators: 3,
    maxCreators: 3,
  },
  PREMIUM: {
    maxServices: -1,
    maxCountries: -1,
    maxAdmins: -1,
    customBot: true,
    customDomain: true,
    whiteLabel: true,
    analytics: true,
    onlinePayment: true,
    branding: true,
    prioritySupport: true,
    maxBanners: -1,
    maxStores: 2,
    maxModerators: -1,
    maxCreators: -1,
  },
};

export function limitsFor(plan: TariffPlan): TariffLimits {
  return TARIFF_LIMITS[plan] ?? TARIFF_LIMITS.FREE;
}

export function hasFeature(plan: TariffPlan, feature: TariffFeature): boolean {
  return limitsFor(plan)[feature] === true;
}

/** isTariffActive uchun kerakli do'kon maydonlari (bir martalik model). */
export interface TariffStatusFields {
  status: TenantStatus;
}

/**
 * Do'kon FAOL'mi. Bir martalik model: faollashtirish to'lovidan keyin
 * status = ACTIVE bo'ladi. SUSPENDED/CANCELLED/PENDING_PAYMENT — faol emas.
 * (Oylik muddat/trial tushunchasi yo'q — bir marta to'lanadi.)
 */
export function isTariffActive(t: TariffStatusFields): boolean {
  return t.status === TenantStatus.ACTIVE;
}
