'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Clock, Copy, Gift } from 'lucide-react';
import { cn } from '@/lib/cn';
import { apiPublicPromos, type PublicPromo } from '@/lib/api/endpoints';
import { formatMoney } from '@/lib/format';
import { haptic } from '@/lib/telegram';
import { toast } from '@/stores/toast-store';
import type { Locale } from '@/i18n';

export function promoLabel(p: PublicPromo, locale: Locale): string {
  return p.type === 'PERCENT' ? `−${p.value}%` : `−${formatMoney(p.value, locale)}`;
}

export function usePublicPromos() {
  return useQuery({
    queryKey: ['public-promos'],
    queryFn: apiPublicPromos,
    staleTime: 5 * 60_000,
  });
}

const MONTHS_UZ = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];

function untilLabel(iso: string | null, ru: boolean): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return ru
    ? `до ${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`
    : `${d.getDate()}-${MONTHS_UZ[d.getMonth()]}gacha`;
}

/** Katta raqam + birlik: "1 000" / "so'm" yoki "15" / "%". */
function discountParts(p: PublicPromo, locale: Locale): [string, string] {
  if (p.type === 'PERCENT') return [String(p.value), '%'];
  const full = formatMoney(p.value, locale);
  const unit = locale === 'ru' ? 'сум' : "so'm";
  return [full.replace(unit, '').trim(), unit];
}

/** Bosh sahifadagi faol promokodlar — kupon ko'rinishida, bosilsa nusxa olinadi. */
export function PromoStrip({ locale }: { locale: Locale }) {
  const { data } = usePublicPromos();
  const [copied, setCopied] = useState<string | null>(null);
  const promos = data ?? [];
  if (!promos.length) return null;
  const ru = locale === 'ru';
  const single = promos.length === 1;

  const copy = async (code: string) => {
    haptic('success');
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      /* clipboard ruxsati bo'lmasa ham kod ekranda ko'rinib turadi */
    }
    setCopied(code);
    toast.success(ru ? `Промокод ${code} скопирован` : `${code} nusxalandi — xaridda kiriting`);
    setTimeout(() => setCopied((c) => (c === code ? null : c)), 2000);
  };

  return (
    <div className="px-4 pt-3">
      <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {promos.map((p) => {
          const [amount, unit] = discountParts(p, locale);
          const until = untilLabel(p.expiresAt, ru);
          const isCopied = copied === p.code;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => copy(p.code)}
              className={cn(
                'relative flex h-16 shrink-0 snap-start overflow-hidden rounded-[18px] bg-gradient-to-r from-orange-50 via-white to-white text-left ring-1 ring-orange-200/70 shadow-[0_6px_18px_-8px_rgba(234,88,12,0.45)] transition-transform active:scale-[0.985]',
                single ? 'w-full' : 'w-[86%]',
              )}
            >
              {/* Chap: chegirma */}
              <div className="relative flex w-[33%] shrink-0 flex-col justify-center overflow-hidden bg-[linear-gradient(135deg,#FBBF24_0%,#F97316_45%,#E11D48_100%)] pl-3.5 pr-1 text-white">
                <div className="pointer-events-none absolute -right-3 -top-6 h-14 w-14 rounded-full bg-white/15" />
                <div className="pointer-events-none absolute -bottom-8 -left-4 h-14 w-14 rounded-full bg-white/10" />
                <div className="promo-shine pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/35 to-transparent" />
                <span className="relative inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-[0.14em] text-white/85">
                  <Gift size={10} strokeWidth={2.5} />
                  {ru ? 'Скидка' : 'Chegirma'}
                </span>
                <span className="relative mt-1 flex items-baseline gap-1 leading-none">
                  <span className="truncate text-[19px] font-black tabular-nums tracking-tight [text-shadow:0_1px_6px_rgba(0,0,0,0.18)]">
                    {amount}
                  </span>
                  <span className="text-[10px] font-bold">{unit}</span>
                </span>
              </div>

              {/* Kesik chiziq + teshiklar */}
              <div className="relative w-0">
                <span className="absolute -left-[7px] -top-[7px] h-3.5 w-3.5 rounded-full bg-[var(--color-bg)]" />
                <span className="absolute -bottom-[7px] -left-[7px] h-3.5 w-3.5 rounded-full bg-[var(--color-bg)]" />
                <span className="absolute inset-y-2.5 -left-px border-l-2 border-dotted border-orange-300/80" />
              </div>

              {/* O'ng: kod */}
              <div className="flex min-w-0 flex-1 items-center gap-2.5 pl-4 pr-3">
                <div className="min-w-0 flex-1 leading-none">
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-orange-500/80">
                    {ru ? 'Промокод' : 'Promokod'}
                  </p>
                  <p className="mt-1 truncate font-mono text-[17px] font-black tracking-[0.18em] text-[var(--color-text)]">
                    {p.code}
                  </p>
                  {until && (
                    <p className="mt-1 flex items-center gap-1 truncate text-[10px] text-[var(--color-text-muted)]">
                      <Clock size={10} className="shrink-0" />
                      {until}
                    </p>
                  )}
                </div>
                <span
                  className={cn(
                    'inline-flex h-8 shrink-0 items-center gap-1 rounded-xl px-2.5 text-[11px] font-bold text-white transition-all',
                    isCopied
                      ? 'bg-emerald-500 shadow-[0_4px_10px_-2px_rgba(16,185,129,0.5)]'
                      : 'bg-gradient-to-br from-orange-500 to-rose-500 shadow-[0_4px_10px_-2px_rgba(234,88,12,0.5)]',
                  )}
                >
                  {isCopied ? <Check size={13} strokeWidth={3} /> : <Copy size={12} strokeWidth={2.5} />}
                  {isCopied ? (ru ? 'Готово' : 'Olindi') : ru ? 'Взять' : 'Olish'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
