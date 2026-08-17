'use client';

import { useState, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Ban,
  Play,
  Crown,
  Calendar,
  Globe,
  Mail,
  Phone,
  Bot,
  Activity,
  CreditCard,
  Receipt,
  Wallet,
  Package,
  ShoppingBag,
  Settings,
  ExternalLink,
  ShieldOff,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { TariffChangeModal } from '@/components/tenants/tariff-change-modal';
import {
  apiFetchTenant,
  apiFetchTenantDetail,
  apiResumeTenant,
  apiSuspendTenant,
  type TenantDetail,
} from '@/lib/endpoints';
import type { TenantDto } from '@/lib/types';
import { STATUS_META, TARIFF_META, TARIFF_PRICE } from '@/lib/tariff';
import { formatDate, formatNumber, formatUzs } from '@/lib/format';
import { toast } from '@/stores/toast-store';
import { cn } from '@/lib/cn';

type Tab =
  | 'overview'
  | 'activity'
  | 'subscription'
  | 'billing'
  | 'wallet'
  | 'services'
  | 'orders'
  | 'settings';

const TABS: { id: Tab; label: string; icon: typeof Activity }[] = [
  { id: 'overview', label: 'Umumiy', icon: Activity },
  { id: 'activity', label: 'Faollik', icon: Activity },
  { id: 'subscription', label: 'Faollashtirish', icon: CreditCard },
  { id: 'billing', label: 'To\'lovlar', icon: Receipt },
  { id: 'wallet', label: 'Hamyon', icon: Wallet },
  { id: 'services', label: 'Xizmatlar', icon: Package },
  { id: 'orders', label: 'Buyurtmalar', icon: ShoppingBag },
  { id: 'settings', label: 'Sozlamalar', icon: Settings },
];

export default function TenantDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');
  const [tariffOpen, setTariffOpen] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);

  const tenantQuery = useQuery({
    queryKey: ['tenant', params.id],
    queryFn: () => apiFetchTenant(params.id),
    enabled: !!params.id,
  });

  const detailQuery = useQuery({
    queryKey: ['tenant-detail', params.id],
    queryFn: () => apiFetchTenantDetail(params.id),
    enabled: !!params.id,
  });

  const suspendMutation = useMutation({
    mutationFn: () => apiSuspendTenant(params.id, 'Manual suspension by admin'),
    onSuccess: () => {
      toast.success('Do\'kon to\'xtatildi');
      queryClient.invalidateQueries({ queryKey: ['tenant', params.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resumeMutation = useMutation({
    mutationFn: () => apiResumeTenant(params.id),
    onSuccess: () => {
      toast.success('Do\'kon qayta yoqildi');
      queryClient.invalidateQueries({ queryKey: ['tenant', params.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (tenantQuery.isLoading || !tenantQuery.data) {
    return (
      <>
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/tenants"
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            <ArrowLeft size={20} />
          </Link>
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-32 w-full mb-4" />
        <div className="grid grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </>
    );
  }

  const tenant = tenantQuery.data;
  const tariff = TARIFF_META[tenant.tariffPlan];
  const status = STATUS_META[tenant.status];
  const activationPrice = TARIFF_PRICE[tenant.tariffPlan];

  return (
    <>
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between mb-5">
        <Link
          href="/tenants"
          className="inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          <ArrowLeft size={16} />
          Do'konlar ro'yxati
        </Link>
        <div className="flex items-center gap-2">
          {tenant.status === 'ACTIVE' ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => suspendMutation.mutate()}
              loading={suspendMutation.isPending}
            >
              <Ban size={14} />
              To'xtatish
            </Button>
          ) : (
            <Button
              variant="success"
              size="sm"
              onClick={() => resumeMutation.mutate()}
              loading={resumeMutation.isPending}
            >
              <Play size={14} />
              Qayta yoqish
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={() => setTariffOpen(true)}>
            <Crown size={14} />
            Tarif o'zgartirish
          </Button>
          <Button variant="outline" size="sm" disabled title="Tez orada qo'shiladi">
            <ShieldOff size={14} />
            Impersonate
          </Button>
        </div>
      </div>

      {/* Hero card */}
      <Card className="mb-5 relative">
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-br from-[var(--color-primary)]/10 to-transparent pointer-events-none" />
        <CardBody className="relative">
          <div className="flex flex-col md:flex-row md:items-start gap-5">
            {tenant.logoUrl ? (
              <img
                src={tenant.logoUrl}
                alt=""
                className="h-20 w-20 rounded-2xl object-cover shadow-lg"
              />
            ) : (
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] grid place-items-center text-white text-2xl font-bold shadow-lg shrink-0">
                {tenant.shopName.slice(0, 1).toUpperCase()}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <h2 className="text-xl font-bold text-[var(--color-text)]">
                  {tenant.shopName}
                </h2>
                <Badge
                  variant={
                    (`tier-${tenant.tariffPlan.toLowerCase()}` as
                      | 'tier-free'
                      | 'tier-standard'
                      | 'tier-pro'
                      | 'tier-premium')
                  }
                >
                  {tariff.icon} {tariff.label}
                </Badge>
                <Badge
                  variant={
                    tenant.status === 'ACTIVE'
                      ? 'success'
                      : tenant.status === 'SUSPENDED'
                        ? 'danger'
                        : tenant.status === 'PENDING_PAYMENT'
                          ? 'warning'
                          : 'default'
                  }
                >
                  {status.label}
                </Badge>
                {!tenant.isActivated && (
                  <Badge variant="warning">Faollashtirilmagan</Badge>
                )}
                {tenant.isWhiteLabel && <Badge variant="info">White-label</Badge>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <Info icon={Mail} label="Egasi" value={tenant.ownerName} />
                <Info icon={Mail} label="Email" value={tenant.ownerEmail ?? '—'} />
                {tenant.ownerPhone && (
                  <Info icon={Phone} label="Telefon" value={tenant.ownerPhone} />
                )}
                <Info icon={Globe} label="Slug" value={tenant.slug} />
                {tenant.botUsername && (
                  <Info icon={Bot} label="Bot" value={`@${tenant.botUsername}`} />
                )}
                <Info
                  icon={Calendar}
                  label="Ro'yxatdan o'tgan"
                  value={formatDate(tenant.createdAt)}
                />
              </div>
            </div>

            {tenant.customDomain && (
              <a
                href={`https://${tenant.customDomain}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] transition-colors shrink-0"
              >
                <ExternalLink size={12} />
                {tenant.customDomain}
              </a>
            )}
          </div>
        </CardBody>
      </Card>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-5">
        <KpiCard
          label="Faollashtirish narxi"
          value={formatUzs(activationPrice)}
          icon={CreditCard}
          tone="success"
          index={0}
        />
        <KpiCard
          label="Jami foyda"
          value={formatUzs(tenant.totalRevenue)}
          icon={Receipt}
          tone="default"
          index={1}
        />
        <KpiCard
          label="Buyurtmalar"
          value={formatNumber(tenant.ordersCount)}
          icon={ShoppingBag}
          tone="default"
          index={2}
        />
        <KpiCard
          label="Hamyon balansi"
          value={formatUzs(tenant.walletBalance)}
          icon={Wallet}
          tone="primary"
          hint={tenant.isActivated ? 'Faollashtirilgan' : 'Faollashtirilmagan'}
          index={3}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--color-border)] mb-5 overflow-x-auto no-scrollbar">
        <div className="flex gap-1 min-w-max">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                tab === t.id
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
              )}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <Card>
        <CardHeader title={TABS.find((t) => t.id === tab)?.label ?? ''} />
        <CardBody>
          {detailQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !detailQuery.data ? (
            <EmptyTab text="Ma'lumot yuklab bo'lmadi" />
          ) : (
            <TabBody
              tab={tab}
              tenant={tenant}
              d={detailQuery.data}
              onReceipt={setReceipt}
            />
          )}
        </CardBody>
      </Card>

      <TariffChangeModal
        tenant={tariffOpen ? tenant : null}
        onClose={() => setTariffOpen(false)}
        onChanged={() => {
          setTariffOpen(false);
          queryClient.invalidateQueries({ queryKey: ['tenant', params.id] });
          queryClient.invalidateQueries({ queryKey: ['tenants'] });
        }}
      />

      {/* Chek rasmi (lightbox) */}
      {receipt && (
        <div
          className="fixed inset-0 z-[95] bg-black/85 backdrop-blur-sm grid place-items-center p-4"
          onClick={() => setReceipt(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={receipt}
            alt="chek"
            className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setReceipt(null)}
            className="absolute top-4 right-4 h-10 w-10 grid place-items-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25"
            aria-label="Yopish"
          >
            <X size={20} />
          </button>
        </div>
      )}
    </>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] min-w-0">
      <Icon size={14} className="text-[var(--color-text-subtle)] shrink-0" />
      <span className="text-[var(--color-text-subtle)]">{label}:</span>
      <span className="text-[var(--color-text)] truncate">{value}</span>
    </div>
  );
}

// ─── Detail tab'lari (haqiqiy do'kon ma'lumoti) ───────────────

function EmptyTab({ text }: { text: string }) {
  return (
    <div className="py-14 text-center text-sm text-[var(--color-text-muted)]">{text}</div>
  );
}

function KV({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-[var(--color-border)] last:border-0">
      <span className="text-sm text-[var(--color-text-muted)] shrink-0">{label}</span>
      <span className="text-sm font-medium text-[var(--color-text)] text-right min-w-0 truncate">
        {value === null || value === undefined || value === '' ? '—' : value}
      </span>
    </div>
  );
}

const STATUS_CLR: Record<string, string> = {
  RECEIVED: 'text-emerald-400',
  WAITING_CODE: 'text-amber-400',
  CANCELLED: 'text-rose-400',
  EXPIRED: 'text-rose-400',
  PAID: 'text-emerald-400',
  PENDING: 'text-amber-400',
  FAILED: 'text-rose-400',
  APPROVED: 'text-emerald-400',
  ACTIVE: 'text-emerald-400',
};

function TabBody({
  tab,
  tenant,
  d,
  onReceipt,
}: {
  tab: Tab;
  tenant: TenantDto;
  d: TenantDetail;
  onReceipt: (url: string) => void;
}) {
  if (tab === 'overview') {
    return (
      <div className="grid md:grid-cols-2 gap-x-8">
        <div>
          <KV label="Egasi" value={tenant.ownerName} />
          <KV label="Email" value={tenant.ownerEmail} />
          <KV label="Telefon" value={tenant.ownerPhone} />
          <KV label="Bot" value={tenant.botUsername ? `@${tenant.botUsername}` : null} />
          <KV label="Slug" value={tenant.slug} />
        </div>
        <div>
          <KV label="Mijozlar" value={formatNumber(d.customersCount)} />
          <KV label="Takliflar (xizmat)" value={formatNumber(d.offers.length)} />
          <KV label="Buyurtmalar" value={formatNumber(tenant.ordersCount)} />
          <KV label="Ro'yxatdan o'tgan" value={formatDate(tenant.createdAt)} />
          <KV label="Faollashtirilgan" value={d.activation.isActivated ? 'Ha' : "Yo'q"} />
        </div>
        {d.admins.length > 0 && (
          <div className="md:col-span-2 mt-4">
            <p className="text-[11px] uppercase tracking-wider text-[var(--color-text-subtle)] mb-2">
              Adminlar
            </p>
            {d.admins.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0 text-sm"
              >
                <span className="min-w-0 truncate">
                  {a.fullName}{' '}
                  <span className="text-[var(--color-text-subtle)]">· {a.email}</span>
                </span>
                <Badge variant="info">{a.role}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (tab === 'activity') {
    if (!d.events.length) return <EmptyTab text="Faollik yo'q" />;
    return (
      <div>
        {d.events.map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0 text-sm"
          >
            <span className="text-[var(--color-text)]">{e.type}</span>
            <span className="text-xs text-[var(--color-text-muted)]">
              {formatDate(e.createdAt)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (tab === 'subscription') {
    return (
      <div className="grid md:grid-cols-2 gap-x-8">
        <div>
          <KV
            label="Tarif"
            value={`${TARIFF_META[tenant.tariffPlan].icon} ${TARIFF_META[tenant.tariffPlan].label}`}
          />
          <KV label="Faollashtirilgan" value={d.activation.isActivated ? 'Ha' : "Yo'q"} />
          <KV
            label="To'langan sana"
            value={d.activation.activationPaidAt ? formatDate(d.activation.activationPaidAt) : null}
          />
          <KV
            label="Faollashtirish summasi"
            value={d.activation.activationAmount ? formatUzs(d.activation.activationAmount) : null}
          />
        </div>
        <div>
          {d.subscription ? (
            <>
              <KV label="Obuna reja" value={d.subscription.plan} />
              <KV label="Summa" value={formatUzs(d.subscription.amount)} />
              <KV label="Holat" value={d.subscription.status} />
              <KV label="Boshlangan" value={formatDate(d.subscription.startsAt)} />
              <KV
                label="Tugash"
                value={d.subscription.endsAt ? formatDate(d.subscription.endsAt) : 'Muddatsiz'}
              />
            </>
          ) : (
            <EmptyTab text="Obuna yozuvi yo'q" />
          )}
        </div>
      </div>
    );
  }

  if (tab === 'billing') {
    if (!d.invoices.length) return <EmptyTab text="To'lov yo'q" />;
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase text-[var(--color-text-subtle)]">
              <th className="py-2 pr-3">№</th>
              <th className="py-2 pr-3">Turi</th>
              <th className="py-2 pr-3">Holat</th>
              <th className="py-2 pr-3 text-right">Summa</th>
              <th className="py-2 text-right">Sana</th>
            </tr>
          </thead>
          <tbody>
            {d.invoices.map((i) => (
              <tr
                key={i.id}
                onClick={() => i.receiptUrl && onReceipt(i.receiptUrl)}
                className={cn(
                  'border-t border-[var(--color-border)]',
                  i.receiptUrl && 'cursor-pointer hover:bg-[var(--color-surface-hover)]',
                )}
              >
                <td className="py-2 pr-3 font-mono text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    {i.invoiceNumber}
                    {i.receiptUrl && (
                      <Receipt size={12} className="text-[var(--color-primary)]" />
                    )}
                  </span>
                </td>
                <td className="py-2 pr-3 text-xs">
                  {i.kind === 'WALLET_TOPUP' ? 'Hamyon' : 'Faollashtirish'}
                </td>
                <td className={cn('py-2 pr-3 font-medium', STATUS_CLR[i.status])}>{i.status}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{formatUzs(i.amount)}</td>
                <td className="py-2 text-right text-xs text-[var(--color-text-muted)]">
                  {formatDate(i.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (tab === 'wallet') {
    return (
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Wallet size={16} className="text-[var(--color-primary)]" />
          <span className="text-sm text-[var(--color-text-muted)]">Balans:</span>
          <span className="text-xl font-bold tabular-nums text-[var(--color-text)]">
            {formatUzs(tenant.walletBalance)}
          </span>
        </div>
        {!d.walletTransactions.length ? (
          <EmptyTab text="Tranzaksiya yo'q" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase text-[var(--color-text-subtle)]">
                  <th className="py-2 pr-3">Turi</th>
                  <th className="py-2 pr-3">Izoh</th>
                  <th className="py-2 pr-3 text-right">Summa</th>
                  <th className="py-2 pr-3 text-right">Qoldiq</th>
                  <th className="py-2 text-right">Sana</th>
                </tr>
              </thead>
              <tbody>
                {d.walletTransactions.map((w) => {
                  const credit = Number(w.amount) >= 0;
                  return (
                    <tr
                      key={w.id}
                      onClick={() => w.receiptUrl && onReceipt(w.receiptUrl)}
                      className={cn(
                        'border-t border-[var(--color-border)]',
                        w.receiptUrl && 'cursor-pointer hover:bg-[var(--color-surface-hover)]',
                      )}
                    >
                      <td className="py-2 pr-3 text-xs">
                        <span className="inline-flex items-center gap-1.5">
                          {w.type}
                          {w.receiptUrl && (
                            <Receipt size={12} className="text-[var(--color-primary)]" />
                          )}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-xs text-[var(--color-text-muted)] max-w-[160px] truncate">
                        {w.note ?? '—'}
                      </td>
                      <td
                        className={cn(
                          'py-2 pr-3 text-right tabular-nums',
                          credit ? 'text-emerald-400' : 'text-rose-400',
                        )}
                      >
                        {credit ? '+' : ''}
                        {formatUzs(w.amount)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-[var(--color-text-muted)]">
                        {formatUzs(w.balanceAfter)}
                      </td>
                      <td className="py-2 text-right text-xs text-[var(--color-text-muted)]">
                        {formatDate(w.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  if (tab === 'services') {
    if (!d.offers.length) return <EmptyTab text="Taklif yo'q" />;
    return (
      <div className="grid sm:grid-cols-2 gap-2">
        {d.offers.map((o) => (
          <div
            key={o.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--color-text)] truncate">{o.service}</p>
              <p className="text-xs text-[var(--color-text-muted)] truncate">{o.country}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold tabular-nums">{formatUzs(o.retailPrice)}</p>
              <p className={cn('text-[10px]', o.isActive ? 'text-emerald-400' : 'text-rose-400')}>
                {o.isActive ? 'Faol' : "O'chiq"}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tab === 'orders') {
    if (!d.orders.length) return <EmptyTab text="Buyurtma yo'q" />;
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase text-[var(--color-text-subtle)]">
              <th className="py-2 pr-3">Xizmat · Davlat</th>
              <th className="py-2 pr-3">Raqam</th>
              <th className="py-2 pr-3">Holat</th>
              <th className="py-2 pr-3 text-right">Narx</th>
              <th className="py-2 pr-3 text-right">Foyda</th>
              <th className="py-2 text-right">Sana</th>
            </tr>
          </thead>
          <tbody>
            {d.orders.map((o) => (
              <tr key={o.id} className="border-t border-[var(--color-border)]">
                <td className="py-2 pr-3">
                  {o.service} · {o.country}
                </td>
                <td className="py-2 pr-3 tabular-nums text-xs">{o.phone}</td>
                <td className={cn('py-2 pr-3 font-medium text-xs', STATUS_CLR[o.status])}>
                  {o.status}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{formatUzs(o.retailPrice)}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-emerald-400">
                  {formatUzs(o.profit)}
                </td>
                <td className="py-2 text-right text-xs text-[var(--color-text-muted)]">
                  {formatDate(o.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (tab === 'settings') {
    const s = d.settings;
    return (
      <div className="grid md:grid-cols-2 gap-x-8">
        <div>
          <KV label="Karta raqami" value={s.cardNumber} />
          <KV label="Karta egasi" value={s.cardHolder} />
          <KV label="To'lov kanali" value={s.paymentChannelId} />
          <KV label="Payme" value={s.payme ? 'Ulangan' : '—'} />
          <KV label="Click" value={s.click ? 'Ulangan' : '—'} />
        </div>
        <div>
          <KV label="Bot" value={s.botUsername ? `@${s.botUsername}` : null} />
          <KV label="Telefon" value={s.phone} />
          <KV label="Ish vaqti" value={s.workingHours} />
          <KV label="Brend rangi" value={s.primaryColor} />
          <KV label="Logo" value={s.logoUrl ? 'Bor' : "Yo'q"} />
        </div>
        {s.about && (
          <div className="md:col-span-2 mt-3">
            <p className="text-[11px] uppercase tracking-wider text-[var(--color-text-subtle)] mb-1">
              Tavsif
            </p>
            <p className="text-sm text-[var(--color-text)]">{s.about}</p>
          </div>
        )}
      </div>
    );
  }

  return <EmptyTab text="—" />;
}
