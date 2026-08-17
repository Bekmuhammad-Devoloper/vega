'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Store, ChevronDown, Plus, Check, Upload, X } from 'lucide-react';
import {
  apiMyStores,
  apiCreateStore,
  apiSwitchStore,
  apiUploadImage,
  type StoreBrief,
} from '@/lib/endpoints';
import { setAccessToken } from '@/lib/api';
import { toast } from '@/stores/toast-store';
import { Field, Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

const PLAN_LABEL: Record<string, string> = {
  FREE: 'Free', STANDARD: 'Standart', PRO: 'Pro', PREMIUM: 'Premium',
};

/** Tarif tugashiga qolgan kunlar — jonli (pulslanadigan) nuqta bilan. */
function DaysLeftBadge({ days }: { days: number }) {
  const expired = days < 0;
  const urgent = days >= 0 && days <= 5; // ≤5 kun — qizil
  const soon = days > 5 && days <= 15; // ≤15 kun — sariq
  const label = expired ? 'Muddati tugagan' : days === 0 ? 'Bugun tugaydi' : `${days} kun qoldi`;
  const tone = cn(
    expired || urgent
      ? 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]'
      : soon
        ? 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]'
        : 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
  );
  const dot = cn(
    expired || urgent
      ? 'bg-[var(--color-danger)]'
      : soon
        ? 'bg-[var(--color-warning)]'
        : 'bg-[var(--color-success)]',
  );
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap', tone)}>
      <span className="relative flex h-1.5 w-1.5">
        <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-75', dot)} />
        <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', dot)} />
      </span>
      {label}
    </span>
  );
}

