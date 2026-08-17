import type { TariffPlan, TenantStatus } from './types';

export const TARIFF_META: Record<TariffPlan, { label: string; color: string; icon: string }> = {
  FREE: { label: 'Free', color: 'text-[var(--color-tier-free)]', icon: '🆓' },
  STANDARD: { label: 'Standard', color: 'text-[var(--color-tier-standard)]', icon: '⭐' },
  PRO: { label: 'Pro', color: 'text-[var(--color-tier-pro)]', icon: '🚀' },
  PREMIUM: { label: 'Premium', color: 'text-[var(--color-tier-premium)]', icon: '💎' },
};

export const TARIFF_PRICE: Record<TariffPlan, number> = {
  FREE: 0,
  STANDARD: 119_000,
  PRO: 990_000,
  PREMIUM: 219_000,
};

export const STATUS_META: Record<TenantStatus, { label: string; bg: string; text: string }> = {
  ACTIVE: { label: 'Faol', bg: 'bg-[var(--color-success)]/15', text: 'text-[var(--color-success)]' },
  SUSPENDED: { label: 'To\'xtatilgan', bg: 'bg-[var(--color-danger)]/15', text: 'text-[var(--color-danger)]' },
  CANCELLED: { label: 'Bekor', bg: 'bg-[var(--color-text-subtle)]/15', text: 'text-[var(--color-text-subtle)]' },
  PENDING_PAYMENT: { label: 'To\'lov kutilmoqda', bg: 'bg-[var(--color-warning)]/15', text: 'text-[var(--color-warning)]' },
};
