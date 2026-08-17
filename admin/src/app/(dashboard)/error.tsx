'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

/**
 * Admin dashboard xato chegarasi — biror sahifa crash bersa, do'stona xabar +
 * qayta urinish (butun ilova "Application error" bo'lib qolmasin).
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="grid place-items-center py-24 text-center">
      <span className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-[var(--color-danger)]/10 text-[var(--color-danger)]">
        <AlertTriangle size={30} />
      </span>
      <h2 className="text-lg font-bold text-[var(--color-text)]">Sahifada xatolik yuz berdi</h2>
      <p className="mt-1 max-w-sm text-sm text-[var(--color-text-muted)]">
        Bu bo&apos;limni yuklashda muammo chiqdi. Qayta urinib ko&apos;ring.
      </p>
      <button
        onClick={reset}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white transition-opacity active:opacity-90"
      >
        <RotateCw size={15} /> Qayta urinish
      </button>
    </div>
  );
}
