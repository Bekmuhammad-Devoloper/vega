'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { apiStatsTimeseries } from '@/lib/endpoints';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui/skeleton';

type Metric = 'orders' | 'revenue' | 'visitors';

const METRIC_COLOR: Record<Metric, string> = {
  orders: '#2F6BFF',
  revenue: '#16A34A',
  visitors: '#F59E0B',
};

const METRIC_LABEL: Record<Metric, string> = {
  orders: 'Sotuvlar',
  revenue: 'Tushum',
  visitors: 'Tashriflar',
};

export function TimeseriesChart() {
  const [metric, setMetric] = useState<Metric>('orders');
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['stats', 'timeseries'],
    queryFn: () => apiStatsTimeseries(),
  });

  return (
    <Card>
      <div className="px-4 py-3 border-b border-[var(--color-border)]">
        <h2 className="font-semibold text-sm mb-2">So&apos;nggi 30 kun</h2>
        <div className="flex items-center gap-1 overflow-x-auto -mx-1 px-1">
          {(['orders', 'revenue', 'visitors'] as Metric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={cn(
                'h-7 px-2.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0',
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
        {isLoading ? (
          <Skeleton className="h-full w-full" />
        ) : isError || !data ? (
          /* Xato bo'lganda `isLoading` false, `data` esa undefined — ilgari bu
             yerda skeleton ABADIY turib qolardi va sabab ko'rinmasdi. */
          <div className="h-full grid place-items-center text-center px-4">
            <div>
              <p className="text-sm font-medium">Grafik yuklanmadi</p>
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="mt-2 text-sm font-semibold text-[var(--color-primary)] disabled:opacity-50"
              >
                {isFetching ? 'Yuklanmoqda…' : 'Qayta urinish'}
              </button>
            </div>
          </div>
        ) : data.length === 0 ? (
          <div className="h-full grid place-items-center text-center px-4">
            <p className="text-sm text-[var(--color-text-muted)]">
              So&apos;nggi 30 kunda ma&apos;lumot yo&apos;q
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
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
                fill={`url(#grad-${metric})`}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
