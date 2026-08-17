import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatMoney, formatMoneyParts } from '@/lib/format';
import type { ReactNode } from 'react';

const MONEY_UNIT = "so'm";

/**
 * Opt-in money value for <KpiCard>. Renders the amount in tabular figures with a
 * de-emphasised, single-line currency unit. `compact` collapses large sums
 * ("1 250 000" -> "1.25 mln so'm") so the value still fits a ~160px mobile card.
 *
 * Usage (optional — KpiCard also auto-formats plain `formatMoney()` strings):
 *   <KpiCard value={<MoneyValue value={overview.today.revenue} />} ... />
 */
export function MoneyValue({
  value,
  compact = true,
}: {
  value: number | string;
  compact?: boolean;
}) {
  const { amount, unit } = formatMoneyParts(value, { compact });
  // Hover shows the exact, non-compacted figure (e.g. "1.25 mln so'm" -> "1 250 000 so'm").
  return (
    <span title={formatMoney(value)}>
      <Amount amount={amount} unit={unit} />
    </span>
  );
}

function Amount({ amount, unit }: { amount: string; unit: string }) {
  return (
    <>
      <span className="tabular-nums">{amount}</span>
      <span className="ml-1 text-sm font-semibold text-[var(--color-text-muted)]">{unit}</span>
    </>
  );
}

/**
 * Normalises whatever the dashboard passes (raw number, "0%", a money string from
 * `formatMoney()`, or a custom node) into a single-line value. A trailing " so'm"
 * is split out and muted so revenue never visually dominates or wraps.
 */
function renderValue(value: ReactNode): ReactNode {
  if (typeof value === 'string' && value.endsWith(MONEY_UNIT)) {
    const amount = value.slice(0, -MONEY_UNIT.length).trimEnd();
    return <Amount amount={amount} unit={MONEY_UNIT} />;
  }
  return value;
}

/** Best-effort plain text for the title (hover) affordance when a value clips. */
function plainText(value: ReactNode): string | undefined {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}

export function KpiCard({
  title,
  value,
  icon,
  delta,
  hint,
}: {
  title: string;
  value: ReactNode;
  icon: ReactNode;
  delta?: number;
  hint?: string;
}) {
  const isUp = (delta ?? 0) > 0;
  const isDown = (delta ?? 0) < 0;

  return (
    <div
      className={cn(
        // Fixed min-h dominates the content height, so all four cards are exactly
        // the same height and the loading Skeleton (h-[150px]) matches → no load jump.
        'group flex min-h-[150px] flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4',
        'transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-primary)]/30',
        'hover:shadow-[0_10px_28px_-14px_rgba(15,23,42,0.22)]',
      )}
    >
      {/* Label + tinted icon chip (premium fintech). Title fully visible — wraps to
          2 lines and reserves 2-line height so every card's value row aligns. */}
      <div className="flex items-start justify-between gap-2">
        <span className="block min-h-[2.5em] min-w-0 text-xs font-medium leading-[1.25] text-[var(--color-text-muted)] line-clamp-2">
          {title}
        </span>
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] transition-colors group-hover:bg-[var(--color-primary)]/15">
          {icon}
        </div>
      </div>

      {/* Hero value — one consistent scale, fixed-height row, single line, never wraps.
          The fixed min-h locks the value band so every card is identical height
          regardless of delta presence or the text-xl -> lg:text-2xl breakpoint. */}
      <div
        className="mt-3 flex min-h-[32px] items-baseline overflow-hidden whitespace-nowrap text-xl font-bold leading-none tracking-tight tabular-nums text-[var(--color-text)] lg:text-2xl"
        title={plainText(value)}
      >
        <span className="truncate">{renderValue(value)}</span>
      </div>

      {/* Trend pill + hint pinned to the bottom, single line -> identical card heights */}
      <div className="mt-auto flex min-h-[22px] flex-nowrap items-center gap-x-2 pt-3">
        {delta !== undefined && (
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums',
              isUp && 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
              isDown && 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]',
              !isUp && !isDown && 'bg-[var(--color-text-muted)]/10 text-[var(--color-text-muted)]',
            )}
          >
            {isUp && <ArrowUpRight size={12} className="shrink-0" />}
            {isDown && <ArrowDownRight size={12} className="shrink-0" />}
            {delta > 0 ? '+' : ''}
            {delta.toFixed(1)}%
          </span>
        )}
        {hint && (
          <span className="min-w-0 truncate text-xs text-[var(--color-text-muted)]">{hint}</span>
        )}
      </div>
    </div>
  );
}
