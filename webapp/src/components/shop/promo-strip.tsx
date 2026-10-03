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
                'relative flex shrink-0 snap-start overflow-hidden rounded-[20px] text-left shadow-[0_6px_20px_-6px_rgba(234,88,12,0.45)] active:scale-[0.985] transition-transform',
                single ? 'w-full' : 'w-[86%]',
              )}
            >
              {/* Chap: chegirma */}
              <div className="relative flex w-[38%] flex-col justify-center bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 py-3.5 pl-4 pr-3 text-white">
                <div className="pointer-events-none absolute -left-6 -top-6 h-16 w-16 rounded-full bg-white/20" />
                <div className="pointer-events-none absolute -bottom-8 right-0 h-16 w-16 rounded-full bg-white/10" />
                <span className="relative inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white/90">
                  <Gift size={11} />
                  {ru ? 'Скидка' : 'Chegirma'}
                </span>
                <span className="relative mt-0.5 flex items-baseline gap-1 leading-none">
                  <span className="text-[24px] font-black tabular-nums tracking-tight [text-shadow:0_2px_8px_rgba(0,0,0,0.15)]">
                    {amount}
                  </span>
                  <span className="text-[12px] font-bold">{unit}</span>
                </span>
              </div>

              {/* Kesik chiziq + teshiklar */}
              <div className="relative w-0">
                <span className="absolute -left-2.5 -top-2.5 h-5 w-5 rounded-full bg-[var(--color-bg)]" />
                <span className="absolute -bottom-2.5 -left-2.5 h-5 w-5 rounded-full bg-[var(--color-bg)]" />
                <span className="absolute inset-y-3 left-0 border-l-2 border-dashed border-orange-200" />
              </div>

              {/* O'ng: kod */}
              <div className="flex flex-1 items-center gap-2 bg-white py-3 pl-4 pr-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    {ru ? 'Промокод' : 'Promokod'}
                  </p>
                  <p className="truncate font-mono text-[19px] font-black leading-tight tracking-[0.14em] text-[var(--color-text)]">
                    {p.code}
                  </p>
                  {until && (
                    <p className="mt-0.5 inline-flex items-center gap-1 text-[10.5px] text-[var(--color-text-muted)]">
                      <Clock size={10} />
                      {until}
                    </p>
                  )}
                </div>
                <span
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold transition-colors',
                    isCopied
                      ? 'bg-emerald-500 text-white'
                      : 'bg-orange-50 text-orange-600',
                  )}
                >
                  {isCopied ? <Check size={12} strokeWidth={3} /> : <Copy size={12} />}
                  {isCopied ? (ru ? 'Готово' : 'Olindi') : ru ? 'Копировать' : 'Nusxalash'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