export function StoreSwitcher({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const { data } = useQuery({ queryKey: ['my-stores'], queryFn: apiMyStores });

  const lg = size === 'lg';
  const logoBox = lg ? 'h-9 w-9' : 'h-8 w-8';
  const logoIcon = lg ? 18 : 16;
  const nameText = lg ? 'text-base font-bold' : 'text-sm font-semibold';

  const switchTo = useMutation({
    mutationFn: (tenantId: string) => apiSwitchStore(tenantId),
    onSuccess: (res) => {
      setAccessToken(res.accessToken);
      toast.success('Do\'kon almashtirildi');
      window.location.href = '/';
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Bitta do'kon va yangi qo'shib bo'lmasa — switcher kerak emas
  if (!data) return null;
  const current = data.stores.find((s) => s.isCurrent) ?? data.stores[0];
  if (data.stores.length <= 1 && !data.canAdd) {
    return (
      <div className="flex items-center gap-2.5 px-1 py-1 min-w-0">
        <span className={`inline-flex ${logoBox} rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] items-center justify-center shrink-0 overflow-hidden ring-1 ring-[var(--color-border)]`}>
          {current?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Store size={logoIcon} />
          )}
        </span>
        <span className="min-w-0">
          <span className={`block ${nameText} truncate leading-tight`}>{current?.shopName ?? 'Do\'kon'}</span>
          {lg && current && (
            <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] leading-tight text-[var(--color-text-muted)]">
              <span>{PLAN_LABEL[current.tariffPlan] ?? current.tariffPlan} tarif</span>
              {current.tariffDaysLeft != null && <DaysLeftBadge days={current.tariffDaysLeft} />}
            </span>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2 py-2 rounded-xl border border-[var(--color-border)] bg-white hover:bg-gray-50 min-w-0"
      >
        <span className={`inline-flex ${logoBox} rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] items-center justify-center shrink-0 overflow-hidden`}>
          {current?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Store size={logoIcon} />
          )}
        </span>
        <span className={`${nameText} truncate flex-1 text-left`}>{current?.shopName}</span>
        <ChevronDown size={16} className="text-[var(--color-text-muted)] shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1 left-0 right-0 rounded-xl border border-[var(--color-border)] bg-white shadow-lg overflow-hidden">
            <ul className="max-h-72 overflow-y-auto py-1">
              {data.stores.map((s) => (
                <li key={s.id}>
                  <button
                    disabled={s.isCurrent || switchTo.isPending}
                    onClick={() => switchTo.mutate(s.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 disabled:opacity-100 text-left"
                  >
                    <span className="inline-flex h-8 w-8 rounded-lg bg-[var(--color-bg)] items-center justify-center shrink-0 overflow-hidden">
                      {s.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.logoUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Store size={15} className="text-[var(--color-text-muted)]" />
                      )}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium truncate">{s.shopName}</span>
                      <span className="block text-[11px] text-[var(--color-text-muted)]">
                        {PLAN_LABEL[s.tariffPlan] ?? s.tariffPlan}
                        {s.tariffDaysLeft != null &&
                          ` · ${s.tariffDaysLeft < 0 ? 'muddati tugagan' : s.tariffDaysLeft + ' kun qoldi'}`}
                      </span>
                    </span>
                    {s.isCurrent && <Check size={16} className="text-[var(--color-primary)] shrink-0" />}
                  </button>
                </li>
              ))}
            </ul>
            {data.canAdd && (
              <button
                onClick={() => { setAdding(true); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 border-t border-[var(--color-border)] text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5"
              >
                <Plus size={16} /> Yangi do&apos;kon qo&apos;shish
              </button>
            )}
            {!data.canAdd && data.stores.length >= data.allowed && (
              <div className="px-3 py-2 border-t border-[var(--color-border)] text-[11px] text-[var(--color-text-muted)]">
                Ko&apos;proq do&apos;kon uchun Premium tarif kerak.
              </div>
            )}
          </div>
        </>
      )}

      {adding && <AddStoreModal onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddStoreModal({ onClose }: { onClose: () => void }) {
  const [shopName, setShopName] = useState('');
  const [botToken, setBotToken] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  async function uploadLogo(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const r = await apiUploadImage(file);
      setLogoUrl(r.url);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const create = useMutation({
    mutationFn: () =>
      apiCreateStore({ shopName: shopName.trim(), botToken: botToken.trim() || undefined, logoUrl: logoUrl || undefined }),
    onSuccess: async (res) => {
      try {
        const sw = await apiSwitchStore(res.tenantId);
        setAccessToken(sw.accessToken);
        toast.success('Yangi do\'kon ochildi');
        window.location.href = '/settings';
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">Yangi do&apos;kon</h3>
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-full hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">
          Yangi do&apos;kon <b>Free</b> tarifda ochiladi — keyin sozlamalardan yangilashingiz mumkin.
        </p>

        <Field label="Do'kon nomi">
          <Input value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="Mening 2-do'konim" />
        </Field>

        <Field label="Bot token (ixtiyoriy)" hint="@BotFather'dan olingan token — mijozlar shu bot orqali kiradi">
          <Input value={botToken} onChange={(e) => setBotToken(e.target.value)} placeholder="123456:ABC..." className="font-mono" />
        </Field>

        <Field label="Logo (ixtiyoriy)">
          <label className="flex items-center gap-3 h-14 px-3 rounded-xl border border-dashed border-[var(--color-border)] bg-white cursor-pointer w-fit">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="logo" className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <span className="inline-flex h-10 w-10 rounded-lg bg-[var(--color-bg)] items-center justify-center text-[var(--color-text-muted)]">
                <Upload size={18} />
              </span>
            )}
            <span className="text-sm text-[var(--color-text-muted)] pr-2">
              {uploading ? 'Yuklanmoqda…' : logoUrl ? 'Almashtirish' : 'Logo yuklash'}
            </span>
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => uploadLogo(e.target.files?.[0])} />
          </label>
        </Field>

        <Button fullWidth loading={create.isPending} disabled={shopName.trim().length < 2} onClick={() => create.mutate()}>
          Do&apos;kon ochish
        </Button>
      </div>
    </div>
  );
}
