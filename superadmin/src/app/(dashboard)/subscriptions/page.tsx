'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import dayjs from 'dayjs';
import { CreditCard, AlertCircle, CircleDollarSign, Clock } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from '@/components/dashboard/kpi-card';
import {
  apiFetchSubscriptions,
  apiFetchSubscriptionsSummary,
} from '@/lib/endpoints';
import type { SubscriptionStatus, TariffPlan } from '@/lib/types';
import { TARIFF_META } from '@/lib/tariff';
import { formatDate, formatNumber, formatUzs } from '@/lib/format';

const PAGE_SIZE = 25;

const STATUS_BADGE: Record<SubscriptionStatus, 'success' | 'warning' | 'danger' | 'default'> = {
  ACTIVE: 'success',
  EXPIRED: 'default',
  CANCELLED: 'default',
  PAST_DUE: 'danger',
};

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  ACTIVE: 'Faol',
  EXPIRED: 'Tugagan',
  CANCELLED: 'Bekor',
  PAST_DUE: "To'lov o'tib ketgan",
};

export default function SubscriptionsPage() {
  const [status, setStatus] = useState<SubscriptionStatus | ''>('');
  const [plan, setPlan] = useState<TariffPlan | ''>('');
  const [expiringWithin, setExpiringWithin] = useState<number | ''>('');
  const [page, setPage] = useState(1);

  const summary = useQuery({
    queryKey: ['sub-summary'],
    queryFn: apiFetchSubscriptionsSummary,
  });

  const list = useQuery({
    queryKey: ['subscriptions', status, plan, expiringWithin, page],
    queryFn: () =>
      apiFetchSubscriptions({
        page,
        pageSize: PAGE_SIZE,
        status: status || undefined,
        plan: plan || undefined,
        expiringWithin: expiringWithin || undefined,
      }),
    placeholderData: (prev) => prev,
  });

  const totalPages = list.data ? Math.ceil(list.data.total / PAGE_SIZE) : 0;

  return (
    <>
      <PageHeader
        title="Faollashtirishlar"
        subtitle="Bir martalik faollashtirish yozuvlari va to'lov holati"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {summary.isLoading || !summary.data ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard
              label="Faol obunalar"
              value={formatNumber(summary.data.active)}
              icon={CreditCard}
              tone="success"
              index={0}
            />
            <KpiCard
              label="Jami MRR"
              value={formatUzs(summary.data.totalMrr)}
              icon={CircleDollarSign}
              tone="primary"
              index={1}
            />
            <KpiCard
              label="7 kun ichida tugaydi"
              value={formatNumber(summary.data.expiringSoon)}
              icon={Clock}
              tone="warning"
              index={2}
            />
            <KpiCard
              label="To'lovi muddati o'tgan"
              value={formatNumber(summary.data.pastDue)}
              icon={AlertCircle}
              tone={summary.data.pastDue > 0 ? 'danger' : 'default'}
              index={3}
            />
          </>
        )}
      </div>

      <Card className="mb-4">
        <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3">
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as SubscriptionStatus | '');
              setPage(1);
            }}
            className="md:col-span-3"
          >
            <option value="">Barcha statuslar</option>
            <option value="ACTIVE">Faol</option>
            <option value="PAST_DUE">To'lovi muddati o'tgan</option>
            <option value="EXPIRED">Tugagan</option>
            <option value="CANCELLED">Bekor</option>
          </Select>
          <Select
            value={plan}
            onChange={(e) => {
              setPlan(e.target.value as TariffPlan | '');
              setPage(1);
            }}
            className="md:col-span-3"
          >
            <option value="">Barcha tariflar</option>
            <option value="FREE">🆓 Free</option>
            <option value="STANDARD">⭐ Standard</option>
            <option value="PRO">🚀 Pro</option>
            <option value="PREMIUM">💎 Premium</option>
          </Select>
          <Select
            value={String(expiringWithin)}
            onChange={(e) => {
              setExpiringWithin(e.target.value ? Number(e.target.value) : '');
              setPage(1);
            }}
            className="md:col-span-3"
          >
            <option value="">Muddati tugashi</option>
            <option value="3">3 kun ichida</option>
            <option value="7">7 kun ichida</option>
            <option value="14">14 kun ichida</option>
            <option value="30">30 kun ichida</option>
          </Select>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left">
                <th className="py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                  Do'kon
                </th>
                <th className="py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                  Tarif
                </th>
                <th className="py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                  Summa
                </th>
                <th className="py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                  Tugaydi
                </th>
                <th className="py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {list.isLoading || !list.data ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-[var(--color-border)]">
                    <td colSpan={5} className="py-3 px-5">
                      <Skeleton className="h-10" />
                    </td>
                  </tr>
                ))
              ) : list.data.items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <p className="text-[var(--color-text-muted)] text-sm">Yozuvlar yo'q</p>
                  </td>
                </tr>
              ) : (
                list.data.items.map((sub) => {
                  const meta = TARIFF_META[sub.plan];
                  const daysLeft = sub.endsAt
                    ? dayjs(sub.endsAt).diff(dayjs(), 'day')
                    : null;
                  return (
                    <tr
                      key={sub.id}
                      className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors"
                    >
                      <td className="py-3 px-5">
                        <Link
                          href={`/tenants/${sub.tenant.id}`}
                          className="flex items-center gap-3"
                        >
                          {sub.tenant.logoUrl ? (
                            <img
                              src={sub.tenant.logoUrl}
                              alt=""
                              className="h-9 w-9 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] grid place-items-center text-white font-semibold text-xs">
                              {sub.tenant.shopName.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-[var(--color-text)]">
                              {sub.tenant.shopName}
                            </p>
                            <p className="text-xs text-[var(--color-text-muted)]">
                              {sub.tenant.ownerEmail}
                            </p>
                          </div>
                        </Link>
                      </td>
                      <td className="py-3 px-5">
                        <Badge
                          variant={
                            `tier-${sub.plan.toLowerCase()}` as
                              | 'tier-free'
                              | 'tier-standard'
                              | 'tier-pro'
                              | 'tier-premium'
                          }
                        >
                          {meta.icon} {meta.label}
                        </Badge>
                      </td>
                      <td className="py-3 px-5 text-sm tabular-nums">
                        {formatUzs(sub.amount)}
                      </td>
                      <td className="py-3 px-5 text-sm">
                        <p className="text-[var(--color-text)]">
                          {sub.endsAt ? formatDate(sub.endsAt) : 'Muddatsiz'}
                        </p>
                        {daysLeft !== null && (
                          <p
                            className={`text-[10px] mt-0.5 ${
                              daysLeft <= 7
                                ? 'text-[var(--color-warning)]'
                                : 'text-[var(--color-text-subtle)]'
                            }`}
                          >
                            {daysLeft >= 0 ? `${daysLeft} kun qoldi` : `${-daysLeft} kun o'tdi`}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-5">
                        <Badge variant={STATUS_BADGE[sub.status]}>
                          {STATUS_LABEL[sub.status]}
                        </Badge>
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
