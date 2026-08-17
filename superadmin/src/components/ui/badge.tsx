import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'tier-free' | 'tier-standard' | 'tier-pro' | 'tier-premium';

const V: Record<Variant, string> = {
  default: 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]',
  success: 'bg-[var(--color-success)]/15 text-[var(--color-success)]',
  warning: 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]',
  info: 'bg-[var(--color-info)]/15 text-[var(--color-info)]',
  'tier-free': 'bg-[var(--color-tier-free)]/15 text-[var(--color-tier-free)]',
  'tier-standard': 'bg-[var(--color-tier-standard)]/15 text-[var(--color-tier-standard)]',
  'tier-pro': 'bg-[var(--color-tier-pro)]/15 text-[var(--color-tier-pro)]',
  'tier-premium': 'bg-[var(--color-tier-premium)]/15 text-[var(--color-tier-premium)]',
};

export function Badge({
  variant = 'default',
  children,
  className,
}: {
  variant?: Variant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap',
        V[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
