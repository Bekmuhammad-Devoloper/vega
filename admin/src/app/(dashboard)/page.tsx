'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, Phone, TrendingUp, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { KpiCard, MoneyValue } from '@/components/dashboard/kpi-card';
import { LiveActivity } from '@/components/dashboard/live-activity';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { NumberStatusBadge } from '@/components/number-status-badge';
import { apiListNumbers, apiNumbersStats, apiStatsOverview, apiWallet } from '@/lib/endpoints';
import { formatCount, formatDateTime, formatMoney } from '@/lib/format';
import type { AdminNumberOrder } from '@/lib/types';
import { useAuthStore } from '@/stores/auth-store';

// TEZLIK: grafik `recharts`ga tayanadi (~100kB). Uni statik import qilsak,
// do'kon egasi ko'radigan BIRINCHI sahifa shuncha ortiqcha JS yuklamaguncha
// ochilmasdi. Endi sahifa darhol chiziladi, grafik esa keyin keladi.
const TimeseriesChart = dynamic(
  () => import('@/components/dashboard/timeseries-chart').then((m) => m.TimeseriesChart),
  { ssr: false, loading: () => <Skeleton className="h-[280px] rounded-2xl" /> },
);

export default function DashboardPage() {
  const admin = useAuthStore((s) => s.admin);

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['stats', 'overview'],
    queryFn: apiStatsOverview,
  });
  const { data: numStats } = useQuery({ queryKey: ['numbers', 'stats'], queryFn: apiNumbersStats });
  const { data: wallet } = useQuery({ queryKey: ['wallet'], queryFn: apiWallet });
  const { data: recent } = useQuery({
    queryKey: ['numbers', { recent: true }],
    queryFn: () => apiListNumbers({ limit: 6 }),
  });

  const recentItems: AdminNumberOrder[] = Array.isArray(recent) ? recent : (recent?.items ?? []);
  const profit = numStats?.today?.profit ?? numStats?.profit;

  return (
    <div>
      <PageHeader title={`Salom, ${admin?.fullName ?? 'admin'}!`} description="Raqam sotuvi, foyda va hamyon holati" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loadingOverview || !overview ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[150px] rounded-2xl" />)
        ) : (
          <>
            <KpiCard
              title="Bugungi sotuvlar"
              value={formatCount(overview.today?.orders ?? 0)}
              icon={<Phone size={16} />}
              delta={overview.delta?.orders}
            />
            <KpiCard
              title="Bugungi tushum"
              value={<MoneyValue value={overview.today?.revenue ?? 0} />}
              icon={<DollarSign size={16} />}
              delta={overview.delta?.revenue}
            />
            <KpiCard
              title="Foyda"
              value={<MoneyValue value={profit ?? 0} />}
              icon={<TrendingUp size={16} />}
              hint={numStats?.today ? 'bugun' : 'jami'}
            />
            <KpiCard
              title="Hamyon balansi"
              value={<MoneyValue value={wallet?.balance ?? 0} />}
              icon={<Wallet size={16} />}
              hint="ulgurji"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <TimeseriesChart />
        </div>
        <LiveActivity />
      </div>

      <div className="mt-4">
        <Card>
          <CardHeader
            title="So'nggi buyurtmalar"
            action={
              <Link href="/orders" className="text-xs font-medium text-[var(--color-primary)]">
                Barchasi
              </Link>
            }
          />
          {recentItems.length > 0 ? (
            <ul className="divide-y divide-[var(--color-border)]">
              {recentItems.map((o) => (
                <li key={o.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate font-mono">{o.phone}</p>
                    <p className="text-xs text-[var(--color-text-muted)] truncate">
                      {o.service.emoji ? `${o.service.emoji} ` : ''}
                      {o.service.nameUz} · {o.country.nameUz}
                    </p>
                  </div>
                  <NumberStatusBadge status={o.status} />
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-[var(--color-primary)] whitespace-nowrap">{formatMoney(o.retailPrice)}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{formatDateTime(o.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Phone} title="Hozircha sotuv yo'q" hint="Birinchi raqam sotilgach, shu yerda ko'rinadi." />
          )}
        </Card>
      </div>
    </div>
  );
}
