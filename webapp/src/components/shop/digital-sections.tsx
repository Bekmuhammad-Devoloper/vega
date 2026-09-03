'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Star, Crown, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  apiBuyDigital,
  apiDigitalStorefront,
  apiGetMe,
  apiRecipientPreview,
} from '@/lib/api/endpoints';
import { useLocaleStore } from '@/stores/locale-store';
import { getMessages, tr, type Locale } from '@/i18n';
import { formatMoney } from '@/lib/format';
import { haptic } from '@/lib/telegram';
import { toast } from '@/stores/toast-store';
import { cn } from '@/lib/cn';
import type { DigitalKind, DigitalProduct } from '@/lib/api/types';

const USERNAME_RE = /^[a-zA-Z0-9_]{4,32}$/;

interface Selection {
  kind: DigitalKind;
  product: DigitalProduct;
}

export function DigitalSections() {
  const locale = useLocaleStore((s) => s.locale);
  const messages = getMessages(locale);

  const { data } = useQuery({
    queryKey: ['digital-storefront'],
    queryFn: apiDigitalStorefront,
  });

  const [selected, setSelected] = useState<Selection | null>(null);

  const showStars = Boolean(data?.starsEnabled) && (data?.stars?.length ?? 0) > 0;
  const showPremium = Boolean(data?.premiumEnabled) && (data?.premium?.length ?? 0) > 0;

  if (!showStars && !showPremium) return null;

  const pick = (kind: DigitalKind, product: DigitalProduct) => {
    haptic('light');
    setSelected({ kind, product });
  };

  return (
    <div className="px-4 pb-6 space-y-6">
      {showStars && (
        <Section
          icon={<Star size={18} className="text-amber-500" fill="currentColor" />}
          title={tr(messages, 'digital.stars')}
          products={data!.stars}
          onPick={(p) => pick('STARS', p)}
          locale={locale}
        />
      )}
      {showPremium && (
        <Section
          icon={<Crown size={18} className="text-[var(--color-primary)]" fill="currentColor" />}
          title={tr(messages, 'digital.premium')}
          products={data!.premium}
          onPick={(p) => pick('PREMIUM', p)}
          locale={locale}
        />
      )}
      <BuySheet selection={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function Section({
  icon,
  title,
  products,
  onPick,
  locale,
}: {
  icon: React.ReactNode;
  title: string;
  products: DigitalProduct[];
  onPick: (p: DigitalProduct) => void;
  locale: Locale;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2.5">
        {icon}
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      <ul className="space-y-2.5">
        {products.map((p) => (
          <li key={p.productId}>
            <button
              onClick={() => onPick(p)}
              className="w-full bg-white rounded-2xl border border-[var(--color-border)] p-3.5 flex items-center gap-3 active:scale-[0.99] transition-transform text-left"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{p.label}</p>
                <p className="text-sm font-bold text-[var(--color-primary)]">
                  {formatMoney(p.retailPrice, locale)}
                </p>
              </div>
              <ChevronRight size={18} className="text-[var(--color-text-muted)] shrink-0" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BuySheet({
  selection,
  onClose,
}: {
  selection: Selection | null;
  onClose: () => void;
}) {
  const locale = useLocaleStore((s) => s.locale);
  const messages = getMessages(locale);
  const router = useRouter();
  const qc = useQueryClient();

  const [username, setUsername] = useState('');
  const [done, setDone] = useState(false);
  // Foydalanuvchi maydonga tegdimi — tegan bo'lsa avto-to'ldirish ustiga yozmaydi.
  const [touched, setTouched] = useState(false);

  // Ko'p holatda mijoz O'ZIGA oladi, shuning uchun o'z username'ini
  // qo'lda yozib o'tirmasin — oldindan qo'yib beramiz.
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: apiGetMe });

  // Har yangi paket ochilganda formani tiklaymiz
  useEffect(() => {
    if (selection) {
      setUsername(me?.username ?? '');
      setTouched(false);
      setDone(false);
    }
    // `me` ataylab bog'liqlikda emas: u kechroq kelsa quyidagi effekt to'ldiradi,
    // bu yerda esa har yangilanishda foydalanuvchi yozganini o'chirib yubormaymiz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  // `me` so'rovi varaq ochilgandan keyin kelsa ham to'ldirilsin.
  useEffect(() => {
    if (selection && !touched && me?.username) setUsername(me.username);
  }, [me?.username, selection, touched]);

  const clean = username.trim().replace(/^@+/, '');
  const valid = USERNAME_RE.test(clean);

  const buy = useMutation({
    mutationFn: () =>
      apiBuyDigital({ digitalProductId: selection!.product.productId, username: clean }),
    onSuccess: () => {
      haptic('success');
      qc.invalidateQueries({ queryKey: ['me'] });
      qc.invalidateQueries({ queryKey: ['digital-orders'] });
      setDone(true);
    },
    onError: (err: Error) => {
      haptic('error');
      toast.error(err.message);
    },
  });

  const product = selection?.product ?? null;

  return (
    <Sheet open={selection !== null} onClose={onClose} title={product?.label}>
      {done ? (
        <div className="pb-6 pt-2 text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-[var(--color-success)]/12 grid place-items-center">
            <CheckCircle2 size={30} className="text-[var(--color-success)]" />
          </div>
          <h3 className="mt-3 font-bold text-lg">{tr(messages, 'digital.successTitle')}</h3>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {tr(messages, 'digital.successHint')}
          </p>
          <Button
            fullWidth
            className="mt-5"
            onClick={() => {
              onClose();
              router.push('/orders');
            }}
          >
            {tr(messages, 'digital.toOrders')}
          </Button>
        </div>
      ) : product ? (
        <div className="pb-6 space-y-4">
          {/* @username kiritish */}
          <div>
            <label className="text-sm font-medium">{tr(messages, 'digital.username')}</label>
            <div className="mt-1.5 flex items-center h-12 px-4 rounded-2xl border border-[var(--color-border)] bg-white focus-within:ring-2 focus-within:ring-[var(--color-primary)] focus-within:border-transparent">
              <span className="text-[var(--color-text-muted)] select-none">@</span>
              <input
                value={username}
                onChange={(e) => {
                  setTouched(true);
                  setUsername(e.target.value);
                }}
                placeholder={tr(messages, 'digital.usernamePlaceholder')}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                inputMode="text"
                className="flex-1 ml-1 bg-transparent outline-none text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]"
              />
            </div>
            <p
              className={cn(
                'text-xs mt-1.5',
                username && !valid
                  ? 'text-[var(--color-danger)]'
                  : 'text-[var(--color-text-muted)]',
              )}
            >
              {username && !valid
                ? tr(messages, 'digital.usernameInvalid')
                : tr(messages, 'digital.usernameHint')}
            </p>

            {/* Kim olishini KO'RSATAMIZ — bitta harf xato bo'lsa Stars
                begona odamga ketadi va qaytarib bo'lmaydi. */}
            {valid && <RecipientCard username={clean} locale={locale} />}
          </div>

          {/* Narx */}
          <div className="flex items-center justify-between rounded-2xl bg-[var(--color-bg)] px-4 py-3">
            <span className="text-sm text-[var(--color-text-muted)]">
              {tr(messages, 'digital.price')}
            </span>
            <span className="text-base font-bold text-[var(--color-primary)]">
              {formatMoney(product.retailPrice, locale)}
            </span>
          </div>

          <Button
            fullWidth
            loading={buy.isPending}
            disabled={!valid}
            onClick={() => buy.mutate()}
          >
            {tr(messages, 'digital.confirm')}
          </Button>
        </div>
      ) : null}
    </Sheet>
  );
}

/**
 * Qabul qiluvchi akkaunt: avatar + ism. O'z akkaunti bo'lsa Telegram'dan
 * kelgan ma'lumot ishlatiladi (darhol, so'rovsiz); boshqasi uchun server
 * `t.me` sahifasidan oladi.
 *
 * Profil rasmi yopiq bo'lsa rasm o'rniga ism harfi ko'rsatiladi — umumiy
 * Telegram logosini avatar deb ko'rsatish mijozni chalg'itardi.
 */
function RecipientCard({ username, locale }: { username: string; locale: Locale }) {
  const ru = locale === 'ru';
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: apiGetMe });
  const isSelf = !!me?.username && me.username.toLowerCase() === username.toLowerCase();

  const { data, isFetching } = useQuery({
    queryKey: ['recipient', username.toLowerCase()],
    queryFn: () => apiRecipientPreview(username),
    enabled: !isSelf,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const name = isSelf ? (me?.firstName ?? me?.username ?? null) : (data?.name ?? null);
  const photo = isSelf ? (me?.photoUrl ?? null) : (data?.photoUrl ?? null);
  const found = isSelf ? true : data?.found;

  if (!isSelf && isFetching && !data) {
    return (
      <div className="mt-2.5 flex items-center gap-3 rounded-2xl bg-[var(--color-bg)] px-3 py-2.5">
        <div className="h-9 w-9 animate-pulse rounded-full bg-[var(--color-border)]" />
        <div className="h-3 w-24 animate-pulse rounded bg-[var(--color-border)]" />
      </div>
    );
  }

  if (found === false) {
    return (
      <div className="mt-2.5 flex items-center gap-2 rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/8 px-3 py-2.5">
        <AlertCircle size={16} className="shrink-0 text-[var(--color-danger)]" />
        <span className="text-xs text-[var(--color-danger)]">
          {ru ? 'Аккаунт не найден' : 'Bunday akkaunt topilmadi'}
        </span>
      </div>
    );
  }

  if (!found) return null;

  return (
    <div className="mt-2.5 flex items-center gap-3 rounded-2xl bg-[var(--color-bg)] px-3 py-2.5">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt=""
          className="h-9 w-9 shrink-0 rounded-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-primary)] text-sm font-bold text-white">
          {(name ?? username).charAt(0).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{name ?? '@' + username}</p>
        <p className="truncate text-xs text-[var(--color-text-muted)]">
          @{username}
          {isSelf && <span className="ml-1">· {ru ? 'это вы' : "bu sizsiz"}</span>}
        </p>
      </div>
      <CheckCircle2 size={17} className="shrink-0 text-[var(--color-success)]" />
    </div>
  );
}
