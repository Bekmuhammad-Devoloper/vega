import { cn } from '@/lib/cn';
import type { DigitalOrderStatus } from '@/lib/api/types';
import type { Locale } from '@/i18n';
import { getMessages, tr } from '@/i18n';

const COLORS: Record<DigitalOrderStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700',
  FULFILLED: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-rose-50 text-rose-700',
};

export function DigitalStatusBadge({
  status,
  locale,
}: {
  status: DigitalOrderStatus;
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
      {status === 'PENDING' && (
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
      )}
      {tr(messages, `digital.status.${status}`)}
    </span>
  );
}
