import { Ban, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Foydalanuvchi holati uchun yagona ko'rinish (ro'yxat + detal sahifa bir xil).
 * Rangli nuqta + ikonka + matn — bir qarashda o'qiladi.
 */
export function UserStatusBadge({
  blocked,
  size = 'md',
  className,
}: {
  blocked: boolean;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const sm = size === 'sm';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap',
        'ring-1 ring-inset',
        sm ? 'px-1.5 py-px text-[10px]' : 'px-2 py-0.5 text-[11px]',
        blocked
          ? 'bg-rose-50 text-rose-600 ring-rose-200'
          : 'bg-emerald-50 text-emerald-600 ring-emerald-200',
        className,
      )}
    >
      {blocked ? (
        <Ban size={sm ? 9 : 11} strokeWidth={2.5} />
      ) : (
        <CheckCircle2 size={sm ? 9 : 11} strokeWidth={2.5} />
      )}
      {blocked ? 'Bloklangan' : 'Faol'}
    </span>
  );
}
