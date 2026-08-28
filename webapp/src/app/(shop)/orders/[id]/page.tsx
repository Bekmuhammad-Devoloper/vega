'use client';

import { use, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Copy,
  Check,
  Loader2,
  Clock,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { PageHeader } from '@/components/shop/page-header';
import { OrderStatusBadge } from '@/components/shop/order-status-badge';
import { CountryFlag } from '@/components/country-flag';
import { ServiceIcon } from '@/components/service-icon';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiCancelNumberOrder, apiCheckNumberOrder } from '@/lib/api/endpoints';
import { useTrackOnMount } from '@/hooks/use-track';
import { useTelegramBackButton } from '@/hooks/use-telegram';
import { useLocaleStore } from '@/stores/locale-store';
import { getMessages, tr } from '@/i18n';
import { formatMoney, formatDateTime } from '@/lib/format';
import { haptic } from '@/lib/telegram';
import { toast } from '@/stores/toast-store';

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallthrough
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  useTrackOnMount({ type: 'VIEW_ORDER_DETAIL', payload: { orderId: id } });
  useTelegramBackButton();
  const locale = useLocaleStore((s) => s.locale);
  const messages = getMessages(locale);
  const qc = useQueryClient();

  const [copied, setCopied] = useState<'phone' | 'code' | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Live poll: check endpoint SMS kodni so'raydi; WAITING_CODE holatida har 4s.
  const { data: order, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['number-order', id],
    queryFn: () => apiCheckNumberOrder(id),
    refetchInterval: (q) => (q.state.data?.status === 'WAITING_CODE' ? 4000 : false),
    refetchOnMount: 'always',
    // Qisqa tarmoq uzilishi pollingni butunlay o'ldirmasin.
    retry: 2,
  });

  // 1s tik — countdown taymer uchun
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const cancel = useMutation({
    mutationFn: () => apiCancelNumberOrder(id),
    onSuccess: async (data) => {
      haptic('success');
      // Havoda turgan poll javobi (cancel'dan OLDIN boshlangan) keyinroq kelib
      // CANCELLED holatni eski WAITING_CODE bilan ustidan yozardi — mijoz
      // "bekor bo'lmadi" deb o'ylab, tugmani qayta bosardi. Avval in-flight
      // so'rovlarni bekor qilamiz, keyin yangi holatni yozamiz.
      await qc.cancelQueries({ queryKey: ['number-order', id] });
      qc.setQueryData(['number-order', id], data);
      qc.invalidateQueries({ queryKey: ['me'] });
      qc.invalidateQueries({ queryKey: ['number-orders'] });
      toast.success(tr(messages, 'order.status.CANCELLED'));
    },
    onError: (err: Error) => {
      haptic('error');
      toast.error(err.message);
    },
  });

  const doCopy = async (text: string, kind: 'phone' | 'code') => {
    const ok = await copyText(text);
    if (ok) {
      haptic('success');
      setCopied(kind);
      toast.success(tr(messages, 'order.copied'));
      setTimeout(() => setCopied((c) => (c === kind ? null : c)), 1500);
    } else {
      toast.error(tr(messages, 'common.error'));
    }
  };

  if (isLoading) {
    return (
      <div>
        <PageHeader title="..." backHref="/orders" />
        <div className="px-4 py-4 space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  if (isError || !order) {
    // Ilgari xato holatda ham skeleton ko'rsatilardi — mijoz pul yechilganini
    // bilmay ABADIY kulrang ekranga qarab o'tirardi, polling esa boshlanmasdi.
    return (
      <div>
        <PageHeader title={tr(messages, 'common.error')} backHref="/orders" />
        <div className="px-4 py-10 text-center">
          <AlertTriangle size={36} className="mx-auto mb-3 text-[var(--color-danger,#ef4444)]" />
          <p className="text-sm font-medium mb-1">{tr(messages, 'common.error')}</p>
          <p className="text-xs text-[var(--color-text-muted,#64748b)] mb-4">
            Buyurtma holatini yuklab bo&apos;lmadi. Internetni tekshirib qayta urining.
          </p>
          <Button onClick={() => refetch()} loading={isFetching}>
            {tr(messages, 'common.retry')}
          </Button>
        </div>
      </div>
    );
  }

  const serviceName = locale === 'ru' ? order.service.nameRu : order.service.nameUz;
  const countryName = locale === 'ru' ? order.country.nameRu : order.country.nameUz;
  const remainingMs = new Date(order.expiresAt).getTime() - now;
  const isWaiting = order.status === 'WAITING_CODE';
  const isReceived = order.status === 'RECEIVED';

  return (
    <div className="pb-24">
      <PageHeader title={`#${order.orderNumber}`} backHref="/orders" />

      {/* Xizmat / davlat sarlavhasi */}
      <section className="px-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <ServiceIcon slug={order.service.slug} emoji={order.service.emoji ?? '📱'} className="inline-block h-7 w-7 shrink-0 object-contain text-2xl leading-none" />
            <div className="min-w-0">
              <p className="font-bold text-sm truncate">{serviceName}</p>
              <p className="text-xs text-[var(--color-text-muted)] truncate">
                <CountryFlag iso2={order.country.iso2} className="inline-block h-4 w-[22px] rounded-[3px] object-cover align-[-3px] mr-1 shadow-[0_0_0_1px_rgba(0,0,0,0.1)]" /> {countryName}
              </p>
            </div>
          </div>
          <OrderStatusBadge status={order.status} locale={locale} />
        </div>
      </section>

      {/* Telefon raqami */}
      <section className="px-4 pt-4">
        <div className="bg-white rounded-2xl border border-[var(--color-border)] p-4">
          <p className="text-xs text-[var(--color-text-muted)] mb-1">
            {tr(messages, 'order.phone')}
          </p>
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-2xl font-extrabold tracking-wide">{order.phone}</p>
            <button
              onClick={() => doCopy(order.phone, 'phone')}
              className="h-10 w-10 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] grid place-items-center shrink-0 active:scale-95 transition-transform"
              aria-label={tr(messages, 'order.copy')}
            >
              {copied === 'phone' ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </div>
        </div>
      </section>

      {/* Holatga qarab asosiy blok */}
      <section className="px-4 pt-4">
        {isWaiting && (
          <div className="bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 rounded-2xl p-5 text-center">
            <Loader2 size={32} className="mx-auto text-[var(--color-primary)] animate-spin" />
            <p className="mt-3 font-semibold text-sm">{tr(messages, 'order.waitingTitle')}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {tr(messages, 'order.waitingHint')}
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-text)]">
              <Clock size={15} className="text-[var(--color-text-muted)]" />
              <span className="tabular-nums">{fmtCountdown(remainingMs)}</span>
            </div>
          </div>
        )}

        {isReceived && (
          <div className="bg-[var(--color-success)]/8 border border-[var(--color-success)]/25 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-[var(--color-success)] mb-3">
              <CheckCircle2 size={20} />
              <p className="font-semibold text-sm">{tr(messages, 'order.codeReceived')}</p>
            </div>
            <button
              onClick={() => order.code && doCopy(order.code, 'code')}
              className="w-full rounded-2xl bg-white border-2 border-dashed border-[var(--color-success)]/40 p-4 flex items-center justify-between gap-3 active:scale-[0.99] transition-transform"
            >
              <span className="font-mono text-3xl font-extrabold tracking-[0.15em] text-[var(--color-text)]">
                {order.code}
              </span>
              <span className="h-10 w-10 rounded-xl bg-[var(--color-success)]/15 text-[var(--color-success)] grid place-items-center shrink-0">
                {copied === 'code' ? <Check size={18} /> : <Copy size={18} />}
              </span>
            </button>
            {order.smsText && order.smsText !== order.code && (
              <p className="text-xs text-[var(--color-text-muted)] mt-3 whitespace-pre-line">
                {order.smsText}
              </p>
            )}
          </div>
        )}

        {(order.status === 'CANCELLED' || order.status === 'EXPIRED') && (
          <div className="bg-white border border-[var(--color-border)] rounded-2xl p-5 text-center">
            <XCircle size={28} className="mx-auto text-[var(--color-text-muted)]" />
            <p className="mt-2 text-sm font-medium">
              {tr(messages, `order.status.${order.status}`)}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {tr(messages, 'order.refunded')}
            </p>
          </div>
        )}

        {order.status === 'ERROR' && (
          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 text-center">
            <AlertTriangle size={28} className="mx-auto text-rose-500" />
            <p className="mt-2 text-sm font-medium text-rose-700">
              {tr(messages, 'order.status.ERROR')}
            </p>
          </div>
        )}
      </section>

      {/* Tafsilotlar */}
      <section className="px-4 pt-4 space-y-2 text-sm">
        <Row label={tr(messages, 'order.price')} value={formatMoney(order.retailPrice, locale)} />
        <Row label={tr(messages, 'order.date')} value={formatDateTime(order.createdAt, locale)} />
      </section>

      {/* Bekor qilish */}
      {isWaiting && (
        <div className="px-4 mt-5">
          <Button
            variant="secondary"
            fullWidth
            loading={cancel.isPending}
            onClick={() => cancel.mutate()}
          >
            {tr(messages, 'order.cancel')}
          </Button>
          <p className="text-center text-xs text-[var(--color-text-muted)] mt-2">
            {tr(messages, 'order.cancelHint')}
          </p>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
