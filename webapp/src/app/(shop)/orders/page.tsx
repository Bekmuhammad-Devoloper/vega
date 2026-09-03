'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Smartphone, Star, Crown, Sparkles, Coins } from 'lucide-react';
import { PageHeader } from '@/components/shop/page-header';
import { OrderStatusBadge } from '@/components/shop/order-status-badge';
import { DigitalStatusBadge } from '@/components/shop/digital-status-badge';
import { apiListCryptoOrders } from '@/lib/api/endpoints';
import { CountryFlag } from '@/components/country-flag';
import { ServiceIcon } from '@/components/service-icon';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { apiListNumberOrders, apiListDigitalOrders } from '@/lib/api/endpoints';
import { useTrackOnMount } from '@/hooks/use-track';
import { useTelegramBackButton } from '@/hooks/use-telegram';
import { useLocaleStore } from '@/stores/locale-store';
import { getMessages, tr } from '@/i18n';
import { formatMoney, formatDateTime } from '@/lib/format';
import type { NumberOrderStatus } from '@/lib/api/types';
import { cn } from '@/lib/cn';

type Section = 'numbers' | 'digital' | 'crypto';

type TabKey = 'active' | 'done' | 'other';
const TAB_STATUSES: Record<TabKey, NumberOrderStatus[]> = {
  active: ['WAITING_CODE'],
  done: ['RECEIVED'],
  other: ['CANCELLED', 'EXPIRED', 'ERROR'],
};

export default function OrdersPage() {
  useTrackOnMount({ type: 'VIEW_ORDERS' });
  useTelegramBackButton();
  const locale = useLocaleStore((s) => s.locale);
  const messages = getMessages(locale);
  const [section, setSection] = useState<Section>('numbers');

  return (
    <div>
      <PageHeader title={tr(messages, 'order.title')} backHref="/" />

      {/* ── Bo'lim tanlash: bitta segmented control ──
          Uchta tab alohida tugma bo'lganda uzun yorliq ("Stars / Premium")
          ikki qatorga tushib, uchinchisi ekrandan chiqib ketardi. Endi
          yorliqlar qisqa, segmentlar teng va matn hech qachon sinmaydi. */}
      <div className="px-4 pt-3">
        <div className="flex gap-1 rounded-2xl border border-[var(--color-border)] bg-white p-1">
          <SectionTab
            active={section === 'numbers'}
            onClick={() => setSection('numbers')}
            icon={<Smartphone size={14} />}
            label={tr(messages, 'digital.sectionNumbers')}
          />
          <SectionTab
            active={section === 'digital'}
            onClick={() => setSection('digital')}
            icon={<Sparkles size={14} />}
            label={tr(messages, 'digital.sectionDigitalShort')}
          />
          <SectionTab
            active={section === 'crypto'}
            onClick={() => setSection('crypto')}
            icon={<Coins size={14} />}
            label={tr(messages, 'digital.sectionCrypto')}
          />
        </div>
      </div>

      {section === 'numbers' ? (
        <NumberOrders />
      ) : section === 'digital' ? (
        <DigitalOrders />
      ) : (
        <CryptoOrders />
      )}
    </div>
  );
}

function SectionTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        // min-w-0 + truncate: uzun yorliq segmentni kengaytirib yubormasin
        'flex-1 min-w-0 h-9 rounded-xl text-[13px] font-semibold',
        'inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors',
        active
          ? 'bg-[var(--color-primary)] text-white'
          : 'text-[var(--color-text-muted)] active:bg-[var(--color-bg)]',
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function NumberOrders() {
  const locale = useLocaleStore((s) => s.locale);
  const messages = getMessages(locale);
  const [tab, setTab] = useState<TabKey>('active');

  const { data, isLoading } = useQuery({
    queryKey: ['number-orders'],
    queryFn: apiListNumberOrders,
    refetchInterval: 8000,
  });

  const items = (data ?? []).filter((o) => TAB_STATUSES[tab].includes(o.status));

  return (
    <>
      <div className="flex gap-2 px-4 py-3">
        {(Object.keys(TAB_STATUSES) as TabKey[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'h-9 px-4 rounded-full text-sm font-medium',
              tab === t
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-white text-[var(--color-text-muted)] border border-[var(--color-border)]',
            )}
          >
            {tr(messages, `order.tabs.${t}`)}
          </button>
        ))}
      </div>

      <div className="px-4 space-y-3 pb-6">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : items.length === 0 ? (
          <EmptyState icon={<Smartphone size={48} />} title={tr(messages, 'order.empty')} />
        ) : (
          items.map((o) => (
            <Link
              key={o.id}
              href={`/orders/${o.id}`}
              className="block bg-white rounded-2xl border border-[var(--color-border)] p-3.5 active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <ServiceIcon slug={o.service.slug} emoji={o.service.emoji ?? '📱'} className="inline-block h-5 w-5 shrink-0 object-contain text-lg leading-none" />
                  <span className="font-semibold text-sm truncate">
                    {locale === 'ru' ? o.service.nameRu : o.service.nameUz}
                  </span>
                  <CountryFlag iso2={o.country.iso2} className="h-4 w-[22px] shrink-0 rounded-[3px] object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.1)]" />
                </div>
                <OrderStatusBadge status={o.status} locale={locale} />
              </div>
              <p className="font-mono text-sm font-semibold tracking-wide">{o.phone}</p>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs text-[var(--color-text-muted)]">
                  {formatDateTime(o.createdAt, locale)}
                </span>
                <span className="text-sm font-bold text-[var(--color-primary)]">
                  {formatMoney(o.retailPrice, locale)}
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </>
  );
}

function DigitalOrders() {
  const locale = useLocaleStore((s) => s.locale);
  const messages = getMessages(locale);

  const { data, isLoading } = useQuery({
    queryKey: ['digital-orders'],
    queryFn: apiListDigitalOrders,
    refetchInterval: 8000,
  });

  const items = data ?? [];

  return (
    <div className="px-4 space-y-3 pb-6 pt-3">
      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)
      ) : items.length === 0 ? (
        <EmptyState icon={<Sparkles size={48} />} title={tr(messages, 'digital.empty')} />
      ) : (
        items.map((o) => (
          <div
            key={o.id}
            className="block bg-white rounded-2xl border border-[var(--color-border)] p-3.5"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                {o.kind === 'STARS' ? (
                  <Star size={16} className="text-amber-500 shrink-0" fill="currentColor" />
                ) : (
                  <Crown
                    size={16}
                    className="text-[var(--color-primary)] shrink-0"
                    fill="currentColor"
                  />
                )}
                <span className="font-semibold text-sm truncate">{o.digitalProduct.label}</span>
              </div>
              <DigitalStatusBadge status={o.status} locale={locale} />
            </div>
            <p className="font-mono text-sm font-semibold tracking-wide text-[var(--color-text-muted)]">
              @{o.username}
            </p>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-xs text-[var(--color-text-muted)]">
                {formatDateTime(o.createdAt, locale)}
              </span>
              <span className="text-sm font-bold text-[var(--color-primary)]">
                {formatMoney(o.retailPrice, locale)}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/** Kripto buyurtmalari — qo'lda yetkaziladi, shuning uchun holat muhim. */
function CryptoOrders() {
  const locale = useLocaleStore((s) => s.locale);
  const messages = getMessages(locale);

  const { data, isLoading } = useQuery({
    queryKey: ['crypto-orders'],
    queryFn: apiListCryptoOrders,
    refetchInterval: 8000,
  });

  const items = data ?? [];

  return (
    <div className="px-4 space-y-3 pb-6 pt-3">
      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)
      ) : items.length === 0 ? (
        <EmptyState icon={<Coins size={48} />} title={tr(messages, 'digital.emptyCrypto')} />
      ) : (
        items.map((o) => (
          <div
            key={o.id}
            className="block rounded-2xl border border-[var(--color-border)] bg-white p-3.5"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="truncate text-sm font-semibold">
                {Number(o.amount)} {o.asset}
                <span className="ml-1.5 font-normal text-[var(--color-text-muted)]">
                  {o.network}
                </span>
              </span>
              <DigitalStatusBadge status={o.status} locale={locale} />
            </div>
            <p className="break-all font-mono text-[11px] leading-snug text-[var(--color-text-muted)]">
              {o.address}
            </p>
            {o.txHash && (
              <p className="mt-1 break-all font-mono text-[11px] leading-snug text-[var(--color-success)]">
                tx: {o.txHash}
              </p>
            )}
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-xs text-[var(--color-text-muted)]">
                {formatDateTime(o.createdAt, locale)}
              </span>
              <span className="text-sm font-bold text-[var(--color-primary)]">
                {formatMoney(o.totalPrice, locale)}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
