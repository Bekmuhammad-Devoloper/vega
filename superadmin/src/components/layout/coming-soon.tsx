import type { LucideIcon } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/card';

export function ComingSoon({
  title,
  description,
  icon: Icon,
  phase,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  phase: string;
}) {
  return (
    <Card>
      <CardBody className="py-20 text-center">
        <div className="inline-flex h-16 w-16 rounded-2xl bg-[var(--color-primary)]/15 text-[var(--color-primary)] grid place-items-center mb-4">
          <Icon size={28} />
        </div>
        <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">{title}</h2>
        <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto mb-3">
          {description}
        </p>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-surface-hover)] text-xs text-[var(--color-text-muted)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-warning)]" />
          {phase}
        </span>
      </CardBody>
    </Card>
  );
}
