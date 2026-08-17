'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Smartphone,
  Globe2,
  HelpCircle,
  Info,
  Phone,
  ChevronRight,
  Wallet,
  Plus,
  Copy,
  Check,
  Upload,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/shop/page-header';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Flag } from '@/components/flag';
import {
  apiGetMe,
  apiPublicSettings,
  apiUpdateMe,
  apiListNumberOrders,
  apiTopupBalance,
} from '@/lib/api/endpoints';
import { toast } from '@/stores/toast-store';
import { useTelegramBackButton, useTelegramUser } from '@/hooks/use-telegram';
import { useTrackOnMount } from '@/hooks/use-track';
import { useLocaleStore } from '@/stores/locale-store';
import { getMessages, tr } from '@/i18n';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Locale } from '@/i18n';

export default function ProfilePage() {
  useTelegramBackButton();
  useTrackOnMount({ type: 'VIEW_PROFILE' });
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const messages = getMessages(locale);
  const tgUser = useTelegramUser();
  const qc = useQueryClient();
  const router = useRouter();

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: apiGetMe });
  const { data: settings } = useQuery({ queryKey: ['public-settings'], queryFn: apiPublicSettings });
  const { data: orders } = useQuery({ queryKey: ['number-orders'], queryFn: apiListNumberOrders });

  const updateLang = useMutation({
    mutationFn: (language: Locale) => apiUpdateMe({ language }),
    onSuccess: (m) => qc.setQueryData(['me'], m),
  });

  const [langOpen, setLangOpen] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);

  const displayName =
    me?.firstName ?? tgUser?.first_name ?? me?.username ?? tr(messages, 'profile.guest');
  const subline = me?.username ? `@${me.username}` : '';
  const initials = (displayName ?? '?').slice(0, 1).toUpperCase();
  const avatarUrl = me?.photoUrl ?? tgUser?.photo_url;
  const ordersCount = orders?.length ?? 0;
  const storePhone = settings?.store.phone;

  return (
    <div className="pb-6">
      <PageHeader title={tr(messages, 'profile.title')} backHref="/" />

      {/* Hero: foydalanuvchi + balans */}
      <section className="px-4 pt-4">
        <div className="bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] rounded-3xl p-5 text-white shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-white/20 backdrop-blur grid place-items-center text-lg font-bold overflow-hidden ring-2 ring-white/30 shrink-0">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold truncate">{displayName}</p>
              {subline && <p className="text-sm text-white/85 truncate">{subline}</p>}
            </div>
          </div>

          {/* Balans */}
          <div className="mt-4 bg-white/15 backdrop-blur rounded-2xl p-4">
            <div className="flex items-center gap-2 text-white/85 text-xs font-medium">
              <Wallet size={14} />
              {tr(messages, 'balance.title')}
            </div>
            <div className="flex items-end justify-between gap-3 mt-1">
              <p className="text-2xl font-extrabold tabular-nums">
                {formatMoney(me?.balance ?? 0, locale)}
              </p>
              <button
                onClick={() => setTopUpOpen(true)}
                className="h-9 px-3.5 rounded-xl bg-white text-[var(--color-primary)] text-sm font-bold inline-flex items-center gap-1 active:scale-95 transition-transform"
              >
                <Plus size={16} />
                {tr(messages, 'balance.topUp')}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Buyurtmalar */}
      <section className="px-4 mt-4">
        <MenuCard>
          <li>
            <Link
              href="/orders"
              className="w-full px-4 h-14 flex items-center gap-3 active:bg-gray-50"
            >
              <span className="text-[var(--color-text-muted)]">
                <Smartphone size={20} />
              </span>
              <span className="flex-1 text-sm font-medium">{tr(messages, 'order.title')}</span>
              {ordersCount > 0 && (
                <span className="text-sm font-bold tabular-nums text-[var(--color-text-muted)]">
                  {ordersCount}
                </span>
              )}
              <ChevronRight size={18} className="text-[var(--color-text-muted)]" />
            </Link>
          </li>
        </MenuCard>
      </section>

      {/* Aloqa */}
      <section className="px-4 mt-3">
        <MenuCard>
          <MenuRow href="/support" icon={<HelpCircle size={20} />} label={tr(messages, 'profile.support')} />
          <MenuRow href="/about" icon={<Info size={20} />} label={tr(messages, 'profile.about')} />
          {storePhone && (
            <li>
              <a href={`tel:${storePhone}`} className="w-full px-4 h-14 flex items-center gap-3">
                <span className="text-[var(--color-text-muted)]">
                  <Phone size={20} />
                </span>
                <span className="flex-1 text-sm font-medium">{tr(messages, 'profile.contact')}</span>
                <span className="text-sm text-[var(--color-text-muted)]">{storePhone}</span>
                <ChevronRight size={18} className="text-[var(--color-text-muted)]" />
              </a>
            </li>
          )}
        </MenuCard>
      </section>

      {/* Sozlamalar */}
      <section className="px-4 mt-3">
        <MenuCard>
          <li>
            <button
              onClick={() => setLangOpen(true)}
              className="w-full px-4 h-14 flex items-center gap-3 text-left"
            >
              <span className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-400 via-white to-green-500 ring-1 ring-[var(--color-border)] grid place-items-center">
                <Globe2 size={14} className="text-gray-700" />
              </span>
              <span className="flex-1 text-sm font-medium">{tr(messages, 'profile.language')}</span>
              <span className="text-sm text-[var(--color-text-muted)]">
                {locale === 'ru' ? tr(messages, 'language.ru') : tr(messages, 'language.uz')}
              </span>
              <ChevronRight size={18} className="text-[var(--color-text-muted)]" />
            </button>
          </li>
        </MenuCard>
      </section>

      <p className="text-center text-xs text-[var(--color-text-muted)] mt-6">v 1.0.0</p>

      {/* Til tanlash */}
      <Sheet open={langOpen} onClose={() => setLangOpen(false)} title={tr(messages, 'language.title')}>
        <div className="space-y-2 py-2">
          {(['uz', 'ru'] as const).map((lng) => (
            <button
              key={lng}
              onClick={() => {
                setLocale(lng);
                updateLang.mutate(lng);
                setLangOpen(false);
              }}
              className={cn(
                'w-full h-12 px-4 rounded-2xl border text-left',
                locale === lng
                  ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                  : 'bg-white border-[var(--color-border)]',
              )}
            >
              <span className="inline-flex items-center gap-2.5">
                <Flag code={lng} className="h-4 w-6 rounded-[3px] shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" />
                {lng === 'uz' ? "O'zbekcha" : 'Русский'}
              </span>
            </button>
          ))}
        </div>
      </Sheet>

      {/* Balansni to'ldirish */}
      <TopUpSheet
        open={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        card={settings?.cardPayment ?? null}
        phone={storePhone}
        locale={locale}
        onSupport={() => {
          setTopUpOpen(false);
          router.push('/support');
        }}
        onDone={() => qc.invalidateQueries({ queryKey: ['me'] })}
      />
    </div>
  );
}

