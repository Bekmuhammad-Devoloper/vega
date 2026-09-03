'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Coins,
  Lock,
  ArrowRight,
  Info,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import {
  apiMyStore,
  apiCryptoNetworks,
  apiCryptoOffers,
  apiUpsertCryptoOffer,
  apiUpdateCryptoSettings,
  apiCryptoOrders,
  apiFulfillCryptoOrder,
  apiCancelCryptoOrder,
} from '@/lib/endpoints';
import type { CryptoAsset, CryptoOffer, CryptoOrder } from '@/lib/types';
import { formatMoney, formatDateTime } from '@/lib/format';
import { toast } from '@/stores/toast-store';
import { formatMoneyInput, parseMoneyInput } from '../settings/_shared';

const ASSETS: CryptoAsset[] = ['TON', 'USDT'];

/**
 * TON / USDT sotish — PULLIK funksiya, yetkazish QO'LDA.
 *
 * Stars/Premium'dan farqi: tayyor paket yo'q. Sotuvchi 1 birlik narxini va
 * chegaralarni belgilaydi, mijoz esa istagan miqdorni kiritadi. Buyurtma
 * PENDING bo'lib turadi — sotuvchi kriptoni yuborib, tx hash bilan yopadi.
 */
export default function CryptoPage() {
  const qc = useQueryClient();
  const { data: store } = useQuery({ queryKey: ['my-store'], queryFn: apiMyStore });
  const loaded = store !== undefined;
  const isPaid = store?.tenant?.trial?.state === 'PAID';
  const enabled = !!store?.tenant?.cryptoEnabled;

  const { data: networks } = useQuery({
    queryKey: ['crypto', 'networks'],
    queryFn: apiCryptoNetworks,
    enabled: !!isPaid,
  });
  const { data: offers, isLoading: offersLoading } = useQuery({
    queryKey: ['crypto', 'offers'],
    queryFn: apiCryptoOffers,
    enabled: !!isPaid,
  });
  const { data: orders } = useQuery({
    queryKey: ['crypto', 'orders'],
    queryFn: apiCryptoOrders,
    enabled: !!isPaid,
  });

  const settings = useMutation({
    mutationFn: apiUpdateCryptoSettings,
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
        <PageHeader title="Kripto" description="TON va USDT sotish" />
        <Card>
          <div className="mx-auto max-w-md p-8 text-center">
            <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
              <Lock size={30} />
            </span>
            <h2 className="text-lg font-bold">Kripto sotish — pullik funksiya</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
              TON va USDT sotishni yoqish uchun <b>STANDARD</b> yoki <b>PREMIUM</b>{' '}
              tarif kerak.
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

  const offerOf = (a: CryptoAsset) => offers?.find((o) => o.asset === a);
  const pending = orders?.filter((o) => o.status === 'PENDING') ?? [];

  return (
    <div className="space-y-4">
      <PageHeader title="Kripto" description="TON va USDT sotish — qo'lda yetkaziladi" />

      {/* ── Yoqish ── */}
      <Card>
        <CardHeader
          title="Sotuvni yoqish"
          subtitle="O'chirilgan bo'lsa mijoz do'konda kripto bo'limini ko'rmaydi"
        />
        <CardBody>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--color-bg)]">
              <Coins size={18} className="text-amber-500" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">TON / USDT</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {offers?.length
                  ? `${offers.length} ta aktivga narx qo'yilgan`
                  : "Hali narx qo'yilmagan"}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label="Kripto sotuvi"
              disabled={settings.isPending}
              onClick={() => settings.mutate({ cryptoEnabled: !enabled })}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                enabled ? 'bg-[var(--color-primary)]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  enabled ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>
        </CardBody>
      </Card>

      {enabled && !offers?.length && (
        <div className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5">
          <Info size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <p className="text-xs leading-relaxed text-amber-800">
            Sotuv yoqilgan, lekin biror aktivga <b>narx qo&apos;yilmagan</b> — mijoz
            do&apos;konda hech narsa ko&apos;rmaydi.
          </p>
        </div>
      )}

      {/* ── Narxlar ── */}
      {offersLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (
        ASSETS.map((asset) => (
          <AssetCard
            key={asset}
            asset={asset}
            offer={offerOf(asset)}
            allNetworks={networks?.[asset] ?? []}
          />
        ))
      )}

      {/* ── Buyurtmalar ── */}
      <Card>
        <CardHeader
          title="Buyurtmalar"
          subtitle={
            pending.length
              ? `${pending.length} ta buyurtma yuborilishini kutmoqda`
              : 'Kutilayotgan buyurtma yo‘q'
          }
        />
        {!orders?.length ? (
          <CardBody>
            <EmptyState title="Hali buyurtma yo'q" />
          </CardBody>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {orders.slice(0, 20).map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** Bitta aktiv (TON yoki USDT) uchun narx va chegaralar. */
function AssetCard({
  asset,
  offer,
  allNetworks,
}: {
  asset: CryptoAsset;
  offer?: CryptoOffer;
  allNetworks: string[];
}) {
  const qc = useQueryClient();
  const [price, setPrice] = useState(() =>
    offer ? formatMoneyInput(Number(offer.pricePerUnit)) : '',
  );
  const [min, setMin] = useState(() => (offer ? String(Number(offer.minAmount)) : ''));
  const [max, setMax] = useState(() => (offer ? String(Number(offer.maxAmount)) : ''));
  const [nets, setNets] = useState<string[]>(() => offer?.networks ?? []);

  const priceNum = parseMoneyInput(price);
  const minNum = Number(min.replace(',', '.'));
  const maxNum = Number(max.replace(',', '.'));

  const valid =
    priceNum > 0 &&
    Number.isFinite(minNum) &&
    Number.isFinite(maxNum) &&
    minNum > 0 &&
    maxNum >= minNum &&
    nets.length > 0;

  const save = useMutation({
    mutationFn: () =>
      apiUpsertCryptoOffer({
        asset,
        pricePerUnit: priceNum,
        minAmount: minNum,
        maxAmount: maxNum,
        networks: nets,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['crypto', 'offers'] });
      toast.success('Saqlandi');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleNet = (n: string) =>
    setNets((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n]));

  return (
    <Card>
      <CardHeader
        title={asset}
        subtitle={`1 ${asset} uchun mijoz to'laydigan narx`}
        action={
          offer ? (
            <Badge tone="green">Sotuvda</Badge>
          ) : (
            <Badge tone="gray">Qo&apos;yilmagan</Badge>
          )
        }
      />
      <CardBody className="space-y-3">
        <Field label={`1 ${asset} narxi (so'm)`}>
          <Input
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(formatMoneyInput(parseMoneyInput(e.target.value)))}
            placeholder="45 000"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={`Eng kam (${asset})`}>
            <Input
              inputMode="decimal"
              value={min}
              onChange={(e) => setMin(e.target.value)}
              placeholder={asset === 'TON' ? '0.5' : '5'}
            />
          </Field>
          <Field label={`Eng ko'p (${asset})`}>
            <Input
              inputMode="decimal"
              value={max}
              onChange={(e) => setMax(e.target.value)}
              placeholder={asset === 'TON' ? '100' : '1000'}
            />
          </Field>
        </div>

        <Field
          label="Tarmoqlar"
          hint="Mijoz shulardan tanlaydi. Noto'g'ri tarmoqqa yuborilgan kripto qaytmaydi."
        >
          <div className="flex flex-wrap gap-2">
            {allNetworks.map((n) => {
              const on = nets.includes(n);
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => toggleNet(n)}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                    on
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                      : 'border-[var(--color-border)] bg-white text-[var(--color-text-muted)]'
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </Field>

        {priceNum > 0 && minNum > 0 && (
          <p className="text-xs text-[var(--color-text-muted)]">
            Eng kichik buyurtma: {minNum} {asset} ={' '}
            <b className="text-[var(--color-text)]">
              {formatMoney(Math.round((priceNum * minNum) / 100) * 100)}
            </b>
          </p>
        )}

        <Button fullWidth disabled={!valid} loading={save.isPending} onClick={() => save.mutate()}>
          Saqlash
        </Button>
      </CardBody>
    </Card>
  );
}

/** Buyurtma qatori — manzilni nusxalash + yuborildi/bekor. */
function OrderRow({ order: o }: { order: CryptoOrder }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tx, setTx] = useState('');
  const [copied, setCopied] = useState(false);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['crypto', 'orders'] });
  };

  const fulfill = useMutation({
    mutationFn: () => apiFulfillCryptoOrder(o.id, { txHash: tx.trim() || undefined }),
    onSuccess: () => {
      refresh();
      setOpen(false);
      toast.success('Yuborildi deb belgilandi');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: () => apiCancelCryptoOrder(o.id, {}),
    onSuccess: () => {
      refresh();
      toast.success('Bekor qilindi — pul mijozga qaytdi');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(o.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Nusxalanmadi');
    }
  };

  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--color-bg)]">
          <Coins size={16} className="text-amber-500" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {Number(o.amount)} {o.asset}{' '}
            <span className="font-normal text-[var(--color-text-muted)]">· {o.network}</span>
          </p>
          <p className="truncate text-xs text-[var(--color-text-muted)]">
            @{o.user?.username ?? '—'} · {formatDateTime(o.createdAt)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums">{formatMoney(o.totalPrice)}</p>
          <Badge
            tone={o.status === 'FULFILLED' ? 'green' : o.status === 'CANCELLED' ? 'red' : 'amber'}
          >
            {o.status === 'FULFILLED'
              ? 'Yuborildi'
              : o.status === 'CANCELLED'
                ? 'Bekor'
                : 'Kutilmoqda'}
          </Badge>
        </div>
      </div>

      {/* Manzil — nusxalash uchun to'liq ko'rinadi */}
      <div className="mt-2 flex items-center gap-2 rounded-xl bg-[var(--color-bg)] px-3 py-2">
        <code className="min-w-0 flex-1 break-all text-[11px] leading-snug">{o.address}</code>
        <button
          type="button"
          onClick={copy}
          aria-label="Manzilni nusxalash"
          className="shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          {copied ? <Check size={15} className="text-[var(--color-success)]" /> : <Copy size={15} />}
        </button>
      </div>
      {o.memo && (
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          Memo/Tag: <code className="text-[var(--color-text)]">{o.memo}</code>
        </p>
      )}

      {o.status === 'PENDING' && (
        <>
          <div className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-amber-700">
            <AlertTriangle size={13} className="mt-px shrink-0" />
            <span>
              Yuborishdan oldin tarmoqni tekshiring — <b>{o.network}</b>. Boshqa tarmoqqa
              yuborilgan mablag&apos; qaytmaydi.
            </span>
          </div>
          {!open ? (
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => setOpen(true)}>
                Yuborildi
              </Button>
              <Button
                size="sm"
                variant="secondary"
                loading={cancel.isPending}
                onClick={() => cancel.mutate()}
              >
                Bekor qilish
              </Button>
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              <Input
                value={tx}
                onChange={(e) => setTx(e.target.value)}
                placeholder="Tranzaksiya hash (ixtiyoriy)"
                className="h-10"
              />
              <div className="flex gap-2">
                <Button size="sm" loading={fulfill.isPending} onClick={() => fulfill.mutate()}>
                  Tasdiqlash
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                  Bekor
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {o.txHash && (
        <p className="mt-1 truncate text-xs text-[var(--color-text-muted)]">
          tx: <code className="text-[var(--color-text)]">{o.txHash}</code>
        </p>
      )}
    </li>
  );
}
