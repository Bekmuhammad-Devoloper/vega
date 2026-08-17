'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Megaphone,
  Users as UsersIcon,
  CheckCircle2,
  Loader2,
  Send,
  Plus,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { apiFetchBroadcasts, apiFetchBroadcastsSummary } from '@/lib/endpoints';
import { formatNumber, formatRelative } from '@/lib/format';

const PAGE_SIZE = 20;

const STATUS_META: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
  completed: { label: 'Yakunlangan', variant: 'success' },
  running: { label: 'Yuborilmoqda', variant: 'info' },
  pending: { label: 'Kutmoqda', variant: 'warning' },
  failed: { label: 'Xato', variant: 'danger' },
};

export default function BroadcastsPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const summary = useQuery({
    queryKey: ['broadcasts-summary'],
    queryFn: apiFetchBroadcastsSummary,
  });

  const list = useQuery({
    queryKey: ['broadcasts', status, page],
    queryFn: () =>
      apiFetchBroadcasts({
        page,
        pageSize: PAGE_SIZE,
        status: status || undefined,
      }),
    placeholderData: (prev) => prev,
  });

  const totalPages = list.data ? Math.ceil(list.data.total / PAGE_SIZE) : 0;

  return (
    <>
      <PageHeader
        title="Broadcasts"
        subtitle="Ommaviy xabarlar va kampaniyalar"
        action={
          <Button size="sm">
            <Plus size={14} />
            Yangi kampaniya
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {summary.isLoading || !summary.data ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard
              label="Jami kampaniyalar"
              value={formatNumber(summary.data.total)}
              icon={Megaphone}
              tone="primary"
              index={0}
            />
            <KpiCard
              label="Yakunlangan"
              value={formatNumber(summary.data.completed)}
              icon={CheckCircle2}
              tone="success"
              index={1}
            />
            <KpiCard
              label="Hozir yuborilmoqda"
              value={formatNumber(summary.data.running)}
              icon={Loader2}
              tone="info"
              index={2}
            />
            <KpiCard
              label="Jami yetkazilgan"
              value={formatNumber(summary.data.totalRecipients)}
              icon={UsersIcon}
              tone="default"
              index={3}
            />
          </>
        )}
      </div>

      <Card className="mb-4">
        <div className="p-4">
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          >
            <option value="">Barcha statuslar</option>
            <option value="completed">Yakunlangan</option>
            <option value="running">Yuborilmoqda</option>
            <option value="pending">Kutmoqda</option>
            <option value="failed">Xato</option>
          </Select>
        </div>
      </Card>

      <Card>
        {list.isLoading || !list.data ? (
          <div className="p-5 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : list.data.items.length === 0 ? (
          <div className="py-20 text-center">
            <div className="inline-flex h-14 w-14 rounded-2xl bg-[var(--color-surface-hover)] grid place-items-center text-[var(--color-text-subtle)] mb-3">
              <Send size={24} />
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">Kampaniyalar yo'q</p>
            <p className="text-xs text-[var(--color-text-subtle)] mt-1">
              Birinchi broadcast kampaniyangizni yarating
            </p>
            <Button size="sm" className="mt-4">
              <Plus size={14} />
              Yangi kampaniya
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {list.data.items.map((b) => {
              const meta = STATUS_META[b.status] ?? { label: b.status, variant: 'default' as const };
              const sentPct = b.totalCount > 0 ? (b.sentCount / b.totalCount) * 100 : 0;
              return (
                <li key={b.id}>
                  <div className="px-5 py-4 hover:bg-[var(--color-surface-hover)] transition-colors">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="h-10 w-10 rounded-xl bg-[var(--color-primary)]/15 text-[var(--color-primary)] grid place-items-center shrink-0">
                        <Megaphone size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant={meta.variant}>
                            {b.status === 'running' && <Loader2 size={10} className="animate-spin" />}
                            {meta.label}
                          </Badge>
                          <span className="text-[10px] text-[var(--color-text-subtle)]">
                            {formatRelative(b.createdAt)}
                          </span>
                          {b.finishedAt && (
                            <span className="text-[10px] text-[var(--color-text-subtle)]">
                              · Yakuni: {formatRelative(b.finishedAt)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-[var(--color-text)] line-clamp-2">
                          {b.messageUz}
                        </p>
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="ml-13 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--color-text-muted)]">
                          {formatNumber(b.sentCount)} / {formatNumber(b.totalCount)}
                        </span>
                        <div className="flex items-center gap-3 tabular-nums">
                          {b.failedCount > 0 && (
                            <span className="text-[var(--color-danger)]">
                              {b.failedCount} failed
                            </span>
                          )}
                          <span className="text-[var(--color-text)] font-semibold">
                            {sentPct.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-[var(--color-bg)] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            b.status === 'failed'
                              ? 'bg-[var(--color-danger)]'
                              : 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)]'
                          }`}
                          style={{ width: `${Math.max(sentPct, 2)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {list.data && totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--color-border)]">
            <p className="text-xs text-[var(--color-text-muted)]">
              {(page - 1) * PAGE_SIZE + 1} – {Math.min(page * PAGE_SIZE, list.data.total)} /{' '}
              {formatNumber(list.data.total)}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ←
              </Button>
              <span className="text-xs text-[var(--color-text-muted)] px-2 tabular-nums">
                {page} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                →
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
