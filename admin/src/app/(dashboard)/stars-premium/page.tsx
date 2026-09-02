'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Lock, ArrowRight, Star, Crown, Trash2, Info } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import {
  apiMyStore,
  apiDigitalCatalog,
  apiDigitalOffers,
  apiUpsertDigitalOffer,
  apiDeleteDigitalOffer,
  apiUpdateDigitalSettings,
  apiDigitalOrders,
} from '@/lib/endpoints';
import type { DigitalKind, DigitalOffer, DigitalProduct } from '@/lib/types';
import { formatMoney, formatDateTime } from '@/lib/format';
import { toast } from '@/stores/toast-store';
import { formatMoneyInput, parseMoneyInput } from '../settings/_shared';

/**
 * Stars / Premium sotish — PULLIK funksiya.
 *  • Free tarif  → yoqib bo'lmaydi, tariflar sahifasiga yo'naltiriladi.
 *  • Pullik tarif → funksiyani yoqish + har paketga RETAIL narx qo'yish.
 *
 * Narx qo'yilmagan paket mijoz do'konida umuman ko'rinmaydi (backend
 * `DigitalOffer` bo'yicha filtrlaydi), shuning uchun "yoqdim, lekin
 * ko'rinmayapti" holatini sahifaning o'zi ogohlantirib turadi.
 */
