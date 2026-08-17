'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Check, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  apiReferralConfig,
  apiSetReferralConfig,
  apiReferralWithdrawals,
  apiProcessWithdrawal,
} from '@/lib/endpoints';
import { formatUzs } from '@/lib/format';
import { toast } from '@/stores/toast-store';

const STATUS: Record<string, { label: string; variant: 'warning' | 'success' | 'danger' | 'default' }> = {
  PENDING: { label: 'Kutilmoqda', variant: 'warning' },
  PAID: { label: "To'landi", variant: 'success' },
  REJECTED: { label: 'Rad etildi', variant: 'danger' },
};

export default function SuperReferralPage() {
  const qc = useQueryClient();
  const cfg = useQuery({ queryKey: ['referral-config'], queryFn: apiReferralConfig });
  const wd = useQuery({ queryKey: ['referral-withdrawals'], queryFn: () => apiReferralWithdrawals() });

  const [percent, setPercent] = useState('');
  const [minW, setMinW] = useState('');
  useEffect(() => {
    if (cfg.data) {
      setPercent(String(cfg.data.commissionPercent));
      setMinW(String(cfg.data.minWithdrawal));
    }
  }, [cfg.data]);

  const saveCfg = useMutation({
    mutationFn: () =>
      apiSetReferralConfig({
        commissionPercent: Number(percent) || 0,
        minWithdrawal: Number(minW) || 0,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['referral-config'] });
      toast.success('Saqlandi');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const process = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'paid' | 'reject' }) =>
      apiProcessWithdrawal(id, action),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['referral-withdrawals'] });
      toast.success('Bajarildi');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader title="Referal" subtitle="Komissiya konfiguratsiyasi va kartaga yechish so'rovlari" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Konfiguratsiya */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader title="Konfiguratsiya" />
          <CardBody className="space-y-3">
            {cfg.isLoading ? (
              <Skeleton className="h-40" />
            ) : (
              <>
                <Field label="Komissiya foizi (%)" hint="Har to'lovdan referrerga beriladigan ulush">
                  <Input value={percent} onChange={(e) => setPercent(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" />
                </Field>
                <Field label="Minimal yechish summasi (so'm)" hint="Shu summadan yechish mumkin">
                  <Input value={minW} onChange={(e) => setMinW(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" />
                </Field>
                <Button onClick={() => saveCfg.mutate()} loading={saveCfg.isPending}>
                  <Save size={16} /> Saqlash
                </Button>
              </>
            )}
          </CardBody>
        </Card>

        {/* Yechish so'rovlari */}
        <Card className="lg:col-span-2">
          <CardHeader title="Kartaga yechish so'rovlari" />
          <CardBody className="space-y-2">
            {wd.isLoading ? (
              <Skeleton className="h-40" />
            ) : !wd.data?.length ? (
              <p className="text-sm text-[var(--color-text-muted)] text-center py-6">So&apos;rovlar yo&apos;q</p>
            ) : (
              wd.data.map((w) => {
                const st = STATUS[w.status] ?? STATUS.PENDING;
                return (
                  <div
                    key={w.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {w.shopName} <span className="font-normal text-[var(--color-text-muted)]">· {w.ownerName}</span>
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] font-mono">
                        {w.cardNumber}
                        {w.cardHolder ? ` · ${w.cardHolder}` : ''}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">
                        {w.ownerPhone ?? ''} {w.ownerUsername ? `· @${w.ownerUsername}` : ''} ·{' '}
                        {new Date(w.createdAt).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-[var(--color-primary)]">{formatUzs(w.amount)}</span>
                      {w.status === 'PENDING' ? (
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => process.mutate({ id: w.id, action: 'paid' })}
                            loading={process.isPending}
                          >
                            <Check size={14} /> To&apos;landi
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => process.mutate({ id: w.id, action: 'reject' })}
                          >
                            <X size={14} /> Rad
                          </Button>
                        </div>
                      ) : (
                        <Badge variant={st.variant}>{st.label}</Badge>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