function TopUpSheet({
  open,
  onClose,
  card,
  phone,
  locale,
  onSupport,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  card: { number: string; holder: string } | null;
  phone?: string;
  locale: Locale;
  onSupport: () => void;
  onDone: () => void;
}) {
  const t = (uz: string, ru: string) => (locale === 'ru' ? ru : uz);
  const fileRef = useRef<HTMLInputElement>(null);
  const [amountText, setAmountText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const amount = Number(amountText.replace(/\D/g, '')) || 0;
  const fmt = (n: number) =>
    n ? new Intl.NumberFormat('ru-RU').format(n).replace(/,/g, ' ') : '';
  const cardDigits = (card?.number ?? '').replace(/\D/g, '');
  const brand = cardDigits.startsWith('8600')
    ? 'UZCARD'
    : cardDigits.startsWith('9860')
      ? 'HUMO'
      : 'BANK';

  const submit = useMutation({
    mutationFn: () => apiTopupBalance(amount, file as File),
    onSuccess: () => {
      toast.success(
        t(
          "So'rov yuborildi — tasdiqlanishini kuting",
          'Заявка отправлена — ожидайте подтверждения',
        ),
      );
      setAmountText('');
      setFile(null);
      setPreview(null);
      onDone();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }
  function copyCard() {
    const num = (card?.number ?? '').replace(/\s/g, '');
    if (!num) return;
    navigator.clipboard?.writeText(num).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const valid = amount >= 1000 && !!file;

  return (
    <Sheet open={open} onClose={onClose} title={t("Balansni to'ldirish", 'Пополнить баланс')}>
      {card ? (
        <div className="py-2 space-y-3">
          {/* Plastik karta */}
          <div>
            <p className="mb-1.5 text-sm font-medium">
              {t("Shu kartaga o'tkazing", 'Переведите на карту')}
            </p>
            <div
              className="relative w-full aspect-[1.75/1] rounded-2xl p-4 text-white overflow-hidden shadow-xl shadow-black/25 select-none"
              style={{ background: 'linear-gradient(135deg,#0f2027 0%,#203a43 50%,#2c5364 100%)' }}
            >
              <div
                className="pointer-events-none absolute inset-0"
                style={{ background: 'radial-gradient(130% 130% at 0% 0%, rgba(255,255,255,.14), transparent 42%)' }}
              />
              <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-40 rotate-[25deg] bg-white/5 blur-2xl" />

              {/* Yuqori: brend + kontaktsiz + nusxa */}
              <div className="relative flex items-start justify-between">
                <span className="text-sm font-bold tracking-[0.2em] opacity-90">{brand}</span>
                <div className="flex items-center gap-2">
                  <svg width="18" height="22" viewBox="0 0 18 22" fill="none" className="opacity-80" aria-hidden>
                    <path d="M4 7a7 7 0 0 1 0 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M7.5 4.5a11 11 0 0 1 0 13" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M11 2a15 15 0 0 1 0 18" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <button
                    onClick={copyCard}
                    className="h-8 w-8 grid place-items-center rounded-lg bg-white/15 backdrop-blur active:bg-white/25 shrink-0"
                    aria-label="copy"
                  >
                    {copied ? <Check size={15} /> : <Copy size={15} />}
                  </button>
                </div>
              </div>

              {/* Chip */}
              <div className="relative mt-3">
                <svg width="44" height="33" viewBox="0 0 46 34" fill="none" aria-hidden>
                  <rect x="1" y="1" width="44" height="32" rx="6" fill="url(#chipCust)" stroke="#b4890f" strokeOpacity=".4" />
                  <path d="M16 1v32M30 1v32M1 12h44M1 22h44" stroke="#8a6d0b" strokeOpacity=".45" strokeWidth="1" />
                  <rect x="16" y="12" width="14" height="10" rx="2" fill="#fde68a" fillOpacity=".7" stroke="#8a6d0b" strokeOpacity=".4" />
                  <defs>
                    <linearGradient id="chipCust" x1="0" y1="0" x2="1" y2="1">
                      <stop stopColor="#fde68a" />
                      <stop offset="1" stopColor="#caa02c" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              {/* Raqam */}
              <p
                className="relative mt-3 text-xl font-semibold tracking-[0.14em] tabular-nums"
                style={{ textShadow: '0 1px 2px rgba(0,0,0,.35)' }}
              >
                {card.number}
              </p>

              {/* Egasi */}
              <div className="relative mt-2">
                <p className="text-[9px] uppercase tracking-widest opacity-55">
                  {t('Karta egasi', 'Держатель')}
                </p>
                <p className="text-sm font-medium uppercase tracking-wide truncate">{card.holder}</p>
              </div>
            </div>
          </div>

          {/* Summa */}
          <div>
            <p className="mb-1.5 text-sm font-medium">
              {t("Qancha o'tkazdingiz? (so'm)", 'Сколько перевели? (сум)')}
            </p>
            <input
              inputMode="numeric"
              value={amountText}
              onChange={(e) => setAmountText(fmt(Number(e.target.value.replace(/\D/g, '')) || 0))}
              placeholder="50 000"
              className="w-full h-12 rounded-2xl border border-[var(--color-border)] bg-white px-3.5 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </div>

          {/* Chek */}
          <div>
            <p className="mb-1.5 text-sm font-medium">
              {t("To'lov cheki (rasm)", 'Чек оплаты (фото)')}
            </p>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />
            {preview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="chek"
                  className="w-full max-h-56 rounded-xl object-contain border border-[var(--color-border)] bg-gray-50"
                />
                <button
                  onClick={() => {
                    setFile(null);
                    setPreview(null);
                  }}
                  className="absolute top-2 right-2 h-8 w-8 grid place-items-center rounded-full bg-black/60 text-white"
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-xl border-2 border-dashed border-[var(--color-border)] py-6 grid place-items-center gap-1.5 text-[var(--color-text-muted)] active:bg-gray-50"
              >
                <Upload size={22} />
                <span className="text-sm font-medium">
                  {t('Chek rasmini yuklash', 'Загрузить чек')}
                </span>
              </button>
            )}
          </div>

          <Button
            fullWidth
            size="lg"
            loading={submit.isPending}
            disabled={!valid}
            onClick={() => submit.mutate()}
          >
            {t("So'rov yuborish", 'Отправить заявку')}
          </Button>
          <p className="text-center text-xs text-[var(--color-text-muted)]">
            {t(
              "Tasdiqlangach balansingizga qo'shiladi.",
              'После подтверждения зачислится на баланс.',
            )}
          </p>
        </div>
      ) : (
        <div className="py-2 space-y-4">
          <p className="text-sm text-[var(--color-text-muted)]">
            {t(
              "Balansni to'ldirish uchun do'kon bilan bog'laning.",
              'Свяжитесь с магазином для пополнения баланса.',
            )}
          </p>
          <div className="space-y-2">
            {phone && (
              <Button
                fullWidth
                size="lg"
                onClick={() => {
                  window.location.href = `tel:${phone}`;
                }}
              >
                <Phone size={18} /> {phone}
              </Button>
            )}
            <Button fullWidth size="lg" variant="secondary" onClick={onSupport}>
              <HelpCircle size={18} /> {t('Yordam', 'Помощь')}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function MenuCard({ children }: { children: React.ReactNode }) {
  return (
    <ul className="bg-white rounded-2xl border border-[var(--color-border)] divide-y divide-[var(--color-border)] overflow-hidden">
      {children}
    </ul>
  );
}

function MenuRow({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <li>
      <Link href={href} className="w-full px-4 h-14 flex items-center gap-3 active:bg-gray-50">
        <span className="text-[var(--color-text-muted)]">{icon}</span>
        <span className="flex-1 text-sm font-medium">{label}</span>
        <ChevronRight size={18} className="text-[var(--color-text-muted)]" />
      </Link>
    </li>
  );
}
