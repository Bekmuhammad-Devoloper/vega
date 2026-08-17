'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Lock } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { apiMyStore, apiNumbersStats, apiStatsFunnel, apiStatsTimeseries } from '@/lib/endpoints';
import { formatCount, formatMoney } from '@/lib/format';

type Period = '7d' | '30d' | '90d';

function rangeFor(p: Period): { from: string; to: string } {
  const days = p === '7d' ? 7 : p === '30d' ? 30 : 90;
  const to = new Date().toISOString();
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  return { from, to };
}

type Metric = 'orders' | 'revenue';
const METRIC_COLOR: Record<Metric, string> = { orders: '#2F6BFF', revenue: '#16A34A' };
const METRIC_LABEL: Record<Metric, string> = { orders: 'Sotuvlar', revenue: 'Tushum' };

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('7d');
  const [metric, setMetric] = useState<Metric>('orders');
  const { from, to } = rangeFor(period);

  const { data: store, isError: storeError } = useQuery({ queryKey: ['my-store'], queryFn: apiMyStore });
  const analyticsAllowed = store ? (store.limits?.analytics ?? true) : storeError ? true : undefined;
  const enabled = analyticsAllowed === true;

  const { data: numStats } = useQuery({ queryKey: ['numbers', 'stats'], queryFn: apiNumbersStats, enabled });
  const { data: funnel, isLoading: funnelLoading } = useQuery({
    queryKey: ['stats', 'funnel', period],
    queryFn: () => apiStatsFunnel(from, to),
    enabled,
  });
  const { data: series } = useQuery({
    queryKey: ['stats', 'timeseries', period],
    queryFn: () => apiStatsTimeseries(from, to),
    enabled,
  });

  if (analyticsAllowed === false) {
    return (
      <div>
        <PageHeader title="Analytics" />
        <Card>
          <CardBody className="text-center py-10 space-y-3">
            <div className="inline-flex h-12 w-12 rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] items-center justify-center">
              <Lock size={22} />
            </div>
            <h2 className="text-lg font-bold">Statistika yopiq</h2>
            <p className="text-sm text-[var(--color-text-muted)] max-w-xs mx-auto">
              Do&apos;kon statistikasi <b>Standart</b> va undan yuqori tariflarda mavjud. Ochish uchun
              tarifingizni yangilang.
            </p>
            <Link href="/settings" className="inline-block">
              <Button>Tarifni yangilash</Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  const stat = numStats ?? {};

  return (
    <div>
      <PageHeader
        title="Analytics"
        rightSlot={
          <div className="flex gap-1">
            {(['7d', '30d', '90d'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'h-9 px-3 rounded-lg text-xs font-medium',
                  period === p
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-white text-[var(--color-text-muted)] border border-[var(--color-border)]',
                )}
              >
                {p === '7d' ? '7 kun' : p === '30d' ? '30 kun' : '90 kun'}
              </button>
            ))}
          </div>
        }
      />

      {/* Raqam statistikasi */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatTile label="Jami raqamlar" value={formatCount(stat.total ?? 0)} />
        <StatTile label="Kod olingan" value={formatCount(stat.received ?? 0)} tone="green" />
        <StatTile label="Bekor / muddati o'tgan" value={formatCount((stat.cancelled ?? 0))} tone="red" />
        <StatTile label="Jami foyda" value={formatMoney(stat.profit ?? 0)} tone="primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Konversiya voronkasi" />
          <CardBody>
            {funnelLoading || !funnel ? <Skeleton className="h-40" /> : <Funnel data={funnel} />}
          </CardBody>
        </Card>

        <Card>
          <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between gap-2">
            <h2 className="font-semibold text-sm">Dinamika</h2>
            <div className="flex gap-1">
              {(['orders', 'revenue'] as Metric[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMetric(m)}
                  className={cn(
                    'h-7 px-2.5 rounded-md text-xs font-medium',
                    metric === m
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'text-[var(--color-text-muted)] hover:bg-gray-50',
                  )}
                >
                  {METRIC_LABEL[m]}
                </button>
              ))}
            </div>
          </div>
          <div className="p-3 h-64">
            {!series ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id={`ag-${metric}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={METRIC_COLOR[metric]} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={METRIC_COLOR[metric]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tickFormatter={(d) => new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                    fontSize={11}
                    stroke="#94A3B8"
                  />
                  <YAxis fontSize={11} stroke="#94A3B8" />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB', fontSize: 12 }}
                    labelFormatter={(d) => new Date(d).toLocaleDateString('ru-RU')}
                  />
                  <Area
                    type="monotone"
                    dataKey={metric}
                    stroke={METRIC_COLOR[metric]}
                    fill={`url(#ag-${metric})`}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'green' | 'red' | 'primary';
}) {
  const color =
    tone === 'green'
      ? 'text-[var(--color-success)]'
      : tone === 'red'
        ? 'text-[var(--color-danger)]'
        : tone === 'primary'
          ? 'text-[var(--color-primary)]'
          : 'text-[var(--color-text)]';
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p className="text-xs text-[var(--color-text-muted)] line-clamp-2 min-h-[2.5em]">{label}</p>
      <p className={cn('mt-2 text-lg font-bold tabular-nums truncate', color)}>{value}</p>
    </div>
  );
}

function Funnel({
  data,
}: {
  data: { visits: number; productViews: number; cartAdds: number; checkouts: number; orders: number };
}) {
  const stages = [
    { label: 'Tashriflar', value: data.visits },
    { label: 'Katalog ko\'rdi', value: data.productViews },
    { label: 'Xizmat tanladi', value: data.cartAdds },
    { label: 'Xaridni boshladi', value: data.checkouts },
    { label: 'Sotib oldi', value: data.orders },
  ];
  const max = Math.max(...stages.map((s) => s.value), 1);
  return (
    <div className="space-y-2">
      {stages.map((s, i) => {
        const pct = (s.value / max) * 100;
        const prevValue = i > 0 ? stages[i - 1]!.value : 0;
        const conversionPct = i > 0 && prevValue > 0 ? Math.round((s.value / prevValue) * 100) : null;
        return (
          <div key={s.label}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium">{s.label}</span>
              <span className="text-[var(--color-text-muted)]">
                {s.value}
                {conversionPct !== null && <span className="ml-2 text-[var(--color-primary)]">{conversionPct}%</span>}
              </span>
            </div>
            <div className="h-7 bg-gray-100 rounded-md overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[var(--color-primary)] to-[#1E4FCC]"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
