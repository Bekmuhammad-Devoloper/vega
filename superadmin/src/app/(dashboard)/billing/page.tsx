'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { CheckCircle2, Clock, XCircle, CircleDollarSign, Search, Receipt, FileText } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { apiFetchBillingSummary, apiFetchInvoices } from '@/lib/endpoints';
import type { InvoiceStatus } from '@/lib/types';
import { formatDate, formatNumber, formatUzs } from '@/lib/format';

const PAGE_SIZE = 25;

const STATUS_META: Record<
  InvoiceStatus,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'default' | 'info' }
> = {
  PAID: { label: "To'langan", variant: 'success' },
  PENDING: { label: 'Kutmoqda', variant: 'warning' },
  FAILED: { label: 'Muvaffaqiyatsiz', variant: 'danger' },
  REFUNDED: { label: 'Refund', variant: 'info' },
  CANCELLED: { label: 'Bekor', variant: 'default' },
};

const PROVIDER_LABEL: Record<string, string> = {
  payme: 'Payme',
  click: 'Click',
  manual: 'Manual',
};

export default function BillingPage() {
  const [status, setStatus] = useState<InvoiceStatus | ''>('');
  const [provider, setProvider] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const summary = useQuery({
    queryKey: ['billing-summary'],
    queryFn: apiFetchBillingSummary,
  });

  const list = useQuery({
    queryKey: ['invoices', status, provider, search, page],
    queryFn: () =>
      apiFetchInvoices({
        page,
        pageSize: PAGE_SIZE,
        status: status || undefined,
        provider: provider || undefined,
        search: search || undefined,
      }),
    placeholderData: (prev) => prev,
  });

  const totalPages = list.data ? Math.ceil(list.data.total / PAGE_SIZE) : 0;

  return (
    <>
      <PageHeader
        title="Billing & Payments"
        subtitle="Invoyslar, to'lovlar va refund'lar"
        action={
          <Button size="sm">
            <FileText size={14} />
            Manual invoice
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {summary.isLoading || !summary.data ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard
              label="To'langan (oy)"
              value={formatUzs(summary.data.totalPaidMtd)}
              icon={CheckCircle2}
              tone="success"
              hint={`${formatNumber(summary.data.paid)} invoyse`}
              index={0}
            />
            <KpiCard
              label="Kutilayotgan"
              value={formatUzs(summary.data.totalPending)}
              icon={Clock}
              tone="warning"
              hint={`${formatNumber(summary.data.pending)} invoyse`}
              index={1}
            />
            <KpiCard
              label="Muvaffaqiyatsiz"
              value={formatNumber(summary.data.failed)}
              icon={XCircle}
              tone={summary.data.failed > 0 ? 'danger' : 'default'}
              index={2}
            />
            <KpiCard
              label="Jami invoyse"
              value={formatNumber(summary.data.paid + summary.data.pending + summary.data.failed)}
              icon={CircleDollarSign}
              tone="default"
              index={3}
            />
          </>
        )}
      </div>

      <Card className="mb-4">
        <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5 relative">
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
              placeholder="Invoice raqami, do'kon, email..."
              className="pl-10"
            />
          </div>
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as InvoiceStatus | '');
              setPage(1);
            }}
            className="md:col-span-3"
          >
            <option value="">Barcha statuslar</option>
            <option value="PAID">To'langan</option>
            <option value="PENDING">Kutmoqda</option>
            <option value="FAILED">Muvaffaqiyatsiz</option>
            <option value="REFUNDED">Refund</option>
            <option value="CANCELLED">Bekor</option>
          </Select>
          <Select
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value);
              setPage(1);
            }}
            className="md:col-span-3"
          >
            <option value="">Barcha provider</option>
            <option value="payme">Payme</option>
            <option value="click">Click</option>
            <option value="manual">Manual</option>
          </Select>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left">
                <th className="py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                  Invoice #
                </th>
                <th className="py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                  Do'kon
                </th>
                <th className="py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                  Summa
                </th>
                <th className="py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                  Status
                </th>
                <th className="py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                  Provider
                </th>
                <th className="py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                  Sana
                </th>
              </tr>
            </thead>
            <tbody>
              {list.isLoading || !list.data ? (
                Array.from({ length: 6 }).map((_, i) => (
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
                      <Receipt size={20} />
                    </div>
                    <p className="text-[var(--color-text-muted)] text-sm">Invoyslar yo'q</p>
                  </td>
                </tr>
              ) : (
                list.data.items.map((inv) => {
                  const meta = STATUS_META[inv.status];
                  return (
                    <tr
                      key={inv.id}
                      className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors"
                    >
                      <td className="py-3 px-5 font-mono text-xs text-[var(--color-text-muted)]">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3 px-5">
                        <Link
                          href={`/tenants/${inv.tenant.id}`}
                          className="flex items-center gap-2"
                        >
                          {inv.tenant.logoUrl ? (
                            <img
                              src={inv.tenant.logoUrl}
                              alt=""
                              className="h-7 w-7 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] grid place-items-center text-white font-semibold text-xs">
                              {inv.tenant.shopName.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm text-[var(--color-text)] truncate">
                              {inv.tenant.shopName}
                            </p>
                            <p className="text-[10px] text-[var(--color-text-subtle)] truncate">
                              {inv.tenant.ownerEmail}
                            </p>
                          </div>
                        </Link>
                      </td>
                      <td className="py-3 px-5 text-sm tabular-nums font-semibold">
                        {formatUzs(inv.amount)}
                      </td>
                      <td className="py-3 px-5">
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </td>
                      <td className="py-3 px-5 text-xs text-[var(--color-text-muted)]">
                        {inv.paymentProvider
                          ? PROVIDER_LABEL[inv.paymentProvider] ?? inv.paymentProvider
                          : '—'}
                        {inv.providerTxId && (
                          <p className="font-mono text-[10px] text-[var(--color-text-subtle)] mt-0.5">
                            {inv.providerTxId.slice(0, 12)}…
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-5 text-xs text-[var(--color-text-muted)]">
                        <p>{formatDate(inv.createdAt)}</p>
                        {inv.paidAt && (
                          <p className="text-[10px] text-[var(--color-success)] mt-0.5">
                            ✓ {formatDate(inv.paidAt)}
                          </p>
                        )}
                      </td>
                    </tr>
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
