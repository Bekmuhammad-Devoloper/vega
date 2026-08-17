'use client';

import Link from 'next/link';
import { Store, CreditCard, Crown, LifeBuoy, Megaphone, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useStore, TARIFF_LABELS } from './_shared';

export default function SettingsPage() {
  const { data, isLoading } = useStore();
  const t = data?.tenant ?? null;

  const paymentsSummary = (() => {
    if (!t) return 'Sozlanmagan';
    const on: string[] = [];
    if (t.payme?.merchantId || t.payme?.hasKey) on.push('Payme');
    if (t.click?.serviceId) on.push('Click');
    if (t.cardPayment?.cardNumber) on.push('Karta/chek');
    return on.length ? on.join(' · ') : 'Sozlanmagan';
  })();

  const rows = [
    {
      href: '/settings/store',
      icon: Store,
      title: "Do'kon ma'lumotlari",
      desc: t?.shopName ?? 'Nomi, manzil, bot, brending',
    },
    { href: '/settings/payments', icon: CreditCard, title: "To'lov usullari", desc: paymentsSummary },
    {
      href: '/settings/reviews',
      icon: Megaphone,
      title: 'Otziv kanali',
      desc: t?.reviews?.enabled ? 'Yoqilgan' : "O'chirilgan",
    },
    {
      href: '/settings/tariff',
      icon: Crown,
      title: 'Tarif',
      desc: t ? (TARIFF_LABELS[t.tariffPlan] ?? t.tariffPlan) : '—',
    },
    { href: '/settings/support', icon: LifeBuoy, title: "Qo'llab-quvvatlash", desc: 'Bizga yozing' },
  ];

  return (
    <div>
      <PageHeader title="Sozlamalar" description="Do'koningizni shu yerdan boshqaring" />

      <div className="max-w-2xl">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : (
          <Card className="divide-y divide-[var(--color-border)] overflow-hidden">
            {rows.map((r) => (
              <Link
                key={r.href}
                href={r.href}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--color-bg)] transition-colors"
              >
                <span className="inline-flex h-10 w-10 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] items-center justify-center shrink-0">
                  <r.icon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-tight">{r.title}</span>
                  <span className="block text-xs text-[var(--color-text-muted)] truncate mt-0.5">{r.desc}</span>
                </span>
                <ChevronRight size={18} className="text-[var(--color-text-muted)] shrink-0" />
              </Link>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
