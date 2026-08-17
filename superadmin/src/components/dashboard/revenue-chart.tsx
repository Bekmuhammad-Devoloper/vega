'use client';

import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import dayjs from 'dayjs';
import type { RevenuePoint } from '@/lib/types';
import { formatCompact, formatUzs } from '@/lib/format';

export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  const series = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        label: dayjs(d.date).format('DD MMM'),
      })),
    [data],
  );

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366F1" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#2A2F40" strokeDasharray="3 3" vertical={false} />
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
            tickFormatter={(v: number) => formatCompact(v)}
          />
          <Tooltip
            contentStyle={{
              background: '#151823',
              border: '1px solid #2A2F40',
              borderRadius: 12,
              fontSize: 12,
            }}
            labelStyle={{ color: '#94A3B8' }}
            formatter={(v: number) => [formatUzs(v), 'Daromad']}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#6366F1"
            strokeWidth={2.5}
            fill="url(#revFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
