'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Tags, CheckCircle2, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet } from '@/components/ui/sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, Input } from '@/components/ui/input';
import { PickerSelect } from '@/components/picker-select';
import { CountryFlag } from '@/components/country-flag';
import { ServiceIcon } from '@/components/service-icon';
import {
  apiCatalogCountries,
  apiCatalogPrice,
  apiCatalogServices,
  apiCreateOffer,
  apiDeleteOffer,
  apiListOffers,
  apiServiceCountries,
} from '@/lib/endpoints';
import { formatMoney } from '@/lib/format';
import type { AdminOffer, CountryDto, Money, ServiceDto } from '@/lib/types';
import { toast } from '@/stores/toast-store';

function parseMoneyInput(text: string): number {
  const digits = text.replace(/[^0-9]/g, '');
  return digits ? Number(digits) : 0;
}
function formatMoneyInput(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '';
  return new Intl.NumberFormat('ru-RU').format(n).replace(/,/g, ' ');
}

function money(v: Money | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—';
  return formatMoney(v);
}

export default function OffersPage() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<AdminOffer | null>(null);

  const { data: offers, isLoading } = useQuery({ queryKey: ['offers'], queryFn: apiListOffers });
  const { data: services } = useQuery({ queryKey: ['catalog', 'services'], queryFn: apiCatalogServices });
  const { data: countries } = useQuery({ queryKey: ['catalog', 'countries'], queryFn: apiCatalogCountries });

  const serviceMap = useMemo(
    () => new Map((services ?? []).map((s) => [s.id, s])),
    [services],
  );
  const countryMap = useMemo(
    () => new Map((countries ?? []).map((c) => [c.id, c])),
    [countries],
  );

  const del = useMutation({
    mutationFn: (id: string) => apiDeleteOffer(id),
    onSuccess: () => {
      toast.success("Taklif o'chirildi");
      qc.invalidateQueries({ queryKey: ['offers'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Narxlar"
        description="Qaysi xizmat va davlatni sotasiz — retail narxni belgilang"
        rightSlot={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus size={16} /> Yangi
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : !offers || offers.length === 0 ? (
        <Card>
          <EmptyState
            icon={Tags}
            title="Hali taklif yo'q"
            hint="Katalogdan xizmat va davlatni tanlab, mijozlarga sotadigan narxni belgilang."
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {offers.map((o) => {
            const service: ServiceDto | undefined = o.service ?? serviceMap.get(o.serviceId);
            const country: CountryDto | undefined = o.country ?? countryMap.get(o.countryId);
            return (
              <div
                key={o.id}
                className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm transition-all hover:shadow-md"
              >
                {/* Ma'lumot: ikona+bayroq · nomi · sotuv narxi + foyda */}
                <div className="flex items-center gap-3.5 p-3">
                  <div className="h-12 w-12 shrink-0 grid place-items-center rounded-xl bg-[var(--color-bg)] ring-1 ring-[var(--color-border)]">
                    <ServiceIcon
                      slug={service?.slug}
                      emoji={service?.emoji}
                      className="h-6 w-6 object-contain"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">
                      {service?.nameUz ?? o.serviceId}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--color-text-muted)] truncate flex items-center gap-1.5">
                      <CountryFlag
                        iso2={country?.iso2}
                        className="h-4 w-[22px] rounded-[3px] object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.1)] shrink-0"
                      />
                      <span className="truncate">{country?.nameUz ?? o.countryId}</span>
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
                      Sotuv narxi
                    </p>
                    <p className="text-base font-extrabold leading-tight text-[var(--color-primary)] tabular-nums">
                      {money(o.retailPrice)}
                    </p>
                    <OfferProfit
                      serviceId={o.serviceId}
                      countryId={o.countryId}
                      retail={Number(o.retailPrice)}
                    />
                  </div>
                </div>

                {/* Amallar: tahrirlash · o'chirish */}
                <div className="flex border-t border-[var(--color-border)] divide-x divide-[var(--color-border)]">
                  <button
                    onClick={() => setEditing(o)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-primary)] transition-colors"
                  >
                    <Pencil size={15} /> Tahrirlash
                  </button>
                  <button
                    onClick={() => del.mutate(o.id)}
                    disabled={del.isPending}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-[var(--color-text-muted)] hover:bg-rose-50 hover:text-[var(--color-danger)] transition-colors"
                  >
                    <Trash2 size={15} /> O&apos;chirish
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {adding && (
        <AddOfferSheet
          services={services ?? []}
          countries={countries ?? []}
          offers={offers ?? []}
          onClose={() => setAdding(false)}
        />
      )}

      {editing && (
        <EditOfferSheet
          offer={editing}
          service={editing.service ?? serviceMap.get(editing.serviceId)}
          country={editing.country ?? countryMap.get(editing.countryId)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

/** Kartadagi jonli foyda: tan narxi (provayderdan) − retail. */
function OfferProfit({
  serviceId,
  countryId,
  retail,
}: {
  serviceId: string;
  countryId: string;
  retail: number;
}) {
  const { data } = useQuery({
    queryKey: ['catalog-price', serviceId, countryId],
    queryFn: () => apiCatalogPrice(serviceId, countryId),
    enabled: !!serviceId && !!countryId,
  });
  // Narx yo'q (manba ulanmagan) — sotib bo'lmaydigan taklif: ogohlantirish.
  if (data && !data.available) {
    return (
      <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
        ⚠️ Mavjud emas
      </span>
    );
  }
  const wholesale =
    data?.available && data.wholesaleUzs != null ? data.wholesaleUzs : null;
  if (wholesale == null) return null;
  const profit = retail - wholesale;
  return (
    <span
      className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        profit >= 0 ? 'bg-emerald-50 text-[var(--color-success)]' : 'bg-rose-50 text-[var(--color-danger)]'
      }`}
    >
      {profit >= 0 ? `+${formatMoney(profit)} foyda` : `${formatMoney(profit)} zarar`}
    </span>
  );
}

/**
 * Free sinov bosqichi bo'yicha ogohlantirish:
 *  • FREE      (1–7 kun)  — tan narxida, qo'shimchasiz
 *  • SURCHARGE (8–10 kun) — har sotuvdan +1200 so'm ustama
 *  • EXPIRED   (11-kun)   — bloklangan, tarif shart
 */
function TrialNotice({
  info,
}: {
  info?: {
    phase: 'FREE' | 'SURCHARGE' | 'EXPIRED' | 'PAID' | null;
    trialDaysLeft: number | null;
    freeDaysLeft: number | null;
    surchargeUzs: number | null;
  } | null;
}) {
  if (!info || !info.phase) return null;

  if (info.phase === 'FREE') {
    return (
      <div className="mt-1.5 rounded-lg border border-[var(--color-primary)]/25 bg-[var(--color-primary)]/[0.06] px-2.5 py-2 text-xs leading-relaxed">
        <p className="font-semibold text-[var(--color-primary)]">
          🎁 Free sinov — tan narxida yana {info.freeDaysLeft} kun
        </p>
        <p className="mt-0.5 text-[var(--color-text-muted)]">
          8–10-kunlarda har sotuvdan{' '}
          <b className="text-[var(--color-text)]">+1 200 so&apos;m</b> ustama qo&apos;shiladi,
          11-kundan tarif olish shart bo&apos;ladi.
        </p>
      </div>
    );
  }

  if (info.phase === 'SURCHARGE') {
    return (
      <div className="mt-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs leading-relaxed">
        <p className="font-semibold text-amber-700">
          ⚠️ Har sotuvdan +{info.surchargeUzs ? formatMoney(info.surchargeUzs) : "1 200 so'm"} olinadi
        </p>
        <p className="mt-0.5 text-amber-700/90">
          Tan narxiga ustama qo&apos;shildi. Yana {info.trialDaysLeft} kun, so&apos;ng
          bloklanadi — tarif (STANDARD / PREMIUM) oling.
        </p>
      </div>
    );
  }

  if (info.phase === 'EXPIRED') {
    return (
      <div className="mt-1.5 rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-2 text-xs leading-relaxed">
        <p className="font-semibold text-[var(--color-danger)]">⛔ Sinov muddati tugadi</p>
        <p className="mt-0.5 text-[var(--color-danger)]/80">
          Sotishni davom ettirish uchun tarif (STANDARD / PREMIUM) sotib oling.
        </p>
      </div>
    );
  }

  // PAID
  return (
    <p className="mt-1.5 text-xs font-medium text-[var(--color-success)]">
      💳 Tarif faol — cheksiz sotasiz
    </p>
  );
}

/** Mavjud taklif narxini tahrirlash (xizmat+davlat o'zgarmas). */
function EditOfferSheet({
  offer,
  service,
  country,
  onClose,
}: {
  offer: AdminOffer;
  service?: ServiceDto;
  country?: CountryDto;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [priceText, setPriceText] = useState(formatMoneyInput(Number(offer.retailPrice)));
  const price = parseMoneyInput(priceText);

  const { data: priceInfo, isFetching: priceLoading } = useQuery({
    queryKey: ['catalog-price', offer.serviceId, offer.countryId],
    queryFn: () => apiCatalogPrice(offer.serviceId, offer.countryId),
    enabled: !!offer.serviceId && !!offer.countryId,
  });
  const wholesale =
    priceInfo?.available && priceInfo.wholesaleUzs != null ? priceInfo.wholesaleUzs : null;
  const profit = wholesale != null ? price - wholesale : null;

  const save = useMutation({
    mutationFn: () =>
      apiCreateOffer({
        serviceId: offer.serviceId,
        countryId: offer.countryId,
        retailPrice: price,
      }),
    onSuccess: () => {
      toast.success('Narx yangilandi');
      qc.invalidateQueries({ queryKey: ['offers'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Sheet open onClose={onClose} title="Narxni tahrirlash">
      <div className="space-y-4">
        {/* Xizmat + davlat (o'zgarmas) */}
        <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <div className="h-10 w-10 shrink-0 grid place-items-center rounded-lg bg-[var(--color-surface)] ring-1 ring-[var(--color-border)]">
            <ServiceIcon slug={service?.slug} emoji={service?.emoji} className="h-5 w-5 object-contain" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{service?.nameUz ?? offer.serviceId}</p>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)] truncate flex items-center gap-1.5">
              <CountryFlag
                iso2={country?.iso2}
                className="h-4 w-[22px] rounded-[3px] object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.1)] shrink-0"
              />
              <span className="truncate">{country?.nameUz ?? offer.countryId}</span>
            </p>
          </div>
        </div>

        {/* Tan narxi + foyda */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-sm">
          {priceLoading ? (
            <p className="text-[var(--color-text-muted)]">Tan narxi yuklanmoqda…</p>
          ) : wholesale != null ? (
            <>
              <p className="text-[var(--color-text-muted)]">
                Tan narxi (ulgurji):{' '}
                <b className="text-[var(--color-text)]">{formatMoney(wholesale)}</b>
              </p>
              <TrialNotice info={priceInfo} />
              {price > 0 &&
                (profit! >= 0 ? (
                  <p className="mt-0.5 font-semibold text-[var(--color-success)]">
                    Foyda: +{formatMoney(profit!)}
                  </p>
                ) : (
                  <p className="mt-0.5 font-semibold text-[var(--color-danger)]">
                    Zarar: {formatMoney(profit!)} — retail tan narxdan past
                  </p>
                ))}
            </>
          ) : (
            <p className="text-[var(--color-text-muted)]">⚠️ Tan narxi hozircha yo&apos;q</p>
          )}
        </div>

        <Field label="Retail narx (so'm)" hint="Mijoz shu narxda sotib oladi">
          <Input
            inputMode="numeric"
            value={priceText}
            onChange={(e) => setPriceText(formatMoneyInput(parseMoneyInput(e.target.value)))}
            placeholder="15 000"
          />
        </Field>
        <Button fullWidth loading={save.isPending} disabled={price <= 0} onClick={() => save.mutate()}>
          Saqlash
        </Button>
      </div>
    </Sheet>
  );
}

function AddOfferSheet({
  services,
  countries,
  offers,
  onClose,
}: {
  services: ServiceDto[];
  countries: CountryDto[];
  offers: AdminOffer[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [serviceId, setServiceId] = useState('');
  const [countryId, setCountryId] = useState('');
  const [priceText, setPriceText] = useState('');
  const [addedCount, setAddedCount] = useState(0);
  const price = parseMoneyInput(priceText);

  // Jonli "tan narxi" (ulgurji) — xizmat va davlat tanlangach provayderdan keladi.
  const { data: priceInfo, isFetching: priceLoading } = useQuery({
    queryKey: ['catalog-price', serviceId, countryId],
    queryFn: () => apiCatalogPrice(serviceId, countryId),
    enabled: !!serviceId && !!countryId,
  });
  const wholesale =
    priceInfo?.available && priceInfo.wholesaleUzs != null ? priceInfo.wholesaleUzs : null;
  const profit = wholesale != null ? price - wholesale : null;

  // Xizmat qo'llaydigan davlatlar (Telegram -> faqat SPIDER'da bor; Filippin kabilar chiqmaydi).
  const { data: svcCountries, isFetching: countriesLoading } = useQuery({
    queryKey: ['service-countries', serviceId],
    queryFn: () => apiServiceCountries(serviceId),
    enabled: !!serviceId,
  });
  const countryList = serviceId ? (svcCountries ?? []) : countries;

  // Tanlangan xizmatga allaqachon qo'shilgan davlatlar (yashil galochka uchun).
  const addedCountryIds = useMemo(
    () => new Set(offers.filter((o) => o.serviceId === serviceId).map((o) => o.countryId)),
    [offers, serviceId],
  );

  const create = useMutation({
    mutationFn: () => apiCreateOffer({ serviceId, countryId, retailPrice: price }),
    onSuccess: () => {
      toast.success("Taklif qo'shildi");
      qc.invalidateQueries({ queryKey: ['offers'] });
      // Oynani YOPMAYMIZ — ketma-ket qo'shish uchun davlat + narxni tozalaymiz.
      // Xizmat tanlangan holicha qoladi (bir xizmatni ko'p davlatga qo'shish qulay).
      setAddedCount((n) => n + 1);
      setCountryId('');
      setPriceText('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const serviceOptions = services.map((s) => ({
    value: s.id,
    label: s.nameUz,
    icon: <ServiceIcon slug={s.slug} emoji={s.emoji} />,
  }));
  const countryOptions = countryList.map((c) => ({
    value: c.id,
    label: c.nameUz,
    icon: <CountryFlag iso2={c.iso2} />,
    added: addedCountryIds.has(c.id),
  }));

  // Provayder narxi bo'lmasa (available !== true) qo'shishga ruxsat yo'q —
  // sotib bo'lmaydigan taklif yaratilmasin.
  const valid =
    serviceId && countryId && price > 0 && priceInfo?.available === true;

  return (
    <Sheet open onClose={onClose} title="Yangi taklif">
      <div className="space-y-4">
        {addedCount > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-[var(--color-success)]">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>
              <b>{addedCount}</b> ta taklif qo&apos;shildi — davom eting yoki ✕ bilan yoping
            </span>
          </div>
        )}
        <Field label="Xizmat">
          <PickerSelect
            value={serviceId}
            onChange={(v) => {
              setServiceId(v);
              setCountryId(''); // xizmat o'zgarsa — davlatni tozalaymiz (ro'yxat farq qiladi)
            }}
            options={serviceOptions}
            placeholder="Xizmatni tanlang"
            title="Xizmat"
          />
        </Field>
        <Field label="Davlat" hint={serviceId && countriesLoading ? 'Davlatlar yuklanmoqda…' : undefined}>
          <PickerSelect
            value={countryId}
            onChange={setCountryId}
            options={countryOptions}
            placeholder={serviceId ? 'Davlatni tanlang' : 'Avval xizmatni tanlang'}
            title="Davlat"
          />
        </Field>
        {serviceId && countryId && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-sm">
            {priceLoading ? (
              <p className="text-[var(--color-text-muted)]">Tan narxi yuklanmoqda…</p>
            ) : wholesale != null ? (
              <>
                <p className="text-[var(--color-text-muted)]">
                  Tan narxi (ulgurji):{' '}
                  <b className="text-[var(--color-text)]">{formatMoney(wholesale)}</b>
                </p>
                <TrialNotice info={priceInfo} />
                {price > 0 &&
                  (profit! >= 0 ? (
                    <p className="mt-0.5 font-semibold text-[var(--color-success)]">
                      Foyda: +{formatMoney(profit!)}
                    </p>
                  ) : (
                    <p className="mt-0.5 font-semibold text-[var(--color-danger)]">
                      Zarar: {formatMoney(profit!)} — retail tan narxdan past
                    </p>
                  ))}
              </>
            ) : (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2">
                <p className="text-xs font-semibold text-amber-700">
                  ⚠️ Bu yo&apos;nalish hozircha mavjud emas
                </p>
                <p className="mt-0.5 text-xs text-amber-700/80">
                  Hozircha qo&apos;shib bo&apos;lmaydi — sotib bo&apos;lmaydi. Hozir faqat
                  Telegram raqamlari mavjud.
                </p>
              </div>
            )}
          </div>
        )}
        <Field label="Retail narx (so'm)" hint="Mijoz shu narxda sotib oladi">
          <Input
            inputMode="numeric"
            value={priceText}
            onChange={(e) => setPriceText(formatMoneyInput(parseMoneyInput(e.target.value)))}
            placeholder="15 000"
          />
        </Field>
        <Button fullWidth loading={create.isPending} disabled={!valid} onClick={() => create.mutate()}>
          Qo&apos;shish
        </Button>
      </div>
    </Sheet>
  );
}
