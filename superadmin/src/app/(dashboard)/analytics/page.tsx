'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import dayjs from 'dayjs';
import { Users, MapPin, TrendingUp, Activity } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  apiFetchCohort,
  apiFetchFunnel,
  apiFetchGeo,
  apiFetchStatusDistribution,
} from '@/lib/endpoints';
import { formatNumber, formatPct, formatUzs } from '@/lib/format';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#10B981',
  SUSPENDED: '#EF4444',
  PENDING_PAYMENT: '#F59E0B',
  CANCELLED: '#64748B',
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Faol',
  SUSPENDED: "To'xtatilgan",
  PENDING_PAYMENT: "To'lov kutilmoqda",
  CANCELLED: 'Bekor',
};

export default function AnalyticsPage() {
  const funnel = useQuery({ queryKey: ['funnel'], queryFn: apiFetchFunnel });
  const cohort = useQuery({ queryKey: ['cohort'], queryFn: () => apiFetchCohort(6) });
  const geo = useQuery({ queryKey: ['geo'], queryFn: apiFetchGeo });
  const status = useQuery({
    queryKey: ['status-distribution'],
    queryFn: apiFetchStatusDistribution,
  });

  return (
    <>
      <PageHeader
        title="Platforma analitika"
        subtitle="Funnel, cohort, geografik tahlil va status taqsimoti"
      />

      {/* Funnel */}
      <Card className="mb-5">
        <CardHeader
          title="Konversiya voronkasi"
          subtitle="Ro'yxatdan o'tishdan pulli tarifgacha"
        />
        <CardBody>
          {funnel.isLoading || !funnel.data ? (
            <Skeleton className="h-40" />
          ) : (
            <div className="space-y-3">
              {funnel.data.map((step, i) => {
                const first = funnel.data![0].count || 1;
                const pct = (step.count / first) * 100;
                const prevPct =
                  i > 0
                    ? (step.count / (funnel.data![i - 1].count || 1)) * 100
                    : 100;
                return (
                  <div key={step.step}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="h-6 w-6 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary)] grid place-items-center text-[10px] font-bold">
                          {i + 1}
                        </span>
                        <span className="text-sm font-medium text-[var(--color-text)]">
                          {step.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 tabular-nums">
                        <span className="text-sm font-semibold text-[var(--color-text)]">
                          {formatNumber(step.count)}
                        </span>
                        {i > 0 && (
                          <span
                            className={`text-xs ${
                              prevPct >= 50
                                ? 'text-[var(--color-success)]'
                                : 'text-[var(--color-warning)]'
                            }`}
                          >
                            {formatPct(prevPct, 0)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="h-3 bg-[var(--color-bg)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] transition-all duration-700"
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {/* Cohort */}
        <Card>
          <CardHeader
            title="Cohort tahlil"
            subtitle="Oyma-oy ro'yxatdan o'tganlar"
          />
          <CardBody>
            {cohort.isLoading || !cohort.data ? (
              <Skeleton className="h-56" />
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={cohort.data.map((c) => ({
                      ...c,
                      label: dayjs(c.month + '-01').format('MMM YY'),
                    }))}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid stroke="#232838" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="label"
                      stroke="#64748B"
                      fontSize={11}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#64748B"
                      fontSize={11}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#141622',
                        border: '1px solid #232838',
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: '#94A3B8' }}
                    />
                    <Bar dataKey="total" fill="#6366F1" radius={[4, 4, 0, 0]} name="Jami" />
                    <Bar
                      dataKey="paying"
                      fill="#10B981"
                      radius={[4, 4, 0, 0]}
                      name="Pulli tarif"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="flex items-center gap-4 mt-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-[var(--color-primary)]" />
                <span className="text-[var(--color-text-muted)]">Jami</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-[var(--color-accent)]" />
                <span className="text-[var(--color-text-muted)]">Pulli tarif</span>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Status distribution */}
        <Card>
          <CardHeader title="Status taqsimoti" subtitle="Hozirgi holatda" />
          <CardBody>
            {status.isLoading || !status.data ? (
              <Skeleton className="h-56" />
            ) : (
              <div className="grid grid-cols-2 gap-4 items-center">
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={status.data}
                        dataKey="count"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={72}
                        paddingAngle={2}
                      >
                        {status.data.map((d) => (
                          <Cell key={d.status} fill={STATUS_COLORS[d.status] ?? '#64748B'} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: '#141622',
                          border: '1px solid #232838',
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {status.data.map((s) => (
                    <div key={s.status} className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ background: STATUS_COLORS[s.status] }}
                      />
                      <span className="text-xs text-[var(--color-text-muted)] flex-1">
                        {STATUS_LABEL[s.status] ?? s.status}
                      </span>
                      <span className="text-xs font-semibold text-[var(--color-text)] tabular-nums">
                        {formatNumber(s.count)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Geo */}
      <Card>
        <CardHeader
          title="Geografik tahlil"
          subtitle="Buyurtmalar viloyat bo'yicha (oxirgi 5000 buyurtma)"
        />
        <CardBody>
          {geo.isLoading || !geo.data ? (
            <Skeleton className="h-64" />
          ) : (
            <div className="space-y-2">
              {geo.data.slice(0, 10).map((g) => {
                const max = Math.max(...geo.data!.map((x) => x.revenue), 1);
                const pct = (g.revenue / max) * 100;
                return (
                  <div
                    key={g.region}
                    className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors"
                  >
                    <MapPin size={14} className="text-[var(--color-text-subtle)]" />
                    <span className="text-sm text-[var(--color-text)] w-32 shrink-0">
                      {g.region}
                    </span>
                    <div className="flex-1 h-2 bg-[var(--color-bg)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)]"
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                    <span className="text-xs text-[var(--color-text-muted)] w-16 text-right tabular-nums">
                      {formatNumber(g.count)} ta
                    </span>
                    <span className="text-sm font-semibold text-[var(--color-text)] w-32 text-right tabular-nums">
                      {formatUzs(g.revenue)}
                    </span>
                  </div>
                );
              })}
              {geo.data.length === 0 && (
                <div className="py-12 text-center">
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Hozircha buyurtmalar yo'q
                  </p>
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
}
