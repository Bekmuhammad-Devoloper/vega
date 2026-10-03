'use client';

import { useQuery } from '@tanstack/react-query';
import { Copy, Ticket } from 'lucide-react';
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

/** Bosh sahifadagi faol promokodlar — bosilsa nusxa olinadi. */
export function PromoStrip({ locale }: { locale: Locale }) {
  const { data } = usePublicPromos();
  const promos = data ?? [];
  if (!promos.length) return null;
  const ru = locale === 'ru';

  const copy = async (code: string) => {
    haptic('light');
    try {
      await navigator.clipboard.writeText(code);
      toast.success(ru ? `Промокод ${code} скопирован` : `${code} nusxalandi — xaridda kiriting`);
    } catch {
      toast.success(ru ? `Промокод: ${code}` : `Promokod: ${code}`);
    }
  };

  return (
    <div className="px-4 pt-3">
      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {promos.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => copy(p.code)}
            className="flex shrink-0 items-center gap-2.5 rounded-2xl border border-dashed border-[var(--color-primary)]/40 bg-[var(--color-primary)]/[0.06] py-2.5 pl-3 pr-3.5 text-left active:scale-[0.98] transition-transform"
          >
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--color-primary)] text-white">
              <Ticket size={16} />
            </span>
            <span>
              <span className="flex items-center gap-1.5 text-sm font-extrabold tracking-wide">
                {p.code}
                <Copy size={12} className="text-[var(--color-text-muted)]" />
              </span>
              <span className="block text-xs font-semibold text-green-700">
                {promoLabel(p, locale)} {ru ? 'скидка' : 'chegirma'}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
