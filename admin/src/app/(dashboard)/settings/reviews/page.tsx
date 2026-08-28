'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Info, Radio, CheckCircle2, Users, AlertCircle, ClipboardList, Send } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  apiReviewChannelInfo,
  apiUpdateStoreReviews,
  apiUpdateOrdersChannel,
  apiListOffers,
  apiMarketingSale,
} from '@/lib/endpoints';
import { toast } from '@/stores/toast-store';
import { PickerSelect } from '@/components/picker-select';
import { ServiceIcon } from '@/components/service-icon';
import { CountryFlag } from '@/components/country-flag';
import { SettingsHeader, useStore } from '../_shared';

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 rounded-full transition-colors shrink-0 ${on ? 'bg-[var(--color-primary)]' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${on ? 'translate-x-5' : ''}`} />
    </button>
  );
}

function formatCount(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.0', '') + 'k';
  return String(n);
}

export default function ReviewsSettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useStore();
  const tenant = data?.tenant ?? null;

  const [enabled, setEnabled] = useState(false);
  const [channelId, setChannelId] = useState('');
  const [ordersChannel, setOrdersChannel] = useState('');
  const inited = useRef(false);

  useEffect(() => {
    if (!tenant || inited.current) return;
    setEnabled(tenant.reviews?.enabled ?? false);
    setChannelId(tenant.reviews?.channelId ?? '');
    setOrdersChannel(tenant.ordersChannel?.channelId ?? '');
    inited.current = true;
  }, [tenant]);

  const save = useMutation({
    mutationFn: () => apiUpdateStoreReviews({ channelId: channelId.trim(), enabled }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-store'] });
      qc.invalidateQueries({ queryKey: ['review-channel-info'] });
      toast.success('Saqlandi');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Qo'lda sotuv e'loni (marketing) ──────────────────────────
  // Yo'nalish ikki bosqichda tanlanadi: avval XIZMAT, keyin o'sha xizmatda
  // mavjud DAVLAT. Ilgari bitta ro'yxatda "xizmat · davlat" birga edi —
  // o'nlab taklif bo'lganda topish qiyin bo'lardi.
  const [mkServiceId, setMkServiceId] = useState('');
  const [mkOfferId, setMkOfferId] = useState('');
  const [mkPhone, setMkPhone] = useState('');
  const { data: offers } = useQuery({ queryKey: ['offers'], queryFn: apiListOffers });
  const activeOffers = (offers ?? []).filter((o) => o.isActive);
  const mkOffer = activeOffers.find((o) => o.id === mkOfferId) ?? null;
  // Takliflardagi noyob xizmatlar (tartib saqlanadi)
  const mkServices = Array.from(
    new Map(
      activeOffers
        .filter((o) => o.service)
        .map((o) => [o.serviceId, o.service!]),
    ).entries(),
  ).map(([id, service]) => ({ id, service }));
  // Tanlangan xizmat uchun mavjud davlatlar
  const mkCountryOffers = mkServiceId
    ? activeOffers.filter((o) => o.serviceId === mkServiceId)
    : [];

  // PickerSelect bottom-sheet ishlatadi — native <select>dan farqli o'laroq
  // haqiqiy brend logolarini (public/brands/*.svg) ko'rsata oladi.
  const mkServiceOptions = mkServices.map(({ id, service }) => ({
    value: id,
    label: service.nameUz ?? 'Xizmat',
    icon: <ServiceIcon slug={service.slug} emoji={service.emoji} />,
  }));
  const mkCountryOptions = mkCountryOffers.map((o) => ({
    value: o.id,
    label: o.country?.nameUz ?? 'Davlat',
    icon: <CountryFlag iso2={o.country?.iso2} />,
  }));

  const marketing = useMutation({
    mutationFn: () => {
      if (!mkOffer) throw new Error("Yo'nalishni tanlang");
      return apiMarketingSale({
        serviceId: mkOffer.serviceId,
        countryId: mkOffer.countryId,
        phone: mkPhone.trim(),
      });
    },
    onSuccess: () => {
      setMkPhone('');
      toast.success("E'lon kanalga joylandi");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveOrders = useMutation({
    mutationFn: () => apiUpdateOrdersChannel(ordersChannel.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-store'] });
      toast.success('Saqlandi');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Otziv kanali jonli ma'lumoti (rasm, obunachilar) — saqlangan kanal bo'lsa.
  const { data: channelInfo, isFetching: infoLoading } = useQuery({
    queryKey: ['review-channel-info', tenant?.reviews?.channelId],
    queryFn: apiReviewChannelInfo,
    enabled: !!tenant?.reviews?.channelId,
  });

  // Otziv kanali FAQAT global Vega boti orqali ishlaydi (do'kon boti emas).
  const botRef = '@Vega_uzbot';

  return (
    <div>
      <SettingsHeader
        title="Otziv kanali"
        description="Har sotuv avtomatik kanalingizga chiroyli e'lon bo'lib joylanadi — ijtimoiy isbot"
      />

      {isLoading ? (
        <div className="max-w-2xl space-y-3">
          <Skeleton className="h-48" />
        </div>
      ) : !tenant ? (
        <Card>
          <div className="px-4 py-10 text-center text-sm text-[var(--color-text-muted)]">Do&apos;kon topilmadi</div>
        </Card>
      ) : (
        <div className="max-w-2xl space-y-4">
          <Card>
            <CardHeader title="Sotuv e'lonlari" subtitle="Yoqilsa — har muvaffaqiyatli sotuvdan keyin kanalga e'lon boradi" />
            <CardBody className="space-y-3">
              {/* Yo'riqnoma */}
              <div className="flex gap-3 rounded-xl bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 px-3 py-2.5 text-xs">
                <Info size={16} className="text-[var(--color-primary)] shrink-0 mt-0.5" />
                <p className="text-[var(--color-text-muted)] leading-relaxed">
                  <b className="text-[var(--color-text)]">{botRef}</b>ni kanalingizga{' '}
                  <b className="text-[var(--color-text)]">ADMIN</b> qiling (&quot;Post messages&quot; huquqi bilan), so&apos;ng kanal <b className="text-[var(--color-text)]">@username</b> yoki{' '}
                  <b className="text-[var(--color-text)]">ID</b> ni kiriting. Mijoz ma&apos;lumotlari (raqam, username) maxfiylik uchun qisman yashiriladi.
                </p>
              </div>

              <label className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] px-3.5 py-3">
                <span className="flex items-center gap-2 font-semibold text-sm">
                  <Megaphone size={16} className="text-[var(--color-primary)]" /> Otziv kanalini yoqish
                </span>
                <Toggle on={enabled} onChange={setEnabled} />
              </label>

              <Field
                label="Kanal @username yoki ID"
                hint="@Vega_uzbot shu kanalga admin bo'lishi shart. Masalan: @mychannel yoki -1001234567890"
              >
                <Input
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  placeholder="@mychannel"
                  className="font-mono"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </Field>

              {/* Ulangan kanal — jonli ko'rinish (rasm, nomi, obunachilar) */}
              {tenant.reviews?.channelId &&
                (infoLoading ? (
                  <Skeleton className="h-[68px] rounded-xl" />
                ) : channelInfo?.connected ? (
                  <div className="rounded-2xl border border-[var(--color-primary)]/20 bg-gradient-to-br from-[var(--color-primary)]/[0.07] to-transparent p-3.5">
                    <div className="flex items-center gap-3">
                      {channelInfo.photoDataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={channelInfo.photoDataUrl}
                          alt=""
                          className="h-12 w-12 rounded-full object-cover shrink-0 border border-[var(--color-border)]"
                        />
                      ) : (
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--color-primary)]/10 text-lg font-bold text-[var(--color-primary)]">
                          {(channelInfo.title || '#').trim().slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-sm truncate">{channelInfo.title || 'Kanal'}</p>
                          <CheckCircle2 size={15} className="text-[var(--color-success)] shrink-0" />
                        </div>
                        {channelInfo.username && (
                          <p className="text-xs text-[var(--color-text-muted)] truncate">@{channelInfo.username}</p>
                        )}
                        {channelInfo.subscriberCount != null && (
                          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                            <Users size={13} /> {formatCount(channelInfo.subscriberCount)} obunachi
                          </p>
                        )}
                      </div>
                    </div>
                    {!channelInfo.isAdmin && (
                      <div className="mt-2.5 flex gap-2 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-2 text-[11px] text-amber-700">
                        <AlertCircle size={14} className="shrink-0 mt-0.5" />
                        <p className="leading-snug">
                          Obunachilar soni va e&apos;lon joylash uchun @Vega_uzbotni kanalga <b>ADMIN</b> qiling.
                        </p>
                      </div>
                    )}
                  </div>
                ) : channelInfo && !channelInfo.connected ? (
                  <div className="flex gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-700">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <p className="flex-1 leading-snug">{channelInfo.reason}</p>
                  </div>
                ) : null)}

              <Button loading={save.isPending} onClick={() => save.mutate()}>Saqlash</Button>

              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                <Radio size={14} /> E&apos;lon xato bo&apos;lsa (bot admin emas) sotuv baribir davom etadi — jim o&apos;tkazib yuboriladi.
              </div>
            </CardBody>
          </Card>

          {/* ── Buyurtmalar kanali ───────────────────────────────── */}
          <Card>
            <CardHeader
              title="Buyurtmalar kanali"
              subtitle="Har yangi buyurtma kartochkasi shu yopiq kanalingizga tushadi"
            />
            <CardBody className="space-y-3">
              <div className="flex gap-2.5 rounded-2xl bg-[var(--color-bg)] p-3.5">
                <Info size={16} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
                <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
                  Bu <b className="text-[var(--color-text)]">xodimlaringiz uchun</b> ichki kanal —
                  mijozlar ko&apos;rmaydi. Bo&apos;sh qoldirsangiz buyurtmalar hech qayerga
                  yuborilmaydi (panelda baribir ko&apos;rinadi).
                </p>
              </div>

              <Field
                label="Kanal @username yoki ID"
                hint="@Vega_uzbot shu kanalga admin bo'lishi shart. Masalan: @myshop_orders yoki -1001234567890"
              >
                <Input
                  value={ordersChannel}
                  onChange={(e) => setOrdersChannel(e.target.value)}
                  placeholder="@myshop_orders"
                  className="font-mono"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </Field>

              <Button loading={saveOrders.isPending} onClick={() => saveOrders.mutate()}>
                Saqlash
              </Button>

              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                <ClipboardList size={14} /> Har do&apos;kon o&apos;z kanaliga ega — boshqa
                do&apos;konlar buyurtmalaringizni ko&apos;rmaydi.
              </div>
            </CardBody>
          </Card>

          {/* ── Qo'lda sotuv e'loni (marketing) ──────────────────── */}
          <Card>
            <CardHeader
              title="Qo'lda e'lon qo'shish"
              subtitle="Kanalni jonlantirish uchun — raqamni yozing, qolganini o'zi to'ldiradi"
            />
            <CardBody className="space-y-3">
              <div className="flex gap-2.5 rounded-2xl bg-[var(--color-bg)] p-3.5">
                <Info size={16} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
                <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
                  Narx <b className="text-[var(--color-text)]">avtomatik</b> sizning
                  &quot;Narxlar&quot;ingizdan olinadi, xaridor esa{' '}
                  <b className="text-[var(--color-text)]">anonim</b> qoladi — raqamning
                  oxirgi 4 xonasi yashiriladi va egasining ismi ko&apos;rsatilmaydi.
                  Bu haqiqiy buyurtma yaratmaydi: hamyon va statistikaga tegmaydi.
                </p>
              </div>

              <Field label="Xizmat">
                <PickerSelect
                  title="Xizmatni tanlang"
                  placeholder="— tanlang —"
                  value={mkServiceId}
                  options={mkServiceOptions}
                  onChange={(v) => {
                    setMkServiceId(v);
                    setMkOfferId(''); // xizmat almashsa davlat qayta tanlanadi
                  }}
                />
              </Field>

              <Field
                label="Davlat"
                hint={
                  mkServiceId && mkCountryOptions.length === 0
                    ? "Bu xizmat uchun taklif yo'q"
                    : undefined
                }
              >
                <PickerSelect
                  title="Davlatni tanlang"
                  placeholder={
                    mkServiceId ? '— tanlang —' : '— avval xizmatni tanlang —'
                  }
                  value={mkOfferId}
                  options={mkCountryOptions}
                  onChange={(v) => setMkOfferId(v)}
                />
              </Field>

              <Field
                label="Telefon raqami"
                hint={
                  mkOffer
                    ? `Kanalda narx: ${Number(mkOffer.retailPrice).toLocaleString('ru-RU')} so'm (avtomatik)`
                    : "Masalan: +998901234567"
                }
              >
                <Input
                  value={mkPhone}
                  onChange={(e) => setMkPhone(e.target.value)}
                  placeholder="+998901234567"
                  className="font-mono"
                  inputMode="tel"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </Field>

              <Button
                loading={marketing.isPending}
                disabled={!mkOffer || mkPhone.trim().length < 7}
                onClick={() => marketing.mutate()}
              >
                <Send size={15} /> Kanalga e&apos;lon qilish
              </Button>

              {activeOffers.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-[var(--color-danger)]">
                  <AlertCircle size={14} /> Avval &quot;Narxlar&quot; bo&apos;limida
                  yo&apos;nalish qo&apos;shing.
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
