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
                'relative flex h-[60px] shrink-0 snap-start overflow-hidden rounded-2xl bg-white text-left ring-1 ring-orange-100 shadow-[0_4px_14px_-6px_rgba(234,88,12,0.35)] transition-transform active:scale-[0.985]',
                single ? 'w-full' : 'w-[84%]',
              )}
            >
              {/* Chap: chegirma */}
              <div className="relative flex w-[34%] shrink-0 items-center gap-2 overflow-hidden bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 pl-3 pr-2 text-white">
                <div className="pointer-events-none absolute -left-4 -top-5 h-12 w-12 rounded-full bg-white/20" />
                <span className="relative grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/20 ring-1 ring-white/30">
                  <Gift size={14} />
                </span>
                <span className="relative min-w-0 leading-none">
                  <span className="block truncate text-[16px] font-black tabular-nums tracking-tight">
                    −{amount}
                  </span>
                  <span className="mt-[3px] block text-[9.5px] font-bold uppercase tracking-wide text-white/85">
                    {unit === '%' ? (ru ? '% скидка' : '% chegirma') : unit}
                  </span>
                </span>
              </div>

              {/* Kesik chiziq + teshiklar */}
              <div className="relative w-0">
                <span className="absolute -left-2 -top-2 h-4 w-4 rounded-full bg-[var(--color-bg)] ring-1 ring-orange-100" />
                <span className="absolute -bottom-2 -left-2 h-4 w-4 rounded-full bg-[var(--color-bg)] ring-1 ring-orange-100" />
                <span className="absolute inset-y-2.5 left-0 border-l-[1.5px] border-dashed border-orange-200" />
              </div>

              {/* O'ng: kod */}
              <div className="flex min-w-0 flex-1 items-center gap-2 pl-3.5 pr-2.5">
                <div className="min-w-0 flex-1 leading-none">
                  <p className="truncate font-mono text-[16px] font-black tracking-[0.16em] text-[var(--color-text)]">
                    {p.code}
                  </p>
                  <p className="mt-1 flex items-center gap-1 truncate text-[10.5px] text-[var(--color-text-muted)]">
                    {until ? (
                      <>
                        <Clock size={10} className="shrink-0" />
                        {until}
                      </>
                    ) : ru ? (
                      'Промокод'
                    ) : (
                      'Promokod'
                    )}
                  </p>
                </div>
                <span
                  aria-label={ru ? 'Копировать' : 'Nusxalash'}
                  className={cn(
                    'grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors',
                    isCopied ? 'bg-emerald-500 text-white' : 'bg-orange-50 text-orange-600',
                  )}
                >
                  {isCopied ? <Check size={15} strokeWidth={3} /> : <Copy size={14} />}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
