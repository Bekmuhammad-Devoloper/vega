'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Clock, Phone, Hash, KeyRound, User } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet } from '@/components/ui/sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { NumberStatusBadge, NUMBER_STATUS_LABEL } from '@/components/number-status-badge';
import { CountryFlag } from '@/components/country-flag';
import { ServiceIcon } from '@/components/service-icon';
import { apiListNumbers } from '@/lib/endpoints';
import { formatDateTime, formatMoney } from '@/lib/format';
import type { AdminNumberOrder, NumberOrderStatus, Money } from '@/lib/types';
import { cn } from '@/lib/cn';

const STATUSES: Array<NumberOrderStatus | 'all'> = [
  'all',
  'WAITING_CODE',
  'RECEIVED',
  'CANCELLED',
  'EXPIRED',
  'ERROR',
];

/** Foyda: backend bergan bo'lsa o'shani, aks holda retail − ulgurji dan hisoblaymiz. */
function calcProfit(o: AdminNumberOrder): number | null {
  if (o.profit !== undefined && o.profit !== null) return Number(o.profit);
  if (o.wholesalePrice !== undefined && o.wholesalePrice !== null) {
    return Number(o.retailPrice) - Number(o.wholesalePrice);
  }
  return null;
}

function money(v: Money | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—';
  return formatMoney(v);
}

export default function NumberOrdersPage() {
  const [status, setStatus] = useState<NumberOrderStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selected, setSelected] = useState<AdminNumberOrder | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['numbers', { status, q: debouncedSearch }],
    queryFn: () =>
      apiListNumbers({
        status: status === 'all' ? undefined : status,
        q: debouncedSearch || undefined,
        limit: 50,
      }),
  });

  const items: AdminNumberOrder[] = Array.isArray(data) ? data : (data?.items ?? []);

  return (
    <div>
      <PageHeader
        title="Raqam buyurtmalari"
        description="Mijozlar sotib olgan virtual raqamlar"
      />

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Raqam / order # qidirish"
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar -mx-4 px-4">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={cn(
              'h-9 px-3 rounded-full text-xs font-medium whitespace-nowrap border',
              status === s
                ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                : 'bg-white text-[var(--color-text-muted)] border-[var(--color-border)]',
            )}
          >
            {s === 'all' ? 'Hammasi' : NUMBER_STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState icon={Phone} title="Buyurtmalar yo'q" hint="Mijozlar raqam sotib olgach, bu yerda ko'rinadi." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map((o) => {
            const profit = calcProfit(o);
            return (
              <button
                key={o.id}
                onClick={() => setSelected(o)}
                className="group flex flex-col text-left bg-white rounded-2xl border border-[var(--color-border)] p-4 hover:border-[var(--color-primary)] hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-sm tracking-tight">
                    <Phone size={14} className="text-[var(--color-text-muted)]" />
                    {o.phone}
                  </span>
                  <NumberStatusBadge status={o.status} />
                </div>

                <div className="text-sm font-medium">
                  <ServiceIcon slug={o.service.slug} emoji={o.service.emoji} className="inline-block h-4 w-4 object-contain align-[-3px] mr-1" />
                  {o.service.nameUz}
                  <span className="text-[var(--color-text-muted)] font-normal">
                    {' · '}
                    <CountryFlag iso2={o.country.iso2} className="inline-block h-[13px] w-[18px] rounded-[2px] object-cover align-[-2px] mr-1 shadow-[0_0_0_1px_rgba(0,0,0,0.1)]" />
                    {o.country.nameUz}
                  </span>
                </div>

                {o.code && (
                  <div className="mt-2 inline-flex items-center gap-1.5 self-start rounded-lg bg-[var(--color-primary)]/10 px-2 py-1 font-mono text-sm font-bold text-[var(--color-primary)]">
                    <KeyRound size={13} />
                    {o.code}
                  </div>
                )}

                <div className="mt-auto pt-3 flex items-center justify-between border-t border-[var(--color-border)] mt-3">
                  <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                    <Clock size={13} />
                    {formatDateTime(o.createdAt)}
                  </span>
                  <div className="text-right">
                    <span className="block text-sm font-bold text-[var(--color-primary)]">{money(o.retailPrice)}</span>
                    {profit !== null && (
                      <span className="block text-xs font-semibold text-[var(--color-success)]">
                        +{formatMoney(profit)}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Sheet open={!!selected} onClose={() => setSelected(null)} title="Buyurtma tafsilotlari">
        {selected && (
          <div className="space-y-3 text-sm">
            <DetailRow icon={<Hash size={14} />} label="Order #" value={selected.orderNumber} mono />
            <DetailRow icon={<Phone size={14} />} label="Raqam" value={selected.phone} mono />
            <DetailRow
              label="Xizmat"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <ServiceIcon slug={selected.service.slug} emoji={selected.service.emoji} className="inline-block h-4 w-4 object-contain" />
                  {selected.service.nameUz}
                </span>
              }
            />
            <DetailRow
              label="Davlat"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <CountryFlag iso2={selected.country.iso2} />
                  {selected.country.nameUz}
                </span>
              }
            />
            <DetailRow label="Holat" value={<NumberStatusBadge status={selected.status} />} />
            {selected.code && <DetailRow icon={<KeyRound size={14} />} label="Kod" value={selected.code} mono />}
            {selected.smsText && <DetailRow label="SMS matni" value={selected.smsText} />}
            {selected.user && (
              <DetailRow
                icon={<User size={14} />}
                label="Mijoz"
                value={
                  selected.user.username
                    ? `@${selected.user.username}`
                    : (selected.user.firstName ?? selected.user.telegramId)
                }
              />
            )}
            <div className="border-t border-[var(--color-border)] pt-3 space-y-2">
              <DetailRow label="Retail narx" value={money(selected.retailPrice)} />
              {selected.wholesalePrice != null && (
                <DetailRow label="Ulgurji narx" value={money(selected.wholesalePrice)} />
              )}
              {calcProfit(selected) !== null && (
                <DetailRow
                  label="Foyda"
                  value={<span className="text-[var(--color-success)] font-semibold">+{formatMoney(calcProfit(selected)!)}</span>}
                />
              )}
            </div>
            <div className="border-t border-[var(--color-border)] pt-3 space-y-2">
              <DetailRow label="Yaratildi" value={formatDateTime(selected.createdAt)} />
              {selected.receivedAt && <DetailRow label="Kod olindi" value={formatDateTime(selected.receivedAt)} />}
              {selected.expiresAt && <DetailRow label="Amal qiladi" value={formatDateTime(selected.expiresAt)} />}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
  mono,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="inline-flex items-center gap-1.5 text-[var(--color-text-muted)] shrink-0">
        {icon}
        {label}
      </span>
      <span className={cn('font-medium text-right break-all', mono && 'font-mono')}>{value}</span>
    </div>
  );
}
