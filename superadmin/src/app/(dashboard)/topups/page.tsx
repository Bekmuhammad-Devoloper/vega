'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Wallet,
  CheckCircle2,
  XCircle,
  ImageOff,
  Plus,
  AlertTriangle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  apiPendingTopups,
  apiApproveTopup,
  apiRejectTopup,
  apiPlatformWallet,
  apiPlatformTopup,
} from '@/lib/endpoints';
import { formatDate, formatUzs } from '@/lib/format';
import { toast } from '@/stores/toast-store';

function parseMoney(t: string): number {
  const d = t.replace(/[^0-9]/g, '');
  return d ? Number(d) : 0;
}
function fmtInput(n: number): string {
  return n === 0 ? '' : new Intl.NumberFormat('ru-RU').format(n).replace(/,/g, ' ');
}

export default function TopupsPage() {
  const qc = useQueryClient();
  const [addText, setAddText] = useState('');
  const addAmount = parseMoney(addText);

  const wallet = useQuery({ queryKey: ['platform-wallet'], queryFn: apiPlatformWallet });
  const { data, isLoading } = useQuery({
    queryKey: ['pending-topups'],
    queryFn: apiPendingTopups,
  });

  const balance = wallet.data?.balance ?? 0;

  const addFunds = useMutation({
    mutationFn: () => apiPlatformTopup(addAmount),
    onSuccess: () => {
      toast.success("Platforma balansi to'ldirildi");
      setAddText('');
      qc.invalidateQueries({ queryKey: ['platform-wallet'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approve = useMutation({
    mutationFn: (id: string) => apiApproveTopup(id),
    onSuccess: () => {
      toast.success("Tasdiqlandi — hamyon to'ldirildi");
      qc.invalidateQueries({ queryKey: ['pending-topups'] });
      qc.invalidateQueries({ queryKey: ['platform-wallet'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const reject = useMutation({
    mutationFn: (id: string) => apiRejectTopup(id),
    onSuccess: () => {
      toast.success('Rad etildi');
      qc.invalidateQueries({ queryKey: ['pending-topups'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = data ?? [];

  return (
    <>
      <PageHeader
        title="Hamyon to'ldirishlar"
        subtitle="Reseller cheklarini tekshirib, tasdiqlang yoki rad eting"
      />

      {/* Platforma balansi */}
      <Card className="mb-4">
        <div className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
              Platforma balansi
            </p>
            <p className="text-3xl font-bold tabular-nums mt-1 text-[var(--color-text)]">
              {wallet.isLoading ? '…' : formatUzs(balance)}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Har tasdiqlaganingizda shu balansdan yechiladi
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              inputMode="numeric"
              value={addText}
              onChange={(e) => setAddText(fmtInput(parseMoney(e.target.value)))}
              placeholder="Summa qo'shish"
              className="w-40"
            />
            <Button
              loading={addFunds.isPending}
              disabled={addAmount < 1}
              onClick={() => addFunds.mutate()}
            >
              <Plus size={15} /> Qo&apos;shish
            </Button>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <div className="py-20 text-center">
            <div className="inline-flex h-14 w-14 rounded-2xl bg-[var(--color-surface-hover)] grid place-items-center text-[var(--color-text-subtle)] mb-3">
              <Wallet size={24} />
            </div>
            <p className="text-[var(--color-text-muted)] text-sm">
              Kutilayotgan to&apos;ldirish so&apos;rovi yo&apos;q
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((t) => {
            const receipt = t.metadata?.receiptUrl;
            const amt = Number(t.amount);
            const enough = balance >= amt;
            const approving = approve.isPending && approve.variables === t.id;
            const rejecting = reject.isPending && reject.variables === t.id;
            const busy = approving || rejecting;
            return (
              <Card key={t.id} className="overflow-hidden flex flex-col">
                {/* Chek rasmi */}
                {receipt ? (
                  <a
                    href={receipt}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-[var(--color-bg-secondary)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={receipt} alt="chek" className="w-full h-48 object-contain" />
                  </a>
                ) : (
                  <div className="h-48 grid place-items-center bg-[var(--color-surface-hover)] text-[var(--color-text-subtle)]">
                    <ImageOff size={28} />
                  </div>
                )}

                <div className="p-4 flex flex-col gap-3 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate text-[var(--color-text)]">
                        {t.tenant.shopName}
                      </p>
                      <p className="font-mono text-[10px] text-[var(--color-text-subtle)]">
                        {t.invoiceNumber}
                      </p>
                      <span
                        className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          (t.metadata?.method ?? 'CARD').toUpperCase() === 'CRYPTO'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {(t.metadata?.method ?? 'CARD').toUpperCase() === 'CRYPTO'
                          ? '🪙 Kripto (USDT/TON)'
                          : '💳 Karta'}
                      </span>
                    </div>
                    <p className="text-lg font-bold tabular-nums text-[var(--color-success)] shrink-0">
                      {formatUzs(t.amount)}
                    </p>
                  </div>

                  <div className="text-xs text-[var(--color-text-muted)] flex items-center justify-between">
                    <span>Do&apos;kon balansi: {formatUzs(t.tenant.walletBalance)}</span>
                    <span>{formatDate(t.createdAt)}</span>
                  </div>

                  {t.metadata?.grossAmount != null &&
                    Number(t.metadata.grossAmount) !== Number(t.amount) && (
                      <div className="flex items-center justify-between rounded-lg bg-[var(--color-surface-hover)] px-2 py-1.5 text-xs text-[var(--color-text-muted)]">
                        <span>
                          To&apos;lov (chek): <b>{formatUzs(t.metadata.grossAmount)}</b>
                        </span>
                        <span>komissiya {t.metadata.feePercent ?? 2}%</span>
                      </div>
                    )}

                  {t.metadata?.tonAmount != null && Number(t.metadata.tonAmount) > 0 && (
                    <div className="flex items-center justify-between rounded-lg bg-[var(--color-surface-hover)] px-2 py-1.5 text-xs text-[var(--color-text-muted)]">
                      <span>
                        Yuborildi: <b>{t.metadata.tonAmount} TON</b>
                      </span>
                      <span>chekni tekshiring</span>
                    </div>
                  )}

                  {!enough && (
                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-danger)] bg-[var(--color-danger)]/10 rounded-lg px-2 py-1.5">
                      <AlertTriangle size={13} className="shrink-0" />
                      Platforma balansi yetarli emas — avval to&apos;ldiring
                    </div>
                  )}

                  <div className="flex gap-2 mt-auto pt-1">
                    <Button
                      variant="success"
                      fullWidth
                      loading={approving}
                      disabled={busy || !enough}
                      onClick={() => approve.mutate(t.id)}
                      title={!enough ? 'Platforma balansi yetarli emas' : undefined}
                    >
                      <CheckCircle2 size={15} /> Tasdiqlash
                    </Button>
                    <Button
                      variant="danger"
                      fullWidth
                      loading={rejecting}
                      disabled={busy}
                      onClick={() => reject.mutate(t.id)}
                    >
                      <XCircle size={15} /> Rad etish
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
