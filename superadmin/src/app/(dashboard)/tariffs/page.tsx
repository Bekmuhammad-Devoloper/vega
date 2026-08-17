'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Save, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetchTariffs, apiUpdateTariff } from '@/lib/endpoints';
import type { TariffConfigDto, TariffPlan } from '@/lib/types';
import { TARIFF_META } from '@/lib/tariff';
import { formatNumber, formatUzs } from '@/lib/format';
import { toast } from '@/stores/toast-store';

export default function TariffsConfigPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['tariffs'], queryFn: apiFetchTariffs });

  return (
    <>
      <PageHeader
        title="Tarif konfiguratsiyasi"
        subtitle="Narxlar, limitlar va funksiyalarni tahrirlash"
      />

      {list.isLoading || !list.data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {list.data.map((t) => (
            <TariffCard
              key={t.plan}
              config={t}
              onSaved={() => qc.invalidateQueries({ queryKey: ['tariffs'] })}
            />
          ))}
        </div>
      )}
    </>
  );
}

function TariffCard({
  config,
  onSaved,
}: {
  config: TariffConfigDto;
  onSaved: () => void;
}) {
  const meta = TARIFF_META[config.plan];
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    oneTimePrice: Number(config.oneTimePrice),
    maxServices: config.maxServices,
    maxCountries: config.maxCountries,
    maxAdmins: config.maxAdmins,
    customBot: config.customBot,
    customDomain: config.customDomain,
    whiteLabel: config.whiteLabel,
  });

  const mut = useMutation({
    mutationFn: () =>
      apiUpdateTariff(config.plan, {
        ...form,
        oneTimePrice: String(form.oneTimePrice),
      }),
    onSuccess: () => {
      toast.success(`${meta.label} tarifi yangilandi`);
      setEditing(false);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader
        title={
          <div className="flex items-center gap-2">
            <span className="text-base">{meta.icon}</span>
            <span className={meta.color}>{meta.label}</span>
            {config.badge && (
              <Badge variant="warning" className="ml-1">
                {config.badge}
              </Badge>
            )}
          </div>
        }
        subtitle={config.description ?? undefined}
        action={
          editing ? (
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                <X size={14} />
              </Button>
              <Button size="sm" onClick={() => mut.mutate()} loading={mut.isPending}>
                <Save size={14} />
                Saqlash
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil size={14} />
              Tahrirlash
            </Button>
          )
        }
      />
      <CardBody className="space-y-4">
        {/* Narx */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)] mb-2">
            Faollashtirish narxi (bir martalik)
          </div>
          {editing ? (
            <Field label="Bir martalik narx (UZS)">
              <Input
                type="number"
                value={form.oneTimePrice}
                onChange={(e) =>
                  setForm({ ...form, oneTimePrice: Number(e.target.value) })
                }
              />
            </Field>
          ) : (
            <Stat label="Bir martalik" value={formatUzs(config.oneTimePrice)} />
          )}
        </div>

        {/* Limitlar */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)] mb-2">
            Limitlar
          </div>
          {editing ? (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Xizmatlar (max)">
                <Input
                  type="number"
                  value={form.maxServices}
                  onChange={(e) => setForm({ ...form, maxServices: Number(e.target.value) })}
                />
              </Field>
              <Field label="Davlatlar (max)">
                <Input
                  type="number"
                  value={form.maxCountries}
                  onChange={(e) => setForm({ ...form, maxCountries: Number(e.target.value) })}
                />
              </Field>
              <Field label="Adminlar (max)">
                <Input
                  type="number"
                  value={form.maxAdmins}
                  onChange={(e) => setForm({ ...form, maxAdmins: Number(e.target.value) })}
                />
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Xizmatlar" value={formatLimit(config.maxServices)} />
              <Stat label="Davlatlar" value={formatLimit(config.maxCountries)} />
              <Stat label="Adminlar" value={formatLimit(config.maxAdmins)} />
            </div>
          )}
        </div>

        {/* Imkoniyatlar */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)] mb-2">
            Imkoniyatlar
          </div>
          {editing ? (
            <div className="space-y-2">
              <Toggle
                label="O'z boti (custom bot)"
                checked={form.customBot}
                onChange={(v) => setForm({ ...form, customBot: v })}
              />
              <Toggle
                label="O'z domeni (custom domain)"
                checked={form.customDomain}
                onChange={(v) => setForm({ ...form, customDomain: v })}
              />
              <Toggle
                label="White-label"
                checked={form.whiteLabel}
                onChange={(v) => setForm({ ...form, whiteLabel: v })}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Custom bot" value={config.customBot ? '✓ Bor' : '— Yo\'q'} />
              <Stat label="Custom domain" value={config.customDomain ? '✓ Bor' : '— Yo\'q'} />
              <Stat label="White-label" value={config.whiteLabel ? '✓ Bor' : '— Yo\'q'} />
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
      <span className="text-sm text-[var(--color-text)]">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded accent-[var(--color-primary)]"
      />
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-[var(--color-text-subtle)] uppercase tracking-wider">
        {label}
      </p>
      <p className="text-sm font-semibold text-[var(--color-text)] mt-0.5 tabular-nums">
        {value}
      </p>
    </div>
  );
}

function formatLimit(n: number): string {
  if (n >= 999_999) return '♾️ Cheksiz';
  return formatNumber(n);
}
