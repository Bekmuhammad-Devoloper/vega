'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Star, Crown, Check, X, Pencil, Save } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Field, Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  apiFetchDigitalProducts,
  apiCreateDigitalProduct,
  apiUpdateDigitalProduct,
} from '@/lib/endpoints';
import type { DigitalKind, DigitalProductDto } from '@/lib/types';
import { formatNumber, formatUsd } from '@/lib/format';
import { toast } from '@/stores/toast-store';

const KIND_META: Record<
  DigitalKind,
  { label: string; icon: typeof Star; color: string; unit: string }
> = {
  STARS: {
    label: 'Stars paketlari',
    icon: Star,
    color: 'text-[var(--color-warning)]',
    unit: '⭐',
  },
  PREMIUM: {
    label: 'Premium rejalari',
    icon: Crown,
    color: 'text-[var(--color-info)]',
    unit: 'oy',
  },
};

export default function DigitalProductsPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['digital-products'], queryFn: apiFetchDigitalProducts });
  const [modalKind, setModalKind] = useState<DigitalKind | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['digital-products'] });

  const groups: DigitalKind[] = ['STARS', 'PREMIUM'];

  return (
    <>
      <PageHeader
        title="Stars / Premium katalog"
        subtitle="Ulgurji narxlarni tahrirlang, paket va rejalarni boshqaring"
        action={
          <Button size="sm" onClick={() => setModalKind('STARS')}>
            <Plus size={16} /> Yangi qo&apos;shish
          </Button>
        }
      />

      {list.isLoading || !list.data ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {groups.map((kind) => {
            const meta = KIND_META[kind];
            const Icon = meta.icon;
            const items = list.data
              .filter((p) => p.kind === kind)
              .sort((a, b) => a.position - b.position);
            return (
              <Card key={kind}>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      <Icon size={16} className={meta.color} />
                      <span>{meta.label}</span>
                      <span className="text-[var(--color-text-subtle)] font-normal">
                        ({items.length})
                      </span>
                    </span>
                  }
                  action={
                    <Button size="sm" variant="ghost" onClick={() => setModalKind(kind)}>
                      <Plus size={14} /> Qo&apos;shish
                    </Button>
                  }
                />
                <CardBody className="space-y-2">
                  {items.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-muted)] text-center py-6">
                      Hali mahsulot yo&apos;q
                    </p>
                  ) : (
                    items.map((p) => (
                      <ProductRow key={p.id} product={p} onChanged={invalidate} />
                    ))
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <CreateProductModal
        open={modalKind !== null}
        initialKind={modalKind ?? 'STARS'}
        onClose={() => setModalKind(null)}
        onCreated={() => {
          setModalKind(null);
          invalidate();
        }}
      />
    </>
  );
}

function ProductRow({
  product,
  onChanged,
}: {
  product: DigitalProductDto;
  onChanged: () => void;
}) {
  const meta = KIND_META[product.kind];
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(String(product.wholesaleUsd));
  const [smmId, setSmmId] = useState(product.providerServiceId ?? '');

  const patch = useMutation({
    mutationFn: (body: Parameters<typeof apiUpdateDigitalProduct>[1]) =>
      apiUpdateDigitalProduct(product.id, body),
    onError: (e: Error) => toast.error(e.message),
  });

  const savePrice = () =>
    patch.mutate(
      { wholesaleUsd: Number(price) || 0 },
      {
        onSuccess: () => {
          setEditing(false);
          toast.success('Ulgurji narx yangilandi');
          onChanged();
        },
      },
    );

  const toggleActive = () =>
    patch.mutate(
      { isActive: !product.isActive },
      {
        onSuccess: () => {
          toast.success(product.isActive ? 'Nofaol qilindi' : 'Faollashtirildi');
          onChanged();
        },
      },
    );

  const saveSmm = () => {
    if (smmId === (product.providerServiceId ?? '')) return;
    patch.mutate(
      { providerServiceId: smmId.trim() },
      {
        onSuccess: () => {
          toast.success(smmId.trim() ? 'SMM service id saqlandi' : "Avto-yetkazish o'chirildi");
          onChanged();
        },
      },
    );
  };

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 transition-colors ${
        product.isActive
          ? 'border-[var(--color-border)] bg-[var(--color-bg)]'
          : 'border-[var(--color-border)] bg-[var(--color-surface-hover)]/40 opacity-70'
      }`}
    >
      {/* Nom + miqdor + SMM service id */}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--color-text)]">{product.label}</p>
        <p className="text-xs text-[var(--color-text-muted)]">
          {formatNumber(product.amount)} {meta.unit}
          <span className="text-[var(--color-text-subtle)]"> · #{product.position}</span>
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase text-[var(--color-text-subtle)]">
            SMM
          </span>
          <input
            value={smmId}
            onChange={(e) => setSmmId(e.target.value)}
            onBlur={saveSmm}
            placeholder="service id (avto)"
            className="h-6 w-32 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 text-xs outline-none focus:border-[var(--color-primary)]"
          />
          {product.providerServiceId ? (
            <span className="text-[10px] font-medium text-[var(--color-success)]">✓ avto</span>
          ) : (
            <span className="text-[10px] text-[var(--color-text-subtle)]">qo&apos;lda</span>
          )}
        </div>
      </div>

      {/* Narx + amallar */}
      <div className="flex items-center gap-3 shrink-0">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-[var(--color-text-muted)]">$</span>
            <Input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="h-9 w-24"
              autoFocus
            />
            <Button size="sm" onClick={savePrice} loading={patch.isPending}>
              <Save size={14} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setPrice(String(product.wholesaleUsd));
                setEditing(false);
              }}
            >
              <X size={14} />
            </Button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="group flex items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-[var(--color-surface-hover)]"
            title="Ulgurji narxni tahrirlash"
          >
            <span className="text-sm font-bold text-[var(--color-primary)] tabular-nums">
              {formatUsd(product.wholesaleUsd)}
            </span>
            <Pencil
              size={13}
              className="text-[var(--color-text-subtle)] group-hover:text-[var(--color-text)]"
            />
          </button>
        )}

        {/* Faol toggle */}
        <button
          onClick={toggleActive}
          disabled={patch.isPending}
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
            product.isActive
              ? 'bg-[var(--color-success)]/15 text-[var(--color-success)] hover:bg-[var(--color-success)]/25'
              : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]/80'
          }`}
          title={product.isActive ? 'Nofaol qilish' : 'Faollashtirish'}
        >
          {product.isActive ? <Check size={12} /> : <X size={12} />}
          {product.isActive ? 'Faol' : 'Nofaol'}
        </button>
      </div>
    </div>
  );
}

