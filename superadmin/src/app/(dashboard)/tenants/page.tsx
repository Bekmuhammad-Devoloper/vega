'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  Download,
  MoreHorizontal,
  ExternalLink,
  Ban,
  Play,
  Crown,
  Eye,
  Mail,
  Copy,
  Trash2,
  CheckSquare,
  Square,
  AlertTriangle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Dropdown, type DropdownItem } from '@/components/ui/dropdown';
import { CreateTenantModal } from '@/components/tenants/create-tenant-modal';
import { TariffChangeModal } from '@/components/tenants/tariff-change-modal';
import { SuspendModal } from '@/components/tenants/suspend-modal';
import {
  apiBulkTenants,
  apiDeleteTenant,
  apiExportTenants,
  apiFetchTenants,
  apiResumeTenant,
  type TenantListParams,
} from '@/lib/endpoints';
import type { TariffPlan, TenantDto, TenantStatus } from '@/lib/types';
import { STATUS_META, TARIFF_META } from '@/lib/tariff';
import { downloadCsv } from '@/lib/csv';
import {
  formatDate,
  formatNumber,
  formatRelative,
  formatUzs,
} from '@/lib/format';
import { toast } from '@/stores/toast-store';
import { cn } from '@/lib/cn';

const PAGE_SIZE = 25;