export default function StarsPremiumPage() {
  const qc = useQueryClient();
  const { data: store } = useQuery({ queryKey: ['my-store'], queryFn: apiMyStore });
  const loaded = store !== undefined;
  const isPaid = store?.tenant?.trial?.state === 'PAID';

  const { data: catalog, isLoading: catalogLoading } = useQuery({
    queryKey: ['digital', 'catalog'],
    queryFn: apiDigitalCatalog,
    enabled: !!isPaid,
  });
  const { data: offers } = useQuery({
    queryKey: ['digital', 'offers'],
    queryFn: apiDigitalOffers,
    enabled: !!isPaid,
  });
  const { data: orders } = useQuery({
    queryKey: ['digital', 'orders'],
    queryFn: apiDigitalOrders,
    enabled: !!isPaid,
  });

  const starsOn = !!store?.tenant?.starsEnabled;
  const premiumOn = !!store?.tenant?.premiumEnabled;

  const settings = useMutation({
    mutationFn: apiUpdateDigitalSettings,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-store'] });
      toast.success('Saqlandi');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!loaded) return <Skeleton className="h-56 rounded-2xl" />;

  if (!isPaid) {
    return (
      <div>
        <PageHeader title="Stars / Premium" description="Telegram Stars va Premium sotish" />
        <Card>
          <div className="mx-auto max-w-md p-8 text-center">
            <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
              <Lock size={30} />
            </span>
            <h2 className="text-lg font-bold">Stars / Premium — pullik funksiya</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
              Telegram Stars va Premium sotishni yoqish uchun <b>STANDARD</b> yoki{' '}
              <b>PREMIUM</b> tarif kerak. Free tarifda bu funksiya mavjud emas.
            </p>
            <Link
              href="/settings/tariff"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white transition-opacity active:opacity-90"
            >
              Tariflarni ko&apos;rish <ArrowRight size={16} />
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const offerOf = (productId: string): DigitalOffer | undefined =>
    offers?.find((o) => o.digitalProductId === productId);

  const byKind = (kind: DigitalKind): DigitalProduct[] =>
    (catalog ?? []).filter((p) => p.kind === kind);

  const pricedCount = (kind: DigitalKind) => byKind(kind).filter((p) => offerOf(p.id)).length;

  return (
    <div className="space-y-4">
      <PageHeader title="Stars / Premium" description="Telegram Stars va Premium sotish" />

      {/* ── Yoqish/o'chirish ── */}
      <Card>
        <CardHeader
          title="Sotuvni yoqish"
          subtitle="O'chirilgan xizmat mijoz do'konida ko'rinmaydi"
        />
        <CardBody className="space-y-1 p-2">
          <ToggleRow
            icon={<Star size={18} className="text-amber-500" />}
            title="Telegram Stars"
            subtitle={`${pricedCount('STARS')} / ${byKind('STARS').length} paketga narx qo'yilgan`}
            on={starsOn}
            pending={settings.isPending}
            onChange={(v) => settings.mutate({ starsEnabled: v })}
          />
          <ToggleRow
            icon={<Crown size={18} className="text-indigo-500" />}
            title="Telegram Premium"
            subtitle={`${pricedCount('PREMIUM')} / ${byKind('PREMIUM').length} rejaga narx qo'yilgan`}
            on={premiumOn}
            pending={settings.isPending}
            onChange={(v) => settings.mutate({ premiumEnabled: v })}
          />
        </CardBody>
      </Card>

      {/* Yoqilgan, lekin narx yo'q — mijoz hech narsa ko'rmaydi */}
      {((starsOn && pricedCount('STARS') === 0) ||
        (premiumOn && pricedCount('PREMIUM') === 0)) && (
        <div className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5">
          <Info size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <p className="text-xs leading-relaxed text-amber-800">
            Xizmat yoqilgan, lekin biror paketga <b>retail narx qo&apos;yilmagan</b> — mijoz
            do&apos;konda hech narsa ko&apos;rmaydi. Quyidan narx qo&apos;ying.
          </p>
        </div>
      )}

      {/* ── Narxlar ── */}
      {catalogLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (
        <>
          <PriceList title="Stars paketlari" products={byKind('STARS')} offerOf={offerOf} />
          <PriceList title="Premium rejalari" products={byKind('PREMIUM')} offerOf={offerOf} />
        </>
      )}

      {/* ── Buyurtmalar ── */}
      <Card>
        <CardHeader title="Oxirgi buyurtmalar" subtitle="Mijozlar sotib olgan Stars/Premium" />
        {!orders?.length ? (
          <CardBody>
            <EmptyState title="Hali buyurtma yo'q" />
          </CardBody>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {orders.slice(0, 15).map((o) => (
              <li key={o.id} className="flex items-center gap-3 px-4 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--color-bg)]">
                  {o.kind === 'STARS' ? (
                    <Star size={16} className="text-amber-500" />
                  ) : (
                    <Crown size={16} className="text-indigo-500" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{o.digitalProduct.label}</p>
                  <p className="truncate text-xs text-[var(--color-text-muted)]">
                    @{o.username ?? '—'} · {formatDateTime(o.createdAt)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums">{formatMoney(o.retailPrice)}</p>
                  <Badge
                    tone={
                      o.status === 'FULFILLED' ? 'green' : o.status === 'CANCELLED' ? 'red' : 'amber'
                    }
                  >
                    {o.status === 'FULFILLED'
                      ? 'Yetkazildi'
                      : o.status === 'CANCELLED'
                        ? 'Bekor'
                        : 'Kutilmoqda'}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ToggleRow({
  icon,
  title,
  subtitle,
  on,
  pending,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  on: boolean;
  pending: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2.5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--color-bg)]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-[var(--color-text-muted)]">{subtitle}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={title}
        disabled={pending}
        onClick={() => onChange(!on)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
          on ? 'bg-[var(--color-primary)]' : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            on ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  );
}

function PriceList({
  title,
  products,
  offerOf,
}: {
  title: string;
  products: DigitalProduct[];
  offerOf: (id: string) => DigitalOffer | undefined;
}) {
  if (!products.length) return null;
  return (
    <Card>
      <CardHeader title={title} subtitle="Tan narxi ustiga o'z ustamangizni qo'ying" />
      <ul className="divide-y divide-[var(--color-border)]">
        {products.map((p) => (
          <PriceRow key={p.id} product={p} offer={offerOf(p.id)} />
        ))}
      </ul>
    </Card>
  );
}

function PriceRow({ product, offer }: { product: DigitalProduct; offer?: DigitalOffer }) {
  const qc = useQueryClient();
  const saved = offer ? Number(offer.retailPrice) : 0;
  const [text, setText] = useState(() => formatMoneyInput(saved));
  const price = parseMoneyInput(text);
  const dirty = price !== saved;
  const profit = price > 0 ? price - product.wholesaleUzs : null;

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['digital', 'offers'] });
  };

  const save = useMutation({
    mutationFn: () => apiUpsertDigitalOffer({ digitalProductId: product.id, retailPrice: price }),
    onSuccess: () => {
      refresh();
      toast.success('Narx saqlandi');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => apiDeleteDigitalOffer(offer?.id ?? ''),
    onSuccess: () => {
      setText('');
      refresh();
      toast.success("Do'kondan olib tashlandi");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{product.label}</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            Tan narxi: {formatMoney(product.wholesaleUzs)}
          </p>
        </div>
        <div className="w-36 shrink-0">
          <Input
            inputMode="numeric"
            value={text}
            onChange={(e) => setText(formatMoneyInput(parseMoneyInput(e.target.value)))}
            placeholder="Retail narx"
            className="h-10 text-right"
            aria-label={`${product.label} retail narxi`}
          />
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        {profit !== null && (
          <span
            className={`text-xs font-semibold ${
              profit >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
            }`}
          >
            {profit >= 0
              ? `Foyda: +${formatMoney(profit)}`
              : `Zarar: ${formatMoney(profit)} — tan narxdan past`}
          </span>
        )}
        {!offer && !dirty && (
          <span className="text-xs text-[var(--color-text-muted)]">Do&apos;konda yo&apos;q</span>
        )}
        <span className="flex-1" />
        {offer && (
          <Button
            variant="ghost"
            size="sm"
            loading={remove.isPending}
            onClick={() => remove.mutate()}
            aria-label="Olib tashlash"
          >
            <Trash2 size={15} />
          </Button>
        )}
        <Button
          size="sm"
          disabled={!dirty || price <= 0}
          loading={save.isPending}
          onClick={() => save.mutate()}
        >
          Saqlash
        </Button>
      </div>
    </li>
  );
}
