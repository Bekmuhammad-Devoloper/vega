'use client';

import { useQuery } from '@tanstack/react-query';
import {
  MapPin,
  Clock,
  Phone,
  Send,
  MessageCircle,
  Code2,
  ArrowRight,
  Zap,
  Sparkles,
  CreditCard,
  Megaphone,
  Star,
  BarChart3,
  Bot,
  Globe,
  Smartphone,
  Layers,
  Rocket,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/shop/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { apiPublicSettings } from '@/lib/api/endpoints';
import { useTelegramBackButton } from '@/hooks/use-telegram';
import { useLocaleStore } from '@/stores/locale-store';
import { getMessages, tr } from '@/i18n';
import { getWebApp } from '@/lib/telegram';

/** Yuksalish Development — ishlab chiquvchi jamoa kontaktlari. */
const DEV = {
  channel: 'https://t.me/Yuksalishdev_ITjobs',
  dm: 'https://t.me/Yuksalish_development',
  phone: '+998 33 015 26 01',
  phoneHref: 'tel:+998330152601',
};
const VEGA_BOT = 'https://t.me/Vega_uzbot';
const BRAND = '#2F6BFF';

/** t.me havolasini Telegram ichida ochadi (Mini App), aks holda yangi oynada. */
function openTg(url: string): void {
  const wa = getWebApp();
  if (wa?.openTelegramLink) wa.openTelegramLink(url);
  else if (typeof window !== 'undefined') window.open(url, '_blank');
}

export default function AboutPage() {
  useTelegramBackButton();
  const locale = useLocaleStore((s) => s.locale);
  const messages = getMessages(locale);
  const ru = locale === 'ru';

  const { data: settings, isLoading, isError, refetch } = useQuery({
    queryKey: ['public-settings'],
    queryFn: apiPublicSettings,
  });

  const store = settings?.store;
  const brand = store?.primaryColor || BRAND;

  return (
    <div>
      <PageHeader title={tr(messages, 'about.title')} />
      <div className="mx-auto max-w-md px-4 py-4 space-y-5">
        {isLoading ? (
          <>
            <Skeleton className="h-52 rounded-3xl" />
            <Skeleton className="h-44 rounded-3xl" />
            <Skeleton className="h-44 rounded-3xl" />
          </>
        ) : isError || !settings ? (
          <div className="rounded-2xl border border-[var(--color-border)] bg-white p-6 text-center space-y-3">
            <p className="text-sm text-[var(--color-text-muted)]">
              {ru ? 'Не удалось загрузить' : "Yuklab bo'lmadi"}
            </p>
            <Button size="sm" variant="secondary" onClick={() => refetch()}>
              {ru ? 'Повторить' : 'Qaytadan urinish'}
            </Button>
          </div>
        ) : (
          <>
            {/* ───────── 01 · DO'KON ───────── */}
            <SectionLabel index="01" text={ru ? 'Магазин' : "Do'kon"} />
            <section className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
              {/* sarlavha: logo + nom + tasdiq */}
              <div className="flex items-center gap-3.5">
                {store?.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={store.logoUrl}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-2xl border-2 object-cover"
                    style={{ borderColor: brand }}
                  />
                ) : (
                  <span
                    className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-[26px] font-extrabold text-white"
                    style={{ background: brand }}
                  >
                    {(store?.name || 'V').trim().charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <h2 className="truncate text-[19px] font-extrabold leading-tight text-[var(--color-text)]">
                    {store?.name || (ru ? 'Магазин' : "Do'kon")}
                  </h2>
                  <span
                    className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ backgroundColor: `${brand}1a`, color: brand }}
                  >
                    <ShieldCheck size={11} />
                    {ru ? 'Официальный магазин' : 'Rasmiy do‘kon'}
                  </span>
                </div>
              </div>

              {/* tavsif — mijoz do'koni virtual raqam sotadi (about sozlanmagan bo'lsa) */}
              <p className="mt-4 whitespace-pre-line text-[13.5px] leading-relaxed text-[var(--color-text)]/80">
                {store?.about ||
                  (ru
                    ? `${store?.name || 'Магазин'} — виртуальные номера для Telegram и других сервисов. Коды подтверждения приходят за секунды. Надёжно, круглосуточно.`
                    : `${store?.name || "Do'kon"} — Telegram va boshqa xizmatlar uchun virtual raqamlar. Tasdiqlash kodlari soniyalarda keladi. Ishonchli, 24/7.`)}
              </p>

              {/* ma'lumotlar — telefon birinchi (asosiy aloqa) */}
              <div className="mt-4 space-y-2">
                {store?.phone && (
                  <a
                    href={`tel:${store.phone}`}
                    className="flex items-center gap-3 rounded-2xl px-3 py-3 transition-opacity active:opacity-80"
                    style={{ backgroundColor: `${brand}12` }}
                  >
                    <span
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white"
                      style={{ background: brand }}
                    >
                      <Phone size={17} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11px] text-[var(--color-text-muted)]">
                        {ru ? 'Телефон' : 'Telefon'}
                      </span>
                      <span className="block text-[15px] font-bold" style={{ color: brand }}>
                        {store.phone}
                      </span>
                    </span>
                  </a>
                )}
                {store?.mainChannelUrl && (
                  <LinkRow
                    icon={Megaphone}
                    label={ru ? 'Основной канал' : 'Asosiy kanal'}
                    sub={tgHandle(store.mainChannelUrl)}
                    brand={brand}
                    onClick={() => openTg(store.mainChannelUrl!)}
                  />
                )}
                {store?.reviewChannelUrl && (
                  <LinkRow
                    icon={Star}
                    label={ru ? 'Канал отзывов' : 'Otziv kanali'}
                    sub={tgHandle(store.reviewChannelUrl)}
                    brand={brand}
                    onClick={() => openTg(store.reviewChannelUrl!)}
                  />
                )}
                {store?.adminContactUrl && (
                  <LinkRow
                    icon={MessageCircle}
                    label={ru ? 'Связаться с админом' : 'Admin bilan bogʻlanish'}
                    sub={tgHandle(store.adminContactUrl)}
                    brand={brand}
                    onClick={() => openTg(store.adminContactUrl!)}
                  />
                )}
                {store?.address && (
                  <InfoRow icon={MapPin} label={ru ? 'Адрес' : 'Manzil'} value={store.address} />
                )}
                {store?.workingHours && (
                  <InfoRow
                    icon={Clock}
                    label={ru ? 'Часы работы' : 'Ish vaqti'}
                    value={store.workingHours}
                  />
                )}
              </div>
            </section>

            {/* ───────── 02 · VEGA PLATFORMASI ───────── */}
            <SectionLabel index="02" text="Vega" />
            <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#0A6CFF] to-[#0A2E8C] text-white shadow-md">
              <div className="p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-2xl bg-white/15 backdrop-blur">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/vega-logo.png" alt="Vega" className="h-9 w-9 object-contain" />
                  </span>
                  <div className="min-w-0">
                    <p
                      className="text-[26px] leading-none"
                      style={{ fontFamily: "'Pacifico', cursive" }}
                    >
                      Vega
                    </p>
                    <p className="mt-1 text-[12px] text-white/75">
                      {ru
                        ? 'Магазин в Telegram — за минуты'
                        : "Telegram'da do'kon — daqiqalarda"}
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-[13.5px] leading-relaxed text-white/90">
                  {ru
                    ? 'Этот магазин работает на Vega — платформе для продажи Telegram-номеров, Stars и Premium. Свой магазин и бот — за минуты, без кода.'
                    : "Bu do'kon Vega platformasida ishlaydi — Telegram raqam, Stars va Premium sotish tizimi. O'z do'kon va boti — daqiqalarda, kodsiz."}
                </p>

                {/* imkoniyatlar gridi */}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {VEGA_FEATURES(ru).map((f) => (
                    <div
                      key={f.label}
                      className="flex items-center gap-2 rounded-xl bg-white/10 px-2.5 py-2 backdrop-blur"
                    >
                      <f.icon size={15} className="shrink-0 text-white/90" />
                      <span className="text-[11.5px] font-medium leading-tight">{f.label}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center gap-1.5 text-[11px] text-white/70">
                  <Zap size={12} />
                  {ru
                    ? 'Тарифы: FREE · STANDART · PREMIUM'
                    : 'Tariflar: FREE · STANDART · PREMIUM'}
                </div>
              </div>

              <button
                type="button"
                onClick={() => openTg(VEGA_BOT)}
                className="flex w-full items-center justify-center gap-2 border-t border-white/15 bg-white/10 py-3.5 text-[14px] font-bold transition-colors active:bg-white/20"
              >
                {ru ? 'Открыть свой магазин' : "O'z do'koningizni oching"}
                <ArrowRight size={16} />
              </button>
            </section>

            {/* ───────── 03 · BIZ HAQIMIZDA · YUKSALISH DEVELOPMENT ───────── */}
            <SectionLabel index="03" text={ru ? 'Команда' : 'Biz haqimizda'} />
            <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B1220] to-[#1E293B] text-white shadow-md">
              <div className="p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-[#60A5FA] backdrop-blur">
                    <Code2 size={24} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[18px] font-extrabold leading-tight">Yuksalish Development</p>
                    <p className="mt-0.5 text-[12px] text-white/60">
                      {ru ? 'Студия цифровых продуктов' : 'Raqamli mahsulotlar studiyasi'}
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-[13.5px] leading-relaxed text-white/80">
                  {ru
                    ? 'Мы — команда, создавшая Vega. Разрабатываем Telegram-ботов, сайты, мобильные приложения и бизнес-системы под ключ. Превращаем вашу идею в работающий продукт.'
                    : "Biz — Vega'ni yaratgan jamoa. Telegram botlar, web saytlar, mobil ilovalar va biznes-tizimlarni kalit topshiriq tarzda ishlab chiqamiz. G'oyangizni ishlaydigan mahsulotga aylantiramiz."}
                </p>

                {/* xizmatlar */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {DEV_SERVICES(ru).map((s) => (
                    <span
                      key={s.label}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11.5px] font-medium text-white/90"
                    >
                      <s.icon size={13} className="text-[#60A5FA]" />
                      {s.label}
                    </span>
                  ))}
                </div>

                {/* kontaktlar */}
                <div className="mt-5 grid gap-2">
                  <ContactBtn
                    icon={Send}
                    title={ru ? 'Telegram-канал' : 'Telegram kanal'}
                    sub="@Yuksalishdev_ITjobs"
                    onClick={() => openTg(DEV.channel)}
                    primary
                  />
                  <ContactBtn
                    icon={MessageCircle}
                    title={ru ? 'Написать нам' : "Bog'lanish"}
                    sub="@Yuksalish_development"
                    onClick={() => openTg(DEV.dm)}
                  />
                  <a
                    href={DEV.phoneHref}
                    className="flex items-center gap-3 rounded-2xl bg-white/5 px-3.5 py-3 transition-colors active:bg-white/10"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-[#60A5FA]">
                      <Phone size={17} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11px] text-white/55">
                        {ru ? 'Телефон' : 'Telefon'}
                      </span>
                      <span className="block text-[14px] font-bold">{DEV.phone}</span>
                    </span>
                  </a>
                </div>

                <button
                  type="button"
                  onClick={() => openTg(DEV.dm)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2F6BFF] py-3.5 text-[14px] font-bold transition-colors active:bg-[#1F4FCC]"
                >
                  <Rocket size={16} />
                  {ru ? 'Начнём ваш проект' : 'Loyihangizni boshlaymiz'}
                </button>
              </div>
            </section>

            {/* footer */}
            <button
              type="button"
              onClick={() => openTg(VEGA_BOT)}
              className="flex w-full items-center justify-center gap-1.5 py-2 text-[12px] text-[var(--color-text-muted)]"
            >
              <Zap size={13} className="text-[#0A6CFF]" />
              {ru ? 'Создано на платформе Vega' : 'Vega platformasida yaratilgan'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ───────── Ma'lumot manbalari ───────── */

function VEGA_FEATURES(ru: boolean): { icon: LucideIcon; label: string }[] {
  return [
    { icon: Smartphone, label: ru ? 'Виртуальные номера' : 'Virtual raqamlar' },
    { icon: Sparkles, label: 'Telegram Stars' },
    { icon: CreditCard, label: ru ? 'Payme · Click' : 'Payme · Click' },
    { icon: ShieldCheck, label: 'Telegram Premium' },
    { icon: Megaphone, label: ru ? 'Рассылки' : 'Ommaviy xabar' },
    { icon: BarChart3, label: ru ? 'Аналитика' : 'Analitika' },
  ];
}

function DEV_SERVICES(ru: boolean): { icon: LucideIcon; label: string }[] {
  return [
    { icon: Bot, label: ru ? 'Telegram-боты' : 'Telegram botlar' },
    { icon: Globe, label: ru ? 'Сайты' : 'Web saytlar' },
    { icon: Smartphone, label: ru ? 'Моб. приложения' : 'Mobil ilovalar' },
    { icon: Layers, label: ru ? 'SaaS / системы' : 'Biznes tizimlar' },
    { icon: Sparkles, label: ru ? 'AI-интеграции' : 'AI integratsiya' },
  ];
}

/* ───────── Yordamchi komponentlar ───────── */

function InfoRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-[var(--color-bg)] px-3 py-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-[var(--color-text-muted)]">
        <Icon size={16} />
      </span>
      <span className="min-w-0 pt-0.5">
        <span className="block text-[11px] text-[var(--color-text-muted)]">{label}</span>
        <span className="block text-[13.5px] font-medium leading-snug text-[var(--color-text)]">
          {value}
        </span>
      </span>
    </div>
  );
}

/** t.me havolasidan @handle chiqarish (ko'rsatish uchun). */
function tgHandle(url: string): string {
  const m = url.match(/t\.me\/([A-Za-z0-9_+]+)/i);
  if (m) return '@' + m[1].replace(/^\+/, '');
  return url.replace(/^https?:\/\//, '');
}

/** Bosiladigan kontakt/kanal qatori (telefon uslubida). */
function LinkRow({
  icon: Icon,
  label,
  sub,
  brand,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  sub: string;
  brand: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-opacity active:opacity-80"
      style={{ backgroundColor: `${brand}12` }}
    >
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white"
        style={{ background: brand }}
      >
        <Icon size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] text-[var(--color-text-muted)]">{label}</span>
        <span className="block truncate text-[13px] font-semibold" style={{ color: brand }}>
          {sub}
        </span>
      </span>
      <ArrowRight size={15} style={{ color: brand }} className="shrink-0 opacity-60" />
    </button>
  );
}

function SectionLabel({ index, text }: { index: string; text: string }) {
  return (
    <div className="flex items-center gap-2 px-1 pt-1">
      <span className="text-[11px] font-extrabold tabular-nums text-[var(--color-primary)]">
        {index}
      </span>
      <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
        {text}
      </span>
      <span className="h-px flex-1 bg-[var(--color-border)]" />
    </div>
  );
}

function ContactBtn({
  icon: Icon,
  title,
  sub,
  onClick,
  primary,
}: {
  icon: LucideIcon;
  title: string;
  sub: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        primary
          ? 'flex items-center gap-3 rounded-2xl bg-white px-3.5 py-3 text-left text-[#0B1220] transition-transform active:scale-[.99]'
          : 'flex items-center gap-3 rounded-2xl bg-white/5 px-3.5 py-3 text-left transition-colors active:bg-white/10'
      }
    >
      <span
        className={
          primary
            ? 'grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#2F6BFF]/12 text-[#2F6BFF]'
            : 'grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-[#60A5FA]'
        }
      >
        <Icon size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={primary ? 'block text-[14px] font-bold' : 'block text-[14px] font-bold text-white'}>
          {title}
        </span>
        <span className={primary ? 'block text-[11.5px] text-[#0B1220]/55' : 'block text-[11.5px] text-white/50'}>
          {sub}
        </span>
      </span>
      <ArrowRight size={16} className={primary ? 'text-[#0B1220]/40' : 'text-white/40'} />
    </button>
  );
}