function CreateProductModal({
  open,
  initialKind,
  onClose,
  onCreated,
}: {
  open: boolean;
  initialKind: DigitalKind;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [kind, setKind] = useState<DigitalKind>(initialKind);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [wholesaleUsd, setWholesaleUsd] = useState('');
  const [position, setPosition] = useState('');

  // initialKind o'zgarsa (masalan boshqa "Qo'shish" tugmasi) formani sinxronlash
  const [seenKind, setSeenKind] = useState(initialKind);
  if (open && seenKind !== initialKind) {
    setSeenKind(initialKind);
    setKind(initialKind);
  }

  const mut = useMutation({
    mutationFn: () =>
      apiCreateDigitalProduct({
        kind,
        label: label.trim(),
        amount: Number(amount) || 0,
        wholesaleUsd: Number(wholesaleUsd) || 0,
        position: position.trim() ? Number(position) : undefined,
      }),
    onSuccess: () => {
      toast.success('Mahsulot qo\'shildi');
      setLabel('');
      setAmount('');
      setWholesaleUsd('');
      setPosition('');
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) {
      toast.error('Nom kiriting');
      return;
    }
    mut.mutate();
  }

  const unit = kind === 'STARS' ? '⭐ Stars soni' : 'Oylar soni';

  return (
    <Modal open={open} onClose={onClose} title="Yangi mahsulot">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Turi">
          <div className="grid grid-cols-2 gap-2">
            {(['STARS', 'PREMIUM'] as DigitalKind[]).map((k) => {
              const m = KIND_META[k];
              const Icon = m.icon;
              const active = kind === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-left transition ${
                    active
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 ring-1 ring-[var(--color-primary)]'
                      : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-primary)]/30'
                  }`}
                >
                  <Icon size={18} className={m.color} />
                  <span className="text-sm font-medium text-[var(--color-text)]">
                    {k === 'STARS' ? 'Stars' : 'Premium'}
                  </span>
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Nom (label)" hint="Mijozga ko'rinadigan nom">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={kind === 'STARS' ? '500 Stars' : 'Premium 3 oy'}
            autoFocus
            required
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={unit}>
            <Input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={kind === 'STARS' ? '500' : '3'}
            />
          </Field>
          <Field label="Ulgurji narx (USD)">
            <Input
              type="number"
              step="0.01"
              value={wholesaleUsd}
              onChange={(e) => setWholesaleUsd(e.target.value)}
              placeholder="6.50"
            />
          </Field>
        </div>

        <Field label="Tartib raqami (position)" hint="Ixtiyoriy — kichik raqam yuqorida">
          <Input
            type="number"
            inputMode="numeric"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="0"
          />
        </Field>

        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Bekor
          </Button>
          <Button type="submit" loading={mut.isPending}>
            <Plus size={16} /> Qo&apos;shish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
