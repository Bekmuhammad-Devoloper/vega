'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Coins, ChevronRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { apiBuyCrypto, apiCryptoStorefront } from '@/lib/api/endpoints';
import { useLocaleStore } from '@/stores/locale-store';
import { formatMoney } from '@/lib/format';
import { haptic } from '@/lib/telegram';
import { toast } from '@/stores/toast-store';
import { cn } from '@/lib/cn';
import type { CryptoOfferDto } from '@/lib/api/types';

/**
 * Manzil shakli — backenddagi qoidalar bilan bir xil. Bu yerda tekshirish
 * mijozga DARHOL xato ko'rsatish uchun; haqiqiy himoya baribir serverda.
 */
const ADDRESS_RE: Record<string, RegExp> = {
  TON: /^[EUkK0][QqfF][A-Za-z0-9_-]{46}$/,
  TRC20: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
  BEP20: /^0x[a-fA-F0-9]{40}$/,
  ERC20: /^0x[a-fA-F0-9]{40}$/,
};

export function CryptoSection() {
  const locale = useLocaleStore((s) => s.locale);
  const { data } = useQuery({
    queryKey: ['crypto-storefront'],
    queryFn: apiCryptoStorefront,
  });
  const [selected, setSelected] = useState<CryptoOfferDto | null>(null);

  const offers = data?.cryptoEnabled ? data.offers : [];
  if (!offers.length) return null;

  return (
    <div className="px-4 pb-6">
      <section>
        <div className="mb-2.5 flex items-center gap-2">
          <Coins size={18} className="text-amber-500" />
          <h2 className="text-lg font-bold">
            {locale === 'ru' ? 'Криптовалюта' : 'Kriptovalyuta'}
          </h2>
        </div>
        <ul className="space-y-2.5">
          {offers.map((o) => (
            <li key={o.asset}>
              <button
                onClick={() => {
                  haptic('light');
                  setSelected(o);
                }}
                className="flex w-full items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-white p-3.5 text-left transition-transform active:scale-[0.99]"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--color-bg)] text-sm font-bold">
                  {o.asset === 'TON' ? '💎' : '₮'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold">{o.asset}</p>
                  <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                    {o.networks.join(' · ')}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] uppercase leading-none tracking-wide text-[var(--color-text-muted)]">
                    1 {o.asset}
                  </p>
                  <p className="mt-1 font-bold tabular-nums text-[var(--color-primary)]">
                    {formatMoney(o.pricePerUnit, locale)}
                  </p>
                </div>
                <ChevronRight size={18} className="shrink-0 text-[var(--color-text-muted)]" />
              </button>
            </li>
          ))}
        </ul>
      </section>
      <BuySheet offer={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function BuySheet({ offer, onClose }: { offer: CryptoOfferDto | null; onClose: () => void }) {
  const locale = useLocaleStore((s) => s.locale);
  const ru = locale === 'ru';
  const router = useRouter();
  const qc = useQueryClient();

  const [amount, setAmount] = useState('');
  const [network, setNetwork] = useState('');
  const [address, setAddress] = useState('');
  const [memo, setMemo] = useState('');
  const [done, setDone] = useState(false);

  // Yangi aktiv ochilganda formani tozalaymiz va bitta tarmoq bo'lsa tanlaymiz.
  useEffect(() => {
    if (!offer) return;
    setAmount('');
    setAddress('');
    setMemo('');
    setDone(false);
    setNetwork(offer.networks.length === 1 ? offer.networks[0] : '');
  }, [offer]);

  const amountNum = Number(amount.replace(',', '.'));
  const amountOk =
    offer !== null &&
    Number.isFinite(amountNum) &&
    amountNum >= offer.minAmount &&
    amountNum <= offer.maxAmount;

  const addressTrimmed = address.trim();
  const addressRe = network ? ADDRESS_RE[network] : undefined;
  const addressOk = addressTrimmed.length > 0 && (!addressRe || addressRe.test(addressTrimmed));

  const total = useMemo(() => {
    if (!offer || !amountOk) return 0;
    return Math.round((amountNum * offer.pricePerUnit) / 100) * 100;
  }, [offer, amountNum, amountOk]);

  const valid = amountOk && !!network && addressOk;

  const buy = useMutation({
    mutationFn: () =>
      apiBuyCrypto({
        asset: offer!.asset,
        amount: amountNum,
        network,
        address: addressTrimmed,
        memo: memo.trim() || undefined,
      }),
    onSuccess: () => {
      haptic('success');
      void qc.invalidateQueries({ queryKey: ['me'] });
      void qc.invalidateQueries({ queryKey: ['crypto-orders'] });
      setDone(true);
    },
    onError: (err: Error) => {
      haptic('error');
      toast.error(err.message);
    },
  });

  return (
    <Sheet open={offer !== null} onClose={onClose} title={offer ? `${offer.asset} sotib olish` : ''}>
      {done ? (
        <div className="pb-6 pt-2 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--color-success)]/12">
            <CheckCircle2 size={30} className="text-[var(--color-success)]" />
          </div>
          <h3 className="mt-3 text-lg font-bold">
            {ru ? 'Заказ принят' : 'Buyurtma qabul qilindi'}
          </h3>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {ru
              ? 'Отправим на ваш кошелёк в ближайшее время.'
              : 'Yaqin vaqt ichida hamyoningizga yuboramiz.'}
          </p>
          <Button
            fullWidth
            className="mt-5"
            onClick={() => {
              onClose();
              router.push('/orders');
            }}
          >
            {ru ? 'К заказам' : 'Buyurtmalarga'}
          </Button>
        </div>
      ) : offer ? (
        <div className="space-y-4 pb-6">
          {/* Miqdor */}
          <div>
            <label className="text-sm font-medium">
              {ru ? 'Количество' : 'Miqdor'} ({offer.asset})
            </label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder={String(offer.minAmount)}
              className="mt-1.5 h-12 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-transparent focus:ring-2 focus:ring-[var(--color-primary)]"
            />
            <p
              className={cn(
                'mt-1.5 text-xs',
                amount && !amountOk
                  ? 'text-[var(--color-danger)]'
                  : 'text-[var(--color-text-muted)]',
              )}
            >
              {ru ? 'От' : ''} {offer.minAmount} — {offer.maxAmount} {offer.asset}
            </p>
          </div>

          {/* Tarmoq */}
          {offer.networks.length > 1 && (
            <div>
              <label className="text-sm font-medium">{ru ? 'Сеть' : 'Tarmoq'}</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {offer.networks.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNetwork(n)}
                    className={cn(
                      'rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors',
                      network === n
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                        : 'border-[var(--color-border)] bg-white text-[var(--color-text-muted)]',
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Manzil */}
          <div>
            <label className="text-sm font-medium">
              {ru ? 'Адрес кошелька' : 'Hamyon manzili'}
            </label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder={network === 'TRC20' ? 'T...' : network === 'TON' ? 'UQ...' : '0x...'}
              className="mt-1.5 h-12 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 text-[13px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-transparent focus:ring-2 focus:ring-[var(--color-primary)]"
            />
            {address && !addressOk && (
              <p className="mt-1.5 text-xs text-[var(--color-danger)]">
                {ru ? 'Адрес не подходит для сети' : 'Manzil bu tarmoqqa mos emas'} {network}
              </p>
            )}
          </div>

          {/* Memo — TON uchun ba'zi birjalar talab qiladi */}
          {network === 'TON' && (
            <div>
              <label className="text-sm font-medium">
                Memo / Tag{' '}
                <span className="font-normal text-[var(--color-text-muted)]">
                  ({ru ? 'если требуется' : 'kerak bo‘lsa'})
                </span>
              </label>
              <input
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="mt-1.5 h-12 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 outline-none focus:border-transparent focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
          )}

          {/* Ogohlantirish — noto'g'ri tarmoq = pul yo'qoladi */}
          <div className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2.5">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />
            <p className="text-[11px] leading-relaxed text-amber-800">
              {ru
                ? 'Проверьте адрес и сеть. Средства, отправленные в другую сеть, вернуть невозможно.'
                : "Manzil va tarmoqni tekshiring. Boshqa tarmoqqa yuborilgan mablag'ni qaytarib bo'lmaydi."}
            </p>
          </div>

          {/* Jami */}
          <div className="flex items-center justify-between rounded-2xl bg-[var(--color-bg)] px-4 py-3">
            <span className="text-sm text-[var(--color-text-muted)]">
              {ru ? 'К оплате' : "To'lov"}
            </span>
            <span className="text-base font-bold text-[var(--color-primary)]">
              {total > 0 ? formatMoney(total, locale) : '—'}
            </span>
          </div>

          <Button fullWidth loading={buy.isPending} disabled={!valid} onClick={() => buy.mutate()}>
            {ru ? 'Купить' : 'Sotib olish'}
          </Button>
        </div>
      ) : null}
    </Sheet>
  );
}
