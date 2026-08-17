'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X, RefreshCw, Star, Crown, Store, AtSign } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  apiFetchDigitalOrders,
  apiFulfillDigitalOrder,
  apiCancelDigitalOrder,
} from '@/lib/endpoints';
import type { DigitalKind, DigitalOrderDto } from '@/lib/types';
import { formatUzs, formatDate } from '@/lib/format';
import { toast } from '@/stores/toast-store';

const KIND_META: Record<
  DigitalKind,
  { label: string; icon: typeof Star; variant: 'warning' | 'info' }
> = {
  STARS: { label: 'Stars', icon: Star, variant: 'warning' },
  PREMIUM: { label: 'Premium', icon: Crown, variant: 'info' },
};

export default function DigitalOrdersPage() {
  const orders = useQuery({ queryKey: ['digital-orders'], queryFn: apiFetchDigitalOrders });

  return (
    <>
      <PageHeader
        title="Stars / Premium yetkazish"
        subtitle="Kutilayotgan buyurtmalarni Fragment orqali qo'lda yetkazing"
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => orders.refetch()}
            loading={orders.isFetching}
          >
            <RefreshCw size={14} /> Yangilash
          </Button>
        }
      />

      <Card>
        <CardHeader
          title="Kutilayotgan buyurtmalar"
          subtitle="Fragment orqali sovg&apos;a qilib, keyin &laquo;Bajarildi&raquo; deb belgilang"
          action={
            orders.data?.length ? (
              <Badge variant="warning">{orders.data.length} ta</Badge>
            ) : undefined
          }
        />
        <CardBody className="space-y-2.5">
          {orders.isLoading ? (
            <div className="space-y-2.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
          ) : !orders.data?.length ? (
            <div className="py-12 text-center">
              <div className="text-3xl mb-2">✅</div>
              <p className="text-sm text-[var(--color-text-muted)]">
                Kutilayotgan buyurtmalar yo&apos;q
              </p>
            </div>
          ) : (
            orders.data.map((o) => <OrderRow key={o.id} order={o} />)
          )}
        </CardBody>
      </Card>
    </>
  );
}

function OrderRow({ order }: { order: DigitalOrderDto }) {
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const meta = KIND_META[order.kind];
  const Icon = meta.icon;

  const invalidate = () => qc.invalidateQueries({ queryKey: ['digital-orders'] });

  const fulfill = useMutation({
    mutationFn: () => apiFulfillDigitalOrder(order.id, note.trim() || undefined),
    onSuccess: () => {
      toast.success(`#${order.orderNumber} yetkazildi`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: () => apiCancelDigitalOrder(order.id, note.trim() || undefined),
    onSuccess: () => {
      toast.info(`#${order.orderNumber} bekor qilindi`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = fulfill.isPending || cancel.isPending;
  const target = order.username || order.user.username;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Chap: mahsulot va manzil */}
        <div className="min-w-0 flex items-start gap-3">
          <div
            className={`h-10 w-10 shrink-0 grid place-items-center rounded-xl ${
              order.kind === 'STARS'
                ? 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]'
                : 'bg-[var(--color-info)]/15 text-[var(--color-info)]'
            }`}
          >
            <Icon size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--color-text)]">
              {order.digitalProduct.label}
              <Badge variant={meta.variant} className="ml-2 align-middle">
                {meta.label}
              </Badge>
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs text-[var(--color-primary)] font-medium">
              <AtSign size={12} />
              {target ? target.replace(/^@/, '') : '—'}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
              <Store size={11} />
              {order.tenant.shopName}
              <span className="text-[var(--color-text-subtle)]">· #{order.orderNumber}</span>
              <span className="text-[var(--color-text-subtle)]">
                · {formatDate(order.createdAt, true)}
              </span>
            </p>
          </div>
        </div>

        {/* O'ng: narx */}
        <div className="text-right shrink-0">
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)]">
            Mijoz narxi
          </p>
          <p className="text-sm font-bold text-[var(--color-text)] tabular-nums">
            {formatUzs(order.retailPrice)}
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)] tabular-nums">
            tannarx {formatUzs(order.wholesalePrice)}
          </p>
        </div>
      </div>

      {/* Izoh + tugmalar */}
      <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Izoh (ixtiyoriy)"
          className="h-9 flex-1"
          disabled={busy}
        />
        <div className="flex gap-2 shrink-0">
          <Button
            size="sm"
            variant="success"
            onClick={() => fulfill.mutate()}
            loading={fulfill.isPending}
            disabled={busy}
          >
            <Check size={14} /> Bajarildi
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => cancel.mutate()}
            loading={cancel.isPending}
            disabled={busy}
          >
            <X size={14} /> Bekor
          </Button>
        </div>
      </div>
    </div>
  );
}
