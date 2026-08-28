'use client';

import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  /** Yonida ko'rsatiladigan son (masalan nechta foydalanuvchi). */
  count?: number;
  /** Chapdagi rangli nuqta — status uchun. */
  dot?: 'green' | 'red' | 'amber' | 'blue' | 'gray';
  icon?: ReactNode;
};

const dotColors: Record<NonNullable<SegmentedOption<string>['dot']>, string> = {
  green: 'bg-emerald-500',
  red: 'bg-rose-500',
  amber: 'bg-amber-500',
  blue: 'bg-blue-500',
  gray: 'bg-gray-400',
};

/**
 * Segmentli tanlagich — native <select> o'rniga.
 * Telefonda tizimning xunuk dropdown oynasi ochilmaydi: barcha variant
 * ko'rinib turadi va bitta teginish bilan tanlanadi.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'md',
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegmentedOption<T>[];
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-grid w-full gap-1 rounded-xl bg-[var(--color-bg)] p-1',
        'border border-[var(--color-border)]',
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold',
              'transition-all duration-150 select-none',
              size === 'sm' ? 'h-8 px-2 text-xs' : 'h-9 px-2.5 text-[13px]',
              active
                ? 'bg-white text-[var(--color-text)] shadow-sm ring-1 ring-black/[0.04]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] active:scale-[0.97]',
            )}
          >
            {opt.dot && (
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full shrink-0 transition-opacity',
                  dotColors[opt.dot],
                  !active && 'opacity-50',
                )}
              />
            )}
            {opt.icon}
            <span className="truncate">{opt.label}</span>
            {opt.count != null && (
              <span
                className={cn(
                  'ml-0.5 rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums shrink-0',
                  active
                    ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'bg-black/[0.06] text-[var(--color-text-muted)]',
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