export default function TenantsPage() {
  const qc = useQueryClient();

  // Filters
  const [search, setSearch] = useState('');
  const [plan, setPlan] = useState<TariffPlan | ''>('');
  const [status, setStatus] = useState<TenantStatus | ''>('');
  const [sort, setSort] = useState<TenantListParams['sort']>('created');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [tariffTarget, setTariffTarget] = useState<TenantDto | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<TenantDto | null>(null);

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const list = useQuery({
    queryKey: ['tenants', search, plan, status, sort, order, page],
    queryFn: () =>
      apiFetchTenants({
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        plan: plan || undefined,
        status: status || undefined,
        sort,
        order,
      }),
    placeholderData: (prev) => prev,
  });

  const totalPages = list.data ? Math.ceil(list.data.total / PAGE_SIZE) : 0;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['tenants'] });
    qc.invalidateQueries({ queryKey: ['kpi'] });
    qc.invalidateQueries({ queryKey: ['tariff-distribution'] });
  };

  // ─── Bulk actions ─────────────────────────────────────
  const allOnPage = useMemo(() => list.data?.items.map((t) => t.id) ?? [], [list.data]);
  const allSelected = allOnPage.length > 0 && allOnPage.every((id) => selected.has(id));
  const someSelected = allOnPage.some((id) => selected.has(id));

  const toggleAll = () => {
    if (allSelected) {
      const next = new Set(selected);
      allOnPage.forEach((id) => next.delete(id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      allOnPage.forEach((id) => next.add(id));
      setSelected(next);
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const bulkMut = useMutation({
    mutationFn: (action: 'suspend' | 'resume' | 'delete') =>
      apiBulkTenants(Array.from(selected), action),
    onSuccess: (data, action) => {
      toast.success(
        `${data.updated} ta do'kon ${
          action === 'suspend' ? 'to\'xtatildi' : action === 'resume' ? 'qayta yoqildi' : "o'chirildi"
        }`,
      );
      setSelected(new Set());
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ─── Export ───────────────────────────────────────────
  const exportMut = useMutation({
    mutationFn: apiExportTenants,
    onSuccess: (data) => {
      downloadCsv(`tenants-${new Date().toISOString().slice(0, 10)}.csv`, data, [
        { key: 'shopName', label: "Do'kon nomi" },
        { key: 'slug', label: 'Slug' },
        { key: 'ownerName', label: 'Egasi' },
        { key: 'ownerEmail', label: 'Email' },
        { key: 'ownerPhone', label: 'Telefon' },
        { key: 'tariffPlan', label: 'Tarif' },
        { key: 'status', label: 'Status' },
        {
          key: 'totalRevenue',
          label: 'Jami daromad',
          format: (v) => String(Number(v ?? 0)),
        },
        { key: 'totalOrders', label: 'Buyurtmalar' },
        {
          key: 'walletBalance',
          label: 'Hamyon (UZS)',
          format: (v) => String(Number(v ?? 0)),
        },
        {
          key: 'isActivated',
          label: 'Faollashtirilgan',
          format: (v) => (v ? 'Ha' : "Yo'q"),
        },
        {
          key: 'customDomain',
          label: 'Custom domain',
        },
        {
          key: 'createdAt',
          label: 'Yaratilgan',
          format: (v) => (v ? new Date(String(v)).toISOString().slice(0, 10) : ''),
        },
      ]);
      toast.success(`${data.length} ta yozuv eksport qilindi`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Do'konlar"
        subtitle={
          list.data
            ? `Jami ${formatNumber(list.data.total)} ta do'kon platformada`
            : 'Yuklanmoqda...'
        }
        action={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => exportMut.mutate()}
              loading={exportMut.isPending}
            >
              <Download size={14} />
              Eksport
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus size={14} />
              Yangi do'kon
            </Button>
          </>
        }
      />

      {/* Filters */}
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
              placeholder="Nom, email, telefon yoki slug bo'yicha qidirish..."
              className="pl-10"
            />
          </div>
          <Select
            value={plan}
            onChange={(e) => {
              setPlan(e.target.value as TariffPlan | '');
              setPage(1);
            }}
            className="md:col-span-2"
          >
            <option value="">Barcha tariflar</option>
            <option value="FREE">🆓 Free</option>
            <option value="STANDARD">⭐ Standard</option>
            <option value="PRO">🚀 Pro</option>
            <option value="PREMIUM">💎 Premium</option>
          </Select>
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as TenantStatus | '');
              setPage(1);
            }}
            className="md:col-span-2"
          >
            <option value="">Barcha statuslar</option>
            <option value="ACTIVE">Faol</option>
            <option value="SUSPENDED">To'xtatilgan</option>
            <option value="PENDING_PAYMENT">To'lov kutilmoqda</option>
            <option value="CANCELLED">Bekor</option>
          </Select>
          <Select
            value={sort}
            onChange={(e) => setSort(e.target.value as TenantListParams['sort'])}
            className="md:col-span-2"
          >
            <option value="created">Yangi qo'shilgan</option>
            <option value="revenue">Daromad bo'yicha</option>
            <option value="activity">Oxirgi faollik</option>
            <option value="products">Buyurtmalar soni</option>
          </Select>
          <Button
            variant="outline"
            size="md"
            className="md:col-span-1"
            onClick={() => setOrder(order === 'asc' ? 'desc' : 'asc')}
            title={order === 'asc' ? "O'sish tartibida" : "Kamayish tartibida"}
          >
            {order === 'asc' ? '↑' : '↓'}
          </Button>
        </div>
      </Card>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="sticky top-2 z-20 mb-3 fade-in">
          <div className="glass-strong rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 shadow-lg shadow-indigo-500/10 border border-[var(--color-primary)]/30">
            <div className="flex items-center gap-2 text-sm">
              <CheckSquare size={16} className="text-[var(--color-primary)]" />
              <span className="text-[var(--color-text)] font-medium">
                {selected.size} ta tanlangan
              </span>
              <button
                onClick={() => setSelected(new Set())}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-xs ml-2"
              >
                Bekor
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => bulkMut.mutate('suspend')}
                loading={bulkMut.isPending}
              >
                <Ban size={12} />
                To'xtatish
              </Button>
              <Button
                size="sm"
                variant="success"
                onClick={() => bulkMut.mutate('resume')}
                loading={bulkMut.isPending}
              >
                <Play size={12} />
                Qayta yoqish
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  if (
                    confirm(
                      `${selected.size} ta do'kon O'CHIRILSINMI? Bu amal qaytarib bo'lmaydi.`,
                    )
                  ) {
                    bulkMut.mutate('delete');
                  }
                }}
                loading={bulkMut.isPending}
              >
                <Trash2 size={12} />
                O'chirish
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left">
                <th className="py-3 pl-5 pr-1 w-10">
                  <button
                    onClick={toggleAll}
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                  >
                    {allSelected ? (
                      <CheckSquare size={16} className="text-[var(--color-primary)]" />
                    ) : someSelected ? (
                      <CheckSquare size={16} className="text-[var(--color-primary)]/60" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>
                <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                  Do'kon
                </th>
                <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                  Tarif
                </th>
                <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                  Status
                </th>
                <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                  Daromad
                </th>
                <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                  Hamyon
                </th>
                <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                  Faollik
                </th>
                <th className="py-3 px-4 w-12" />
              </tr>
            </thead>
            <tbody>
              {list.isLoading || !list.data ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-[var(--color-border)]">
                    <td colSpan={8} className="py-3 px-4">
                      <Skeleton className="h-12 w-full" />
                    </td>
                  </tr>
                ))
              ) : list.data.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <p className="text-[var(--color-text-muted)] text-sm">Hech narsa topilmadi</p>
                    <p className="text-[var(--color-text-subtle)] text-xs mt-1">
                      Filtrlarni o'zgartirib ko'ring
                    </p>
                  </td>
                </tr>
              ) : (
                list.data.items.map((tenant) => (
                  <TenantRow
                    key={tenant.id}
                    tenant={tenant}
                    selected={selected.has(tenant.id)}
                    onToggle={() => toggleOne(tenant.id)}
                    onTariff={() => setTariffTarget(tenant)}
                    onSuspend={() => setSuspendTarget(tenant)}
                    onChanged={invalidate}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
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

      {/* Modals */}
      <CreateTenantModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          invalidate();
        }}
      />
      <TariffChangeModal
        tenant={tariffTarget}
        onClose={() => setTariffTarget(null)}
        onChanged={() => {
          setTariffTarget(null);
          invalidate();
        }}
      />
      <SuspendModal
        tenant={suspendTarget}
        onClose={() => setSuspendTarget(null)}
        onChanged={() => {
          setSuspendTarget(null);
          invalidate();
        }}
      />
    </>
  );
}

function TenantRow({
  tenant,
  selected,
  onToggle,
  onTariff,
  onSuspend,
  onChanged,
}: {
  tenant: TenantDto;
  selected: boolean;
  onToggle: () => void;
  onTariff: () => void;
  onSuspend: () => void;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const tariff = TARIFF_META[tenant.tariffPlan];
  const status = STATUS_META[tenant.status];

  const resumeMut = useMutation({
    mutationFn: () => apiResumeTenant(tenant.id),
    onSuccess: () => {
      toast.success(`"${tenant.shopName}" qayta yoqildi`);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => apiDeleteTenant(tenant.id),
    onSuccess: () => {
      toast.success(`"${tenant.shopName}" o'chirildi`);
      qc.invalidateQueries({ queryKey: ['tenants'] });
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items: DropdownItem[] = [
    {
      label: 'Batafsil',
      icon: Eye,
      href: `/tenants/${tenant.id}`,
    },
    {
      label: 'Tarif o\'zgartirish',
      icon: Crown,
      onClick: onTariff,
    },
    { label: '', divider: true },
    tenant.status === 'ACTIVE'
      ? {
          label: 'To\'xtatish',
          icon: Ban,
          onClick: onSuspend,
        }
      : {
          label: 'Qayta yoqish',
          icon: Play,
          onClick: () => resumeMut.mutate(),
        },
    {
      label: 'Email yuborish',
      icon: Mail,
      onClick: () => {
        window.location.href = `mailto:${tenant.ownerEmail}`;
      },
    },
    {
      label: 'Slug nusxalash',
      icon: Copy,
      onClick: () => {
        navigator.clipboard.writeText(tenant.slug);
        toast.success('Slug nusxalandi');
      },
    },
    { label: '', divider: true },
    {
      label: 'O\'chirish',
      icon: Trash2,
      danger: true,
      onClick: () => {
        if (
          confirm(
            `"${tenant.shopName}" do'koni butunlay O'CHIRILSINMI?\nBu amal qaytarib bo'lmaydi.`,
          )
        ) {
          deleteMut.mutate();
        }
      },
    },
  ];

  return (
    <tr
      className={cn(
        'border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors group',
        selected && 'bg-[var(--color-primary)]/5',
      )}
    >
      <td className="py-3 pl-5 pr-1">
        <button
          onClick={onToggle}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          {selected ? (
            <CheckSquare size={16} className="text-[var(--color-primary)]" />
          ) : (
            <Square size={16} />
          )}
        </button>
      </td>

      <td className="py-3 px-4">
        <Link href={`/tenants/${tenant.id}`} className="flex items-center gap-3 min-w-0">
          {tenant.logoUrl ? (
            <img
              src={tenant.logoUrl}
              alt=""
              className="h-10 w-10 rounded-lg object-cover shrink-0"
            />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] grid place-items-center text-white font-semibold text-sm shrink-0">
              {tenant.shopName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--color-text)] truncate group-hover:text-[var(--color-primary)] transition-colors">
              {tenant.shopName}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] truncate">{tenant.ownerEmail}</p>
          </div>
        </Link>
      </td>

      <td className="py-3 px-4">
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
        {!tenant.isActivated && (
          <span className="block text-[10px] text-[var(--color-warning)] mt-1">
            Faollashtirilmagan
          </span>
        )}
      </td>

      <td className="py-3 px-4">
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
      </td>

      <td className="py-3 px-4 text-sm tabular-nums">
        <p className="text-[var(--color-text)] font-medium">{formatUzs(tenant.totalRevenue)}</p>
        <p className="text-[11px] text-[var(--color-text-subtle)]">
          {formatNumber(tenant.totalOrders)} buyurtma
        </p>
      </td>

      <td className="py-3 px-4 text-sm tabular-nums">
        <p className="text-[var(--color-text)]">{formatUzs(tenant.walletBalance)}</p>
        <p className="text-[11px] text-[var(--color-text-subtle)]">
          {formatNumber(tenant.ordersCount)} buyurtma
        </p>
      </td>

      <td className="py-3 px-4 text-xs text-[var(--color-text-muted)]">
        {formatRelative(tenant.lastActivityAt)}
        <p className="text-[10px] text-[var(--color-text-subtle)] mt-0.5">
          {formatDate(tenant.createdAt)}
        </p>
      </td>

      <td className="py-3 px-4">
        <div className="flex items-center justify-end gap-1">
          {tenant.customDomain && (
            <a
              href={`https://${tenant.customDomain}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="h-8 w-8 rounded-lg grid place-items-center text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] transition-colors"
              title="Do'konni ochish"
            >
              <ExternalLink size={14} />
            </a>
          )}
          <Dropdown
            trigger={
              <span className="inline-flex h-8 w-8 rounded-lg items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] transition-colors">
                <MoreHorizontal size={14} />
              </span>
            }
            items={items}
          />
        </div>
      </td>
    </tr>
  );
}
