import { cn } from '@/lib/cn';
import type { LucideIcon } from 'lucide-react';

/** Bo'sh holat — markazlashgan ikonka + sarlavha + ixtiyoriy izoh. */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-4 py-10 text-center', className)}>
      {Icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-bg)] text-[var(--color-text-muted)]">
          <Icon size={22} strokeWidth={1.75} />
        </div>
      )}
      <p className="text-sm font-medium text-[var(--color-text)]">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-xs leading-relaxed text-[var(--color-text-muted)]">{hint}</p>}
    </div>
  );
}
