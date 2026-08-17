'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Calendar, ChevronDown, ChevronRight, ScrollText } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetchAudit, apiFetchAuditActions } from '@/lib/endpoints';
import { formatDate, formatNumber, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

const PAGE_SIZE = 50;

const ACTION_BADGE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  'auth.login': 'success',
  'auth.login.2fa': 'success',
  'tenant.suspend': 'danger',
  'tenant.resume': 'success',
  'tenant.tariff_change': 'info',
  'tenant.extend_trial': 'info',
  'team.create': 'success',
  'team.update': 'info',
  'team.deactivate': 'danger',
  'team.activate': 'success',
  'team.reset_password': 'warning',
  'invoice.create': 'info',
  'invoice.refund': 'warning',
  'tariff.update': 'info',
};

export default function AuditPage() {
  const [action, setAction] = useState('');
  const [since, setSince] = useState('');
  const [page, setPage] = useState(1);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['audit', action, since, page],
    queryFn: () =>
      apiFetchAudit({
        page,
        pageSize: PAGE_SIZE,
        action: action || undefined,
        since: since || undefined,
      }),
    placeholderData: (prev) => prev,
  });

  const actions = useQuery({
    queryKey: ['audit-actions'],
    queryFn: apiFetchAuditActions,
  });

  const totalPages = list.data ? Math.ceil(list.data.total / PAGE_SIZE) : 0;

  return (
    <>
      <PageHeader
        title="Audit Log"
        subtitle={
          list.data
            ? `${formatNumber(list.data.total)} ta yozuv — platforma adminlari harakatlari`
            : 'Yuklanmoqda...'
        }
      />

      <Card className="mb-4">
        <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5">
            <Select
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Barcha actionlar</option>
              {actions.data?.map((a) => (
                <option key={a.action} value={a.action}>
                  {a.action} ({a.count})
                </option>
              ))}
            </Select>
          </div>
          <div className="md:col-span-4 relative">
            <Calendar
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-subtle)] pointer-events-none"
            />
            <Input
              type="date"
              value={since}
              onChange={(e) => {
                setSince(e.target.value);
                setPage(1);
              }}
              className="pl-10"
              placeholder="Boshlanish sanasi"
            />
          </div>
          <Button
            variant="outline"
            size="md"
            className="md:col-span-3"
            onClick={() => {
              setAction('');
              setSince('');
              setPage(1);
            }}
          >
            Filtrlarni tozalash
          </Button>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left">
                <th className="py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-subtle)] w-10" />
                <th className="py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                  Action
                </th>
                <th className="py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                  Admin
                </th>
                <th className="py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                  Target
                </th>
                <th className="py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                  IP
                </th>
                <th className="py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                  Vaqt
                </th>
              </tr>
            </thead>
            <tbody>
              {list.isLoading || !list.data ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-[var(--color-border)]">
                    <td colSpan={6} className="py-3 px-5">
                      <Skeleton className="h-10" />
                    </td>
                  </tr>
                ))
              ) : list.data.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="inline-flex h-12 w-12 rounded-xl bg-[var(--color-surface-hover)] grid place-items-center text-[var(--color-text-subtle)] mb-3">
                      <ScrollText size={20} />
                    </div>
                    <p className="text-[var(--color-text-muted)] text-sm">Yozuvlar yo'q</p>
                  </td>
                </tr>
              ) : (
                list.data.items.map((log) => {
                  const expanded = expandedRow === log.id;
                  const hasDetails = log.changes && Object.keys(log.changes).length > 0;
                  return (
                    <>
                      <tr
                        key={log.id}
                        onClick={() => hasDetails && setExpandedRow(expanded ? null : log.id)}
                        className={cn(
                          'border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors',
                          hasDetails && 'cursor-pointer',
                        )}
                      >
                        <td className="py-3 px-5 text-[var(--color-text-subtle)]">
                          {hasDetails &&
                            (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                        </td>
                        <td className="py-3 px-5">
                          <Badge variant={ACTION_BADGE[log.action] ?? 'default'}>
                            {log.action}
                          </Badge>
                        </td>
                        <td className="py-3 px-5">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] grid place-items-center text-white text-xs font-semibold">
                              {log.admin.fullName.slice(0, 1).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm text-[var(--color-text)]">
                                {log.admin.fullName}
                              </p>
                              <p className="text-[10px] text-[var(--color-text-subtle)] uppercase tracking-wider">
                                {log.admin.role}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-5 text-xs">
                          {log.targetType && (
                            <p className="text-[var(--color-text-muted)]">
                              {log.targetType}
                              {log.targetId && (
                                <span className="ml-1 font-mono text-[var(--color-text-subtle)]">
                                  · {log.targetId.slice(0, 8)}
                                </span>
                              )}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-5 text-xs font-mono text-[var(--color-text-muted)]">
                          {log.ipAddress ?? '—'}
                        </td>
                        <td className="py-3 px-5 text-xs text-[var(--color-text-muted)]">
                          <div>{formatRelative(log.createdAt)}</div>
                          <div className="text-[10px] text-[var(--color-text-subtle)]">
                            {formatDate(log.createdAt, true)}
                          </div>
                        </td>
                      </tr>
                      {expanded && hasDetails && (
                        <tr className="bg-[var(--color-bg-secondary)]/50">
                          <td colSpan={6} className="px-5 py-3">
                            <p className="text-[10px] text-[var(--color-text-subtle)] uppercase tracking-wider mb-1.5">
                              Changes
                            </p>
                            <pre className="text-xs font-mono text-[var(--color-text-muted)] bg-[var(--color-bg)] rounded-lg p-3 overflow-x-auto">
                              {JSON.stringify(log.changes, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

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
