'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Sparkles, Lock, Clock, ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiMyStore } from '@/lib/endpoints';

/**
 * Stars / Premium sotish — PULLIK funksiya.
 *  • Free tarif  → yoqib bo'lmaydi, tariflar sahifasiga yo'naltiriladi.
 *  • Pullik tarif → hozircha "tez kunda" (SMM avto-yetkazish tayyor bo'lgach yoqiladi).
 */
export default function StarsPremiumPage() {
  const { data: store } = useQuery({ queryKey: ['my-store'], queryFn: apiMyStore });
  const loaded = store !== undefined;
  const isPaid = store?.tenant?.trial?.state === 'PAID';

  return (
    <div>
      <PageHeader
        title="Stars / Premium"
        description="Telegram Stars va Premium sotish"
      />

      {!loaded ? (
        <Skeleton className="h-56 rounded-2xl" />
      ) : !isPaid ? (
        <Card>
          <div className="mx-auto max-w-md p-8 text-center">
            <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
              <Lock size={30} />
            </span>
            <h2 className="text-lg font-bold">Stars / Premium — pullik funksiya</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
              Telegram Stars va Premium sotishni yoqish uchun <b>STANDARD</b> yoki{' '}
              <b>PREMIUM</b> tarif kerak. Free tarifda bu funksiya mavjud emas.
            </p>
            <Link
              href="/settings/tariff"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white transition-opacity active:opacity-90"
            >
              Tariflarni ko&apos;rish <ArrowRight size={16} />
            </Link>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="mx-auto max-w-md p-8 text-center">
            <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-amber-100 text-amber-600">
              <Clock size={30} />
            </span>
            <h2 className="text-lg font-bold">Tez kunda ishga tushadi</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
              Telegram Stars va Premium sotish <b>tez orada</b> to&apos;liq ishga tushadi.
              Tarifingiz faol — tayyor bo&apos;lishi bilan shu yerda yoqasiz.
            </p>
            <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--color-bg)] px-4 py-2 text-xs font-medium text-[var(--color-text-muted)]">
              <Sparkles size={14} /> Ishlab chiqilmoqda
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}
