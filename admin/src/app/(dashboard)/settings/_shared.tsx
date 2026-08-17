'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiMyStore } from '@/lib/endpoints';

// ───── Money input helpers (shared across settings sub-pages) ─────
export function formatMoneyInput(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '';
  return new Intl.NumberFormat('ru-RU').format(value).replace(/,/g, ' ');
}

export function parseMoneyInput(text: string): number {
  const digits = text.replace(/[^0-9]/g, '');
  return digits ? Number(digits) : 0;
}

export const TARIFF_LABELS: Record<string, string> = {
  FREE: 'Free',
  STANDARD: 'Standart',
  PRO: 'Pro',
  PREMIUM: 'Premium',
};

/** Joriy do'kon ma'lumotlari — barcha sozlama sahifalari shu keshdan o'qiydi. */
export function useStore() {
  return useQuery({ queryKey: ['my-store'], queryFn: apiMyStore });
}

/** Sozlama sub-sahifasi sarlavhasi — "Sozlamalar"ga qaytish havolasi bilan. */
export function SettingsHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-5">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-2"
      >
        <ChevronLeft size={16} /> Sozlamalar
      </Link>
      <h1 className="text-xl font-bold leading-tight">{title}</h1>
      {description && <p className="text-sm text-[var(--color-text-muted)] mt-1">{description}</p>}
    </div>
  );
}
