'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Search, Loader2, Zap, ShieldCheck, Clock } from 'lucide-react';
import { AppHeader } from '@/components/shop/app-header';
import { DigitalSections } from '@/components/shop/digital-sections';
import { CountryFlag } from '@/components/country-flag';
import { ServiceIcon } from '@/components/service-icon';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { apiStorefront, apiBuyNumber } from '@/lib/api/endpoints';
import { useTrackOnMount } from '@/hooks/use-track';
import { useTelegramBackButton } from '@/hooks/use-telegram';
import { useLocaleStore } from '@/stores/locale-store';
import { getMessages, tr } from '@/i18n';
import { formatMoney } from '@/lib/format';
import { haptic } from '@/lib/telegram';
import { toast } from '@/stores/toast-store';
import { cn } from '@/lib/cn';
import type { ServiceDto, StorefrontOffer } from '@/lib/api/types';

interface ServiceGroup {
  service: ServiceDto;
  offers: StorefrontOffer[];
  minPrice: number;
}

export default function HomePage() {
  useTrackOnMount({ type: 'VIEW_HOME' });
  useTelegramBackButton();
  const locale = useLocaleStore((s) => s.locale);
  const messages = getMessages(locale);
  const router = useRouter();
  const qc = useQueryClient();

  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [countryQuery, setCountryQuery] = useState('');

  const { data: offers, isLoading, isError, refetch } = useQuery({
    queryKey: ['storefront'],
    queryFn: apiStorefront,
  });

  const sName = (s: ServiceDto) => (locale === 'ru' ? s.nameRu : s.nameUz);

  const groups = useMemo<ServiceGroup[]>(() => {
    const map = new Map<string, ServiceGroup>();
    for (const o of offers ?? []) {
      const g = map.get(o.service.id) ?? { service: o.service, offers: [], minPrice: Infinity };
      g.offers.push(o);
      g.minPrice = Math.min(g.minPrice, Number(o.retailPrice));
      map.set(o.service.id, g);
    }
    return Array.from(map.values()).sort((a, b) => a.service.position - b.service.position);
  }, [offers]);

  const selected = groups.find((g) => g.service.id === selectedServiceId) ?? null;

  // Tanlangan xizmat davlatlari — arzon narx bo'yicha saralab, qidiruv bilan filtrlab
  const countryOffers = selected
    ? [...selected.offers]
        .sort((a, b) => Number(a.retailPrice) - Number(b.retailPrice))
        .filter((o) => {
          const q = countryQuery.trim().toLowerCase();
          if (!q) return true;
          return (locale === 'ru' ? o.country.nameRu : o.country.nameUz)
            .toLowerCase()
            .includes(q);
        })
    : [];
  const cheapestId = countryOffers[0]?.id ?? null;

  const buy = useMutation({
    mutationFn: (offer: StorefrontOffer) =>
      apiBuyNumber({ serviceId: offer.serviceId, countryId: offer.countryId }),
    onSuccess: (order) => {
      haptic('success');
      qc.invalidateQueries({ queryKey: ['me'] });
      qc.invalidateQueries({ queryKey: ['number-orders'] });
      router.push(`/orders/${order.id}`);
    },
    onError: (err: Error) => {
      haptic('error');
      toast.error(err.message);
    },
  });

  const filteredGroups = query.trim()
    ? groups.filter((g) => sName(g.service).toLowerCase().includes(query.trim().toLowerCase()))
    : groups;

  return (
    <div>
      <AppHeader />

      {/* ── Service list ── */}
      {!selected ? (
        <>
          {/* ── Hero ── */}
          <div className="px-4 pt-3">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--color-primary)] to-[#1E4FCC] p-5 text-white shadow-lg">
              <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/10" />
              <div className="pointer-events-none absolute right-10 -bottom-8 h-24 w-24 rounded-full bg-white/5" />
              <div className="relative">
                <h2 className="text-[22px] font-extrabold leading-tight">
                  {locale === 'ru' ? 'Виртуальные номера' : 'Virtual raqamlar'}
                </h2>
                <p className="mt-1.5 text-[13px] leading-snug text-white/85">
                  {locale === 'ru'
                    ? 'Для SMS-подтверждения — за секунды и надёжно.'
                    : 'SMS tasdiqlash uchun — soniyalarda va ishonchli.'}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {(locale === 'ru'
                    ? ['1 · Выберите', '2 · Оплатите', '3 · Код придёт']
                    : ['1 · Tanlang', '2 · Sotib oling', '3 · Kod keladi']
                  ).map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Ishonch belgilari ── */}
          <div className="px-4 pt-3">
            <div className="grid grid-cols-3 gap-2">
              {[
                { ic: <Zap size={17} />, uz: 'Tez', ru: 'Быстро' },
                { ic: <ShieldCheck size={17} />, uz: 'Xavfsiz', ru: 'Надёжно' },
                { ic: <Clock size={17} />, uz: '24/7', ru: '24/7' },
              ].map((f, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-1 rounded-2xl border border-[var(--color-border)] bg-white py-3"
                >
                  <span className="text-[var(--color-primary)]">{f.ic}</span>
                  <span className="text-xs font-medium">{locale === 'ru' ? f.ru : f.uz}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Bo'lim sarlavhasi ── */}
          <div className="px-4 pt-5 pb-2">
            <h2 className="text-base font-bold">{tr(messages, 'storefront.chooseService')}</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {tr(messages, 'storefront.subtitle')}
            </p>
          </div>

          {groups.length > 4 && (
            <div className="px-4 pb-2">
              <div className="h-11 rounded-2xl bg-white border border-[var(--color-border)] flex items-center gap-2 px-3">
                <Search size={17} className="text-[var(--color-text-muted)]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={tr(messages, 'common.search')}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-text-muted)]"
                />
              </div>
            </div>
          )}

          <div className="px-4 pb-4">
            {isLoading ? (
              <div className="space-y-2.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-[72px] rounded-2xl" />
                ))}
              </div>
            ) : isError ? (
              <EmptyState
                title={tr(messages, 'common.error')}
                action={
                  <button
                    onClick={() => refetch()}
                    className="text-sm font-semibold text-[var(--color-primary)]"
                  >
                    {tr(messages, 'common.retry')}
                  </button>
                }
              />
            ) : filteredGroups.length === 0 ? (
              <EmptyState title={tr(messages, 'storefront.noServices')} />
            ) : (
              <div className="space-y-2.5">
                {filteredGroups.map((g) => (
                  <button
                    key={g.service.id}
                    onClick={() => {
                      haptic('light');
                      setCountryQuery('');
                      setSelectedServiceId(g.service.id);
                    }}
                    className="w-full flex items-center gap-3.5 bg-white rounded-2xl border border-[var(--color-border)] p-3.5 active:scale-[0.99] transition-transform text-left"
                  >
                    <div className="h-12 w-12 shrink-0 grid place-items-center rounded-xl bg-[var(--color-bg)]">
                      <ServiceIcon
                        slug={g.service.slug}
                        emoji={g.service.emoji ?? '📱'}
                        className="inline-block h-7 w-7 object-contain text-2xl leading-none"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[15px] leading-tight truncate">
                        {sName(g.service)}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        {g.offers.length} {locale === 'ru' ? 'стран' : 'davlat'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] leading-none">
                        {tr(messages, 'storefront.from')}
                      </p>
                      <p className="font-bold text-[var(--color-primary)] tabular-nums mt-1">
                        {formatMoney(g.minPrice, locale)}
                      </p>
                    </div>
                    <ChevronRight size={18} className="text-[var(--color-text-muted)] shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Telegram Stars / Premium ── */}
          <DigitalSections />

          {/* ── Qanday ishlaydi ── */}
          <div className="px-4 pt-3 pb-6">
            <div className="rounded-2xl border border-[var(--color-border)] bg-white p-4">
              <p className="text-sm font-bold mb-3.5">
                {locale === 'ru' ? 'Как это работает' : 'Qanday ishlaydi'}
              </p>
              <div className="space-y-3.5">
                {(locale === 'ru'
                  ? ['Выберите сервис и страну', 'Оплатите с баланса', 'SMS-код придёт мгновенно']
                  : ['Xizmat va davlatni tanlang', 'Balansdan sotib oling', 'SMS kodi darhol keladi']
                ).map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="h-7 w-7 shrink-0 grid place-items-center rounded-full bg-[var(--color-primary)] text-white text-xs font-bold">
                      {i + 1}
                    </span>
                    <span className="text-sm">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        /* ── Country list for selected service ── */
        <div className="pb-6">
          {/* ── Sarlavha ── */}
          <div className="px-4 pt-4 pb-3 flex items-center gap-3">
            <button
              onClick={() => {
                setSelectedServiceId(null);
                setCountryQuery('');
              }}
              className="h-9 w-9 rounded-full bg-white border border-[var(--color-border)] grid place-items-center shrink-0 active:scale-95 transition-transform"
              aria-label={tr(messages, 'common.back')}
            >
              <ChevronLeft size={20} />
            </button>
            <div className="h-10 w-10 shrink-0 grid place-items-center rounded-xl bg-white border border-[var(--color-border)]">
              <ServiceIcon
                slug={selected.service.slug}
                emoji={selected.service.emoji ?? '📱'}
                className="inline-block h-6 w-6 object-contain text-xl leading-none"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold truncate leading-tight">
                {sName(selected.service)}
              </h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {selected.offers.length} {locale === 'ru' ? 'стран доступно' : 'davlat mavjud'}
              </p>
            </div>
          </div>

          {/* ── Davlat qidiruvi ── */}
          {selected.offers.length > 6 && (
            <div className="px-4 pb-3">
              <div className="h-11 rounded-2xl bg-white border border-[var(--color-border)] flex items-center gap-2 px-3">
                <Search size={17} className="text-[var(--color-text-muted)]" />
                <input
                  value={countryQuery}
                  onChange={(e) => setCountryQuery(e.target.value)}
                  placeholder={locale === 'ru' ? 'Поиск страны' : 'Davlatni qidirish'}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-text-muted)]"
                />
              </div>
            </div>
          )}

          {countryOffers.length === 0 ? (
            <div className="px-4">
              <EmptyState title={locale === 'ru' ? 'Ничего не найдено' : 'Hech narsa topilmadi'} />
            </div>
          ) : (
            <ul className="px-4 space-y-2.5">
              {countryOffers.map((o) => (
                <li
                  key={o.id}
                  className="bg-white rounded-2xl border border-[var(--color-border)] p-3 flex items-center gap-3"
                >
                  <CountryFlag
                    iso2={o.country.iso2}
                    className="h-7 w-9 shrink-0 rounded-md object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-[15px] truncate">
                        {locale === 'ru' ? o.country.nameRu : o.country.nameUz}
                      </p>
                      {o.id === cheapestId && !countryQuery.trim() && (
                        <span className="shrink-0 rounded-full bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5">
                          {locale === 'ru' ? 'дёшево' : 'arzon'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-[var(--color-primary)] tabular-nums mt-0.5">
                      {formatMoney(o.retailPrice, locale)}
                    </p>
                  </div>
                  <button
                    onClick={() => buy.mutate(o)}
                    disabled={buy.isPending}
                    className={cn(
                      'h-10 px-4 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold inline-flex items-center gap-1.5 shrink-0 active:opacity-90 disabled:opacity-50',
                    )}
                  >
                    {buy.isPending && buy.variables?.id === o.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <>
                        {tr(messages, 'storefront.buy')}
                        <ChevronRight size={15} />
                      </>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
