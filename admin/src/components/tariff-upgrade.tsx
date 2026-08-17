'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/stores/toast-store';
import {
  apiSellerTariffs,
  apiUpgradeTariff,
  apiUploadUpgradeReceipt,
  type PaymentInfo,
  type TariffOption,
} from '@/lib/endpoints';

function fmt(v: number): string {
  if (v === 0) return 'Bepul';
  return `${v.toLocaleString('ru-RU')} so'm`;
}

export function TariffUpgrade({
  currentPlan,
  onClose,
}: {
  currentPlan: string;
  onClose: () => void;
}) {
  const { data: tariffs } = useQuery({ queryKey: ['tariffs'], queryFn: apiSellerTariffs });
  const [step, setStep] = useState<'choose' | 'pay'>('choose');
  const [plan, setPlan] = useState<TariffOption | null>(null);
  const [payment, setPayment] = useState<PaymentInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [sent, setSent] = useState(false);

  const all = tariffs ?? [];

  async function choose(t: TariffOption) {
    if (t.value === 'FREE') return;
    setBusy(true);
    try {
      const res = await apiUpgradeTariff(t.value, 'monthly');
      setPlan(t);
      setPayment(res.payment);
      setStep('pay');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copy(s: string) {
    try {
      await navigator.clipboard.writeText(s);
      toast.success('Nusxa olindi');
    } catch {
      toast.error('Nusxa olishda xato');
    }
  }

  async function submit() {
    if (!receipt) {
      toast.error('Chek rasmini tanlang');
      return;
    }
    setBusy(true);
    try {
      await apiUploadUpgradeReceipt(receipt);
      setSent(true);
      toast.success('Chek yuborildi! Tasdiqlashni kuting.');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (step === 'choose') {
    return (
      <div className="space-y-2.5">
        {all.map((t) => {
          const isCurrent = t.value === currentPlan;
          const isFree = t.value === 'FREE';
          const price = isFree ? 0 : t.priceMonthly;
          return (
            <div key={t.value} className="rounded-2xl border border-[var(--color-border)] p-4">
              <div className="mb-1 flex items-start justify-between gap-2">
                <span className="font-bold">
                  {t.label} {t.popular && <span className="text-xs text-[var(--color-primary)]">· Mashhur</span>}
                </span>
                <span className="text-right">
                  <span className="block font-extrabold">{fmt(price)}</span>
                  {!isFree && (
                    <span className="block text-[10px] font-medium text-[var(--color-text-muted)]">bir martalik</span>
                  )}
                  {t.serverMonthly ? (
                    <span className="block text-[10px] text-[var(--color-text-muted)]">
                      + server {t.serverMonthly.toLocaleString('ru-RU')}/oy
                    </span>
                  ) : null}
                </span>
              </div>
              <ul className="mt-2 space-y-1 mb-3">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs text-[var(--color-text-muted)]">
                    <Check size={13} className="text-[var(--color-primary)] mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                fullWidth
                loading={busy}
                disabled={isCurrent || isFree}
                onClick={() => choose(t)}
              >
                {isCurrent ? 'Joriy tarif' : isFree ? 'Bepul tarif' : 'Tanlash'}
              </Button>
            </div>
          );
        })}
        <button type="button" onClick={onClose} className="w-full text-center text-sm text-[var(--color-text-muted)] py-1">
          Yopish
        </button>
      </div>
    );
  }

  // pay
  if (sent) {
    return (
      <div className="rounded-2xl bg-green-50 border border-green-200 p-4 text-center space-y-2">
        <div className="inline-flex h-10 w-10 rounded-full bg-green-500 text-white items-center justify-center">
          <Check size={20} />
        </div>
        <p className="font-semibold text-green-700">Chek yuborildi!</p>
        <p className="text-[13px] text-green-700/80">
          Tasdiqlash 2–30 daqiqa davom etadi. Tasdiqlangach <b>{plan?.label}</b> tarifi faollashadi.
        </p>
        <Button variant="secondary" fullWidth onClick={onClose}>
          Yopish
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-[var(--color-primary)]/[0.05] border border-[var(--color-primary)]/20 p-4">
        <p className="text-xs text-[var(--color-text-muted)]">Tanlangan tarif</p>
        <p className="font-bold">{plan?.label}</p>
        <p className="text-xl font-extrabold">{plan ? fmt(plan.priceMonthly) : ''}</p>
        {plan?.serverMonthly ? (
          <p className="text-xs font-medium text-[var(--color-text-muted)]">
            + server: {plan.serverMonthly.toLocaleString('ru-RU')} so&apos;m/oy
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        {payment?.cards.map((c, i) => (
          <div
            key={`${c.type}-${i}`}
            className="flex items-center justify-between rounded-xl border border-[var(--color-border)] p-3"
          >
            <div className="min-w-0">
              <p className="text-xs text-[var(--color-text-muted)]">{c.type}</p>
              <p className="font-mono font-semibold tracking-wider">{c.number}</p>
            </div>
            <button
              type="button"
              onClick={() => copy(c.number.replace(/\s/g, ''))}
              className="h-9 w-9 grid place-items-center rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] shrink-0"
              aria-label="Nusxa olish"
            >
              <Copy size={16} />
            </button>
          </div>
        ))}
        {payment && (
          <div className="rounded-xl border border-[var(--color-border)] p-3">
            <p className="text-xs text-[var(--color-text-muted)]">Karta egasi</p>
            <p className="font-semibold">{payment.holder}</p>
          </div>
        )}
      </div>

      {payment && (
        <p className="text-[13px] text-[var(--color-text-muted)] leading-relaxed">{payment.confirmNote}</p>
      )}

      <label className="flex items-center gap-3 h-16 px-3 rounded-xl border border-dashed border-[var(--color-border)] bg-white cursor-pointer">
        <span className="inline-flex h-12 w-12 rounded-lg bg-[var(--color-bg)] items-center justify-center text-[var(--color-text-muted)]">
          <Upload size={20} />
        </span>
        <span className="text-sm text-[var(--color-text-muted)] truncate">
          {receipt ? receipt.name : 'Chek rasmini tanlash (PNG/JPG)'}
        </span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
        />
      </label>

      <Button fullWidth loading={busy} disabled={!receipt} onClick={submit}>
        Tasdiqlashga yuborish
      </Button>
      <button type="button" onClick={onClose} className="w-full text-center text-sm text-[var(--color-text-muted)] py-1">
        Bekor qilish
      </button>
    </div>
  );
}
