'use client';

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export function KpiCard({
  label,
  value,
  delta,
  icon: Icon,
  hint,
  tone = 'default',
  index = 0,
}: {
  label: string;
  value: string;
  delta?: { value: number; positive?: boolean };
  icon: LucideIcon;
  hint?: string;
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  index?: number;
}) {
  const toneClasses: Record<typeof tone, string> = {
    default: 'from-[var(--color-surface-elevated)] to-[var(--color-surface)]',
    primary: 'from-[var(--color-primary)]/20 to-[var(--color-surface)]',
    success: 'from-[var(--color-success)]/20 to-[var(--color-surface)]',
    warning: 'from-[var(--color-warning)]/20 to-[var(--color-surface)]',
    danger: 'from-[var(--color-danger)]/20 to-[var(--color-surface)]',
    info: 'from-sky-500/20 to-[var(--color-surface)]',
  };

  const iconBg: Record<typeof tone, string> = {
    default: 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]',
    primary: 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]',
    success: 'bg-[var(--color-success)]/20 text-[var(--color-success)]',
    warning: 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]',
    danger: 'bg-[var(--color-danger)]/20 text-[var(--color-danger)]',
    info: 'bg-sky-500/20 text-sky-500',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-[var(--color-border)] p-5',
        'bg-gradient-to-br',
        toneClasses[tone],
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className={cn('h-10 w-10 rounded-xl grid place-items-center', iconBg[tone])}>
          <Icon size={18} />
        </div>
        {delta && (
          <div
            className={cn(
              'inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-semibold',
              delta.positive
                ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]'
                : 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]',
            )}
          >
            {delta.positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(delta.value).toFixed(1)}%
          </div>
        )}
      </div>
      <p className="text-xs text-[var(--color-text-muted)] mb-1">{label}</p>
      <p className="text-2xl font-bold text-[var(--color-text)] tabular-nums leading-none">
        {value}
      </p>
      {hint && <p className="text-[11px] text-[var(--color-text-subtle)] mt-2">{hint}</p>}
    </motion.div>
  );
}
