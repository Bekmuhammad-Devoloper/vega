'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  CircleDollarSign,
  TrendingUp,
  AlertTriangle,
  Hourglass,
  Wallet,
  ShoppingBag,
  Users as UsersIcon,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { RevenueChart } from '@/components/dashboard/revenue-chart';
import { TariffDonut } from '@/components/dashboard/tariff-donut';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  apiFetchActivity,
  apiFetchBalances,
  apiFetchKpi,
  apiFetchRevenueChart,
  apiFetchTariffDistribution,
} from '@/lib/endpoints';
import { formatNumber, formatPct, formatUzs } from '@/lib/format';

export default function DashboardPage() {
  const kpiQuery = useQuery({ queryKey: ['kpi'], queryFn: apiFetchKpi });
  const revenueQuery = useQuery({
    queryKey: ['revenue', 30],
    queryFn: () => apiFetchRevenueChart(30),
  });
  const tariffQuery = useQuery({
    queryKey: ['tariff-distribution'],
    queryFn: apiFetchTariffDistribution,
  });
  const activityQuery = useQuery({
    queryKey: ['activity', 20],
    queryFn: () => apiFetchActivity(20),
    refetchInterval: 30_000,
  });
  const balancesQuery = useQuery({
    queryKey: ['balances'],
    queryFn: apiFetchBalances,
    refetchInterval: 60_000,
  });

  const kpi = kpiQuery.data;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Platforma bo'yicha real-vaqt holatlar"
      />

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        {kpiQuery.isLoading || !kpi ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))
        ) : (
          <>
            <KpiCard
              label="Jami reseller"
              value={formatNumber(kpi.totalTenants)}
              icon={Building2}
              tone="primary"
              hint={`${formatNumber(kpi.activeTenants)} faol · ${formatNumber(kpi.suspendedTenants)} to'xtatilgan`}
              index={0}
            />
            <KpiCard
              label="Faollashtirish daromadi (MRR)"
              value={formatUzs(kpi.mrr)}
              icon={CircleDollarSign}
              tone="success"
              hint={`ARR: ${formatUzs(kpi.arr)}`}
              index={1}
            />
            <KpiCard
              label="Yangi reseller (oy)"
              value={formatNumber(kpi.newThisMonth)}
              icon={TrendingUp}
              tone="default"
              hint="Shu oyda ro'yxatdan o'tgan"
              index={2}
            />
            <KpiCard
              label="Churn rate"
              value={formatPct(kpi.churnRate)}
              icon={AlertTriangle}
              tone={kpi.churnRate > 5 ? 'danger' : 'warning'}
              hint="Oxirgi 30 kun"
              index={3}
            />
            <KpiCard
              label="Faol reseller"
              value={formatNumber(kpi.activeTenants)}
              icon={UsersIcon}
              tone="success"
              hint="Hozir faol do'konlar"
              index={4}
            />
            <KpiCard
              label="Faollashtirilmagan"
              value={formatNumber(kpi.pendingTenants)}
              icon={Hourglass}
              tone="warning"
              hint="Bir martalik to'lov kutilmoqda"
              index={5}
            />
            <KpiCard
              label="Bugungi buyurtmalar"
              value={formatNumber(kpi.todayOrders)}
              icon={ShoppingBag}
              tone="default"
              hint="Raqam-buyurtmalar (bugun)"
              index={6}
            />
            <KpiCard
              label="Bugungi foyda"
              value={formatUzs(kpi.todayRevenue)}
              icon={Wallet}
              tone="primary"
              hint="Reseller foydasi (bugun)"
              index={7}
            />
          </>
        )}
      </div>

      {/* Balanslar — tasdiqlash uchun + provayder hisoblari */}
      <Card className="mb-6">
        <CardHeader
          title="Balanslar"
          subtitle="Tasdiqlash uchun mavjud + provayder hisoblari"
        />
        <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {balancesQuery.isLoading || !balancesQuery.data ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))
          ) : (
            <>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                  <Wallet size={14} /> Platforma balansi
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--color-text)]">
                  {formatUzs(balancesQuery.data.platform)}
                </p>
                <p className="text-[11px] text-[var(--color-text-subtle)] mt-1">
                  Reseller to&apos;ldirishlarni tasdiqlash uchun
                </p>
              </div>
              {balancesQuery.data.providers.map((p) => {
                const low = p.balanceUsd != null && p.balanceUsd < 1;
                return (
                  <div
                    key={p.kind}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4"
                  >
                    <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                      <CircleDollarSign size={14} /> {p.label}
                    </div>
                    <p
                      className={`mt-2 text-2xl font-bold tabular-nums ${
                        low ? 'text-rose-400' : 'text-[var(--color-text)]'
                      }`}
                    >
                      {!p.configured
                        ? '—'
                        : p.balanceUsd == null
                          ? '?'
                          : `$${p.balanceUsd.toFixed(2)}`}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-subtle)] mt-1">
                      {!p.configured
                        ? 'Ulanmagan'
                        : low
                          ? "⚠️ Kam — to'ldiring"
                          : 'Raqam sotib olish uchun'}
                    </p>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </Card>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Foyda o'sishi"
            subtitle="Reseller foydasi · oxirgi 30 kun"
            action={
              <div className="text-xs text-[var(--color-text-muted)]">
                {revenueQuery.data && (
                  <>
                    Jami:{' '}
                    <span className="text-[var(--color-text)] font-semibold tabular-nums">
                      {formatUzs(revenueQuery.data.reduce((s, p) => s + p.revenue, 0))}
                    </span>
                  </>
                )}
              </div>
            }
          />
          <div className="p-5">
            {revenueQuery.isLoading || !revenueQuery.data ? (
              <Skeleton className="h-72 w-full" />
            ) : (
              <RevenueChart data={revenueQuery.data} />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Tarif taqsimoti" subtitle="Faol obunalar" />
          <div className="p-5">
            {tariffQuery.isLoading || !tariffQuery.data ? (
              <Skeleton className="h-72 w-full" />
            ) : (
              <TariffDonut data={tariffQuery.data} />
            )}
          </div>
        </Card>
      </div>

      {/* Activity */}
      <Card>
        <CardHeader
          title="Faollik feed"
          subtitle="Real-vaqt platforma harakatlari"
          action={
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
              Jonli
            </div>
          }
        />
        {activityQuery.isLoading || !activityQuery.data ? (
          <div className="p-5 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : (
          <ActivityFeed events={activityQuery.data} />
        )}
      </Card>
    </>
  );
}
