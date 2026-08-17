'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Crown, ArrowRight } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { apiChangeTariff } from '@/lib/endpoints';
import type { TariffPlan, TenantDto } from '@/lib/types';
import { TARIFF_META, TARIFF_PRICE } from '@/lib/tariff';
import { formatUzs } from '@/lib/format';
import { toast } from '@/stores/toast-store';
import { cn } from '@/lib/cn';

const ALL_PLANS: TariffPlan[] = ['FREE', 'STANDARD', 'PRO', 'PREMIUM'];

export function TariffChangeModal({
  tenant,
  onClose,
  onChanged,
}: {
  tenant: TenantDto | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [selected, setSelected] = useState<TariffPlan>(tenant?.tariffPlan ?? 'FREE');

  const mut = useMutation({
    mutationFn: () => apiChangeTariff(tenant!.id, selected),
    onSuccess: (t) => {
      toast.success(`"${t.shopName}" tarifi ${TARIFF_META[t.tariffPlan].label}ga o'zgartirildi`);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!tenant) return null;

  return (
    <Modal
      open={!!tenant}
      onClose={onClose}
      title={`Tarif o'zgartirish — ${tenant.shopName}`}
      size="lg"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-3 py-3 bg-[var(--color-bg)] rounded-xl">
          <div className="text-center">
            <p className="text-[10px] text-[var(--color-text-subtle)] uppercase tracking-wider mb-1">
              Hozir
            </p>
            <p className={`text-lg font-bold ${TARIFF_META[tenant.tariffPlan].color}`}>
              {TARIFF_META[tenant.tariffPlan].icon} {TARIFF_META[tenant.tariffPlan].label}
            </p>
          </div>
          <ArrowRight size={20} className="text-[var(--color-text-subtle)]" />
          <div className="text-center">
            <p className="text-[10px] text-[var(--color-text-subtle)] uppercase tracking-wider mb-1">
              Yangi
            </p>
            <p className={`text-lg font-bold ${TARIFF_META[selected].color}`}>
              {TARIFF_META[selected].icon} {TARIFF_META[selected].label}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {ALL_PLANS.map((plan) => {
            const meta = TARIFF_META[plan];
            const isActive = plan === selected;
            const isCurrent = plan === tenant.tariffPlan;
            return (
              <button
                key={plan}
                type="button"
                onClick={() => setSelected(plan)}
                className={cn(
                  'p-3 rounded-xl border-2 text-left transition-all',
                  isActive
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                    : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-border-strong)]',
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-semibold ${meta.color}`}>
                    {meta.icon} {meta.label}
                  </span>
                  {isCurrent && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface-elevated)] text-[var(--color-text-subtle)]">
                      Hozirgi
                    </span>
                  )}
                </div>
                <p className="text-sm text-[var(--color-text)] tabular-nums">
                  {plan === 'FREE' ? 'Bepul' : formatUzs(TARIFF_PRICE[plan])}
                </p>
              </button>
            );
          })}
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="ghost" onClick={onClose}>
            Bekor
          </Button>
          <Button
            onClick={() => mut.mutate()}
            loading={mut.isPending}
            disabled={selected === tenant.tariffPlan}
          >
            <Crown size={14} />
            Tasdiqlash
          </Button>
        </div>
      </div>
    </Modal>
  );
}
