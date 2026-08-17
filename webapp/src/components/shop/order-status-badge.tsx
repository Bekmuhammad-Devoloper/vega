import { cn } from '@/lib/cn';
import type { NumberOrderStatus } from '@/lib/api/types';
import type { Locale } from '@/i18n';
import { getMessages, tr } from '@/i18n';

const COLORS: Record<NumberOrderStatus, string> = {
  WAITING_CODE: 'bg-amber-50 text-amber-700',
  RECEIVED: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-rose-50 text-rose-700',
  EXPIRED: 'bg-slate-100 text-slate-600',
  ERROR: 'bg-rose-50 text-rose-700',
};

export function OrderStatusBadge({
  status,
  locale,
}: {
  status: NumberOrderStatus;
  locale: Locale;
}) {
  const messages = getMessages(locale);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold',
        COLORS[status] ?? 'bg-slate-100 text-slate-600',
      )}
    >
      {status === 'WAITING_CODE' && (
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
      )}
      {tr(messages, `order.status.${status}`)}
    </span>
  );
}
