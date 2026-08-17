'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle, Search, Clock, CheckCircle2, Inbox } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { apiFetchSupportSummary, apiFetchTickets } from '@/lib/endpoints';
import { formatNumber, formatRelative } from '@/lib/format';

const PAGE_SIZE = 25;

export default function SupportPage() {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const summary = useQuery({ queryKey: ['support-summary'], queryFn: apiFetchSupportSummary });
  const list = useQuery({
    queryKey: ['tickets', status, search, page],
    queryFn: () =>
      apiFetchTickets({
        page,
        pageSize: PAGE_SIZE,
        status: status || undefined,
        search: search || undefined,
      }),
    placeholderData: (prev) => prev,
  });

  const totalPages = list.data ? Math.ceil(list.data.total / PAGE_SIZE) : 0;

  return (
    <>
      <PageHeader
        title="Support Inbox"
        subtitle="Hamma do'kondan kelgan tiketlar bir joyda"
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        {summary.isLoading || !summary.data ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard
              label="Ochiq tiketlar"
              value={formatNumber(summary.data.open)}
              icon={Inbox}
              tone={summary.data.open > 0 ? 'warning' : 'success'}
              index={0}
            />
            <KpiCard
              label="Hal qilingan"
              value={formatNumber(summary.data.resolved)}
              icon={CheckCircle2}
              tone="success"
              index={1}
            />
            <KpiCard
              label="Bugun keldi"
              value={formatNumber(summary.data.today)}
              icon={Clock}
              tone="primary"
              index={2}
            />
          </>
        )}
      </div>

      <Card className="mb-4">
        <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-7 relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-subtle)] pointer-events-none"
            />
            <Input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Mavzu yoki xabar matni..."
              className="pl-10"
            />
          </div>
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="md:col-span-5"
          >
            <option value="">Barcha statuslar</option>
            <option value="open">Ochiq</option>
            <option value="in_progress">Jarayonda</option>
            <option value="resolved">Hal qilingan</option>
            <option value="closed">Yopiq</option>
          </Select>
        </div>
      </Card>

      <Card>
        {list.isLoading || !list.data ? (
          <div className="p-5 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : list.data.items.length === 0 ? (
          <div className="py-20 text-center">
            <div className="inline-flex h-14 w-14 rounded-2xl bg-[var(--color-surface-hover)] grid place-items-center text-[var(--color-text-subtle)] mb-3">
              <MessageCircle size={24} />
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">Tiketlar yo'q</p>
            <p className="text-xs text-[var(--color-text-subtle)] mt-1">
              Mijozlardan tiket kelganda shu yerda ko'rinadi
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {list.data.items.map((t) => (
              <li key={t.id}>
                <div className="px-5 py-4 hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer">
                  <div className="flex items-start gap-3">
                    {t.user.photoUrl ? (
                      <img
                        src={t.user.photoUrl}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] grid place-items-center text-white font-semibold text-sm shrink-0">
                        {(t.user.firstName ?? t.user.username ?? 'U').slice(0, 1).toUpperCase()}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-semibold text-[var(--color-text)] truncate">
                          {t.subject}
                        </p>
                        <Badge
                          variant={
                            t.status === 'open'
                              ? 'warning'
                              : t.status === 'resolved'
                                ? 'success'
                                : t.status === 'closed'
                                  ? 'default'
                                  : 'info'
                          }
                        >
                          {t.status}
                        </Badge>
                        {t.responses.length > 0 && (
                          <Badge variant="default">
                            <MessageCircle size={10} />
                            {t.responses.length}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)] line-clamp-1 mb-1">
                        {t.message}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-subtle)]">
                        <span>
                          {[t.user.firstName, t.user.lastName].filter(Boolean).join(' ') ||
                            t.user.username ||
                            'Anonim'}
                        </span>
                        <span>·</span>
                        <span>{formatRelative(t.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
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
