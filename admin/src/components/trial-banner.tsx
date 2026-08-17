'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Gift, ArrowRight } from 'lucide-react';
import { apiMyStore } from '@/lib/endpoints';

/**
 * Free sinov (10 kun) banneri — barcha sahifalar tepasida.
 * TRIAL -> qolgan kunlar; EXPIRED -> "tarif oling" (qizil). PAID -> ko'rinmaydi.
 */
export function TrialBanner() {
  const { data } = useQuery({ queryKey: ['my-store'], queryFn: apiMyStore });
  const trial = data?.tenant?.trial;
  if (!trial || trial.state === 'PAID') return null;

  if (trial.state === 'EXPIRED') {
    return (
      <Link
        href="/settings/tariff"
        className="mb-4 flex items-center gap-3 rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-4 py-3"
      >
        <AlertTriangle size={20} className="text-[var(--color-danger)] shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--color-danger)]">Sinov muddati tugadi</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            Sotuvni davom ettirish uchun tarif sotib oling.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-danger)] px-3 py-1.5 text-xs font-semibold text-white shrink-0">
          Tarif olish <ArrowRight size={13} />
        </span>
      </Link>
    );
  }

  // 8–10 kun: har sotuvdan +1200 so'm ustama (amber ogohlantirish).
  if (trial.phase === 'SURCHARGE') {
    return (
      <Link
        href="/settings/tariff"
        className="mb-4 flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3"
      >
        <AlertTriangle size={20} className="text-amber-600 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-700">
            Sinovning oxiri — har sotuvdan +1 200 so&apos;m
          </p>
          <p className="text-xs text-amber-700/80">
            Yana {trial.trialDaysLeft} kun, so&apos;ng bloklanadi. Tarif oling.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shrink-0">
          Tarif olish <ArrowRight size={13} />
        </span>
      </Link>
    );
  }

  return (
    <Link
      href="/settings/tariff"
      className="mb-4 flex items-center gap-3 rounded-2xl border border-[var(--color-primary)]/25 bg-[var(--color-primary)]/[0.06] px-4 py-3"
    >
      <Gift size={20} className="text-[var(--color-primary)] shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Free sinov: {trial.trialDaysLeft} kun qoldi</p>
        <p className="text-xs text-[var(--color-text-muted)]">
          {trial.freeDaysLeft != null
            ? `Tan narxida yana ${trial.freeDaysLeft} kun · keyin +1 200 so'm/sotuv`
            : "Sinovdan keyin sotish uchun tarif kerak bo'ladi."}
        </p>
      </div>
      <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-primary)]/40 px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)] shrink-0">
        Tariflar <ArrowRight size={13} />
      </span>
    </Link>
  );
}
