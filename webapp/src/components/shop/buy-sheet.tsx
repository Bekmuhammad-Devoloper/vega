'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Check, Tag, X } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { CountryFlag } from '@/components/country-flag';
import { ServiceIcon } from '@/components/service-icon';
import { apiApplyPromo } from '@/lib/api/endpoints';
import { formatMoney } from '@/lib/format';
import { haptic } from '@/lib/telegram';
import type { StorefrontOffer } from '@/lib/api/types';
import type { Locale } from '@/i18n';
import { promoLabel, usePublicPromos } from './promo-strip';

/**
 * Xaridni tasdiqlash oynasi: narx, ixtiyoriy promokod va yakuniy summa.
 * Yakuniy narx serverda qayta hisoblanadi — bu yerdagisi faqat ko'rinish.
 */
export function BuySheet({
  offer,
  locale,
  pending,
  onClose,
  onConfirm,
}: {
  offer: StorefrontOffer | null;
  locale: Locale;
  pending: boolean;
  onClose: () => void;
  onConfirm: (promoCode?: string) => void;
}) {
  const ru = locale === 'ru';
  const [promoOpen, setPromoOpen] = useState(false);
  const [code, setCode] = useState('');
  const [applied, setApplied] = useState<{ code: string; discount: number } | null>(null);

  const price = Number(offer?.retailPrice ?? 0);
  const total = Math.max(0, price - (applied?.discount ?? 0));

  const { data: promos } = usePublicPromos();
  const check = useMutation({
    mutationFn: (c: string) => apiApplyPromo({ code: c.trim(), amount: price }),
    onSuccess: (r) => {
      haptic('success');
      setApplied({ code: r.code, discount: r.discountAmount });
    },
    onError: () => haptic('error'),
  });

  const reset = () => {
    setPromoOpen(false);
    setCode('');
    setApplied(null);
    check.reset();
  };

  return (
    <Sheet
      open={!!offer}
      onClose={() => {
        if (pending) return;
        reset();
        onClose();
      }}
      title={ru ? 'Подтверждение' : 'Xaridni tasdiqlash'}
    >
      {offer && (
        <div className="space-y-4 pb-5">
          <div className="flex items-center gap-3 rounded-2xl bg-[var(--color-bg)] p-3.5">
            <div className="relative shrink-0">
              <CountryFlag
                iso2={offer.country.iso2}
                className="h-9 w-12 rounded-lg object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
              />
              <span className="absolute -bottom-1.5 -right-1.5 grid h-6 w-6 place-items-center rounded-full bg-white shadow">
                <ServiceIcon
                  slug={offer.service.slug}
                  emoji={offer.service.emoji ?? '📱'}
                  className="inline-block h-4 w-4 object-contain text-sm leading-none"
                />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">
                {ru ? offer.service.nameRu : offer.service.nameUz}
              </p>
              <p className="truncate text-sm text-[var(--color-text-muted)]">
                {ru ? offer.country.nameRu : offer.country.nameUz}
              </p>
            </div>
          </div>

          {applied ? (
            <div className="flex items-center gap-2.5 rounded-2xl border border-green-200 bg-green-50 px-3.5 py-3">
              <Check size={18} className="shrink-0 text-green-600" />
              <p className="flex-1 text-sm">
                <b>{applied.code}</b>{' '}
                <span className="text-green-700">−{formatMoney(applied.discount, locale)}</span>
              </p>
              <button
                onClick={reset}
                disabled={pending}
                className="grid h-7 w-7 place-items-center rounded-full text-[var(--color-text-muted)] active:bg-green-100"
                aria-label={ru ? 'Убрать промокод' : 'Promokodni olib tashlash'}
              >
                <X size={16} />
              </button>
            </div>
          ) : promoOpen ? (
            <div>
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    check.reset();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && code.trim()) check.mutate(code);
                  }}
                  placeholder={ru ? 'Промокод' : 'Promokod'}
                  autoCapitalize="characters"
                  className="h-12 min-w-0 flex-1 rounded-2xl border border-[var(--color-border)] bg-white px-4 font-semibold uppercase tracking-wide outline-none placeholder:font-normal placeholder:normal-case placeholder:tracking-normal focus:ring-2 focus:ring-[var(--color-primary)]"
                />
                <Button
                  variant="secondary"
                  loading={check.isPending}
                  disabled={!code.trim()}
                  onClick={() => check.mutate(code)}
                  className="shrink-0"
                >
                  {ru ? 'Применить' : "Qo'llash"}
                </Button>
              </div>
              {check.isError && (
                <p className="mt-1.5 px-1 text-sm text-[var(--color-danger)]">
                  {(check.error as Error).message}
                </p>
              )}
              {!!promos?.length && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {promos.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={check.isPending}
                      onClick={() => {
                        setCode(p.code);
                        check.mutate(p.code);
                      }}
                      className="rounded-full border border-dashed border-[var(--color-primary)]/50 bg-[var(--color-primary)]/[0.06] px-3 py-1.5 text-xs font-bold text-[var(--color-primary)] active:scale-95 transition-transform"
                    >
                      {p.code} · {promoLabel(p, locale)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setPromoOpen(true)}
              className="flex w-full items-center gap-2 rounded-2xl border border-dashed border-[var(--color-border)] px-3.5 py-3 text-sm font-semibold text-[var(--color-primary)] active:bg-[var(--color-bg)]"
            >
              <Tag size={16} />
              {ru ? 'У меня есть промокод' : 'Promokodim bor'}
            </button>
          )}

          <div className="space-y-1.5 border-t border-[var(--color-border)] pt-3 text-sm">
            {applied && (
              <>
                <div className="flex justify-between text-[var(--color-text-muted)]">
                  <span>{ru ? 'Цена' : 'Narx'}</span>
                  <span className="tabular-nums line-through">{formatMoney(price, locale)}</span>
                </div>
                <div className="flex justify-between text-green-700">
                  <span>{ru ? 'Скидка' : 'Chegirma'}</span>
                  <span className="tabular-nums">−{formatMoney(applied.discount, locale)}</span>
                </div>
              </>
            )}
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">{ru ? 'К оплате' : "To'lov"}</span>
              <span className="text-xl font-extrabold tabular-nums text-[var(--color-primary)]">
                {formatMoney(total, locale)}
              </span>
            </div>
          </div>

          <Button fullWidth size="lg" loading={pending} onClick={() => onConfirm(applied?.code)}>
            {ru ? 'Купить' : 'Sotib olish'} · {formatMoney(total, locale)}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
