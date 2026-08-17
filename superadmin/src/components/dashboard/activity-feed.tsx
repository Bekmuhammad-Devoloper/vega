'use client';

import Link from 'next/link';
import {
  UserPlus,
  ArrowUpRight,
  CreditCard,
  AlertCircle,
  Ban,
  MessageCircle,
} from 'lucide-react';
import type { ActivityEvent } from '@/lib/types';
import { formatRelative, formatUzs } from '@/lib/format';

const ICONS = {
  tenant_signup: { icon: UserPlus, tone: 'success' as const },
  tariff_upgrade: { icon: ArrowUpRight, tone: 'primary' as const },
  payment_success: { icon: CreditCard, tone: 'success' as const },
  payment_failed: { icon: AlertCircle, tone: 'danger' as const },
  tenant_suspended: { icon: Ban, tone: 'danger' as const },
  support_ticket: { icon: MessageCircle, tone: 'info' as const },
};

const TONE_BG = {
  success: 'bg-[var(--color-success)]/15 text-[var(--color-success)]',
  primary: 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]',
  danger: 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]',
  info: 'bg-[var(--color-info)]/15 text-[var(--color-info)]',
};

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-[var(--color-text-subtle)]">
        Hozircha faollik yo'q
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[var(--color-border)]">
      {events.map((ev) => {
        const meta = ICONS[ev.type] ?? ICONS.tenant_signup;
        const Icon = meta.icon;
        const content = (
          <div className="flex items-start gap-3 py-3 px-5 hover:bg-[var(--color-surface-hover)] transition-colors">
            <div
              className={`h-8 w-8 shrink-0 rounded-lg grid place-items-center ${TONE_BG[meta.tone]}`}
            >
              <Icon size={14} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-[var(--color-text)] truncate">
                {ev.description}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {ev.tenantName && (
                  <span className="text-[11px] text-[var(--color-text-muted)] truncate">
                    {ev.tenantName}
                  </span>
                )}
                <span className="text-[11px] text-[var(--color-text-subtle)]">
                  · {formatRelative(ev.createdAt)}
                </span>
              </div>
            </div>
            {ev.amount && (
              <div className="text-xs font-semibold text-[var(--color-success)] tabular-nums">
                +{formatUzs(ev.amount)}
              </div>
            )}
          </div>
        );
        return (
          <li key={ev.id}>
            {ev.tenantId ? <Link href={`/tenants/${ev.tenantId}`}>{content}</Link> : content}
          </li>
        );
      })}
    </ul>
  );
}
