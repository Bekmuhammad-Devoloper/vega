'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { TariffDistribution } from '@/lib/types';
import { TARIFF_META } from '@/lib/tariff';
import { formatNumber, formatUzs } from '@/lib/format';

const COLORS: Record<string, string> = {
  FREE: '#64748B',
  STANDARD: '#3B82F6',
  PRO: '#8B5CF6',
  PREMIUM: '#F59E0B',
};

export function TariffDonut({ data }: { data: TariffDistribution[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const totalMrr = data.reduce((s, d) => s + d.mrr, 0);

  return (
    <div className="relative">
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              cx="50%"
              cy="50%"
              innerRadius={56}
              outerRadius={84}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((d) => (
                <Cell key={d.plan} fill={COLORS[d.plan]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: '#151823',
                border: '1px solid #2A2F40',
                borderRadius: 12,
                fontSize: 12,
              }}
              formatter={(v: number, _name: string, props: { payload?: TariffDistribution }) => [
                `${formatNumber(v)} do'kon · ${formatUzs(props.payload?.mrr ?? 0)}`,
                TARIFF_META[(props.payload?.plan ?? 'FREE') as keyof typeof TARIFF_META].label,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="text-center">
            <p className="text-2xl font-bold tabular-nums">{formatNumber(total)}</p>
            <p className="text-[10px] text-[var(--color-text-subtle)] uppercase tracking-wider">
              Jami
            </p>
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {data.map((d) => (
          <div key={d.plan} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: COLORS[d.plan] }}
              />
              <span className="text-[var(--color-text-muted)]">
                {TARIFF_META[d.plan].label}
              </span>
            </div>
            <div className="flex items-center gap-3 tabular-nums">
              <span className="text-[var(--color-text)]">{formatNumber(d.count)}</span>
              <span className="text-[var(--color-text-subtle)] w-20 text-right">
                {totalMrr > 0 ? `${((d.mrr / totalMrr) * 100).toFixed(0)}%` : '—'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
