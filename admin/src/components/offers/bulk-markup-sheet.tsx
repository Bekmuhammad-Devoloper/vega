'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Info, Loader2, Search, Sparkles } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { PickerSelect } from '@/components/picker-select';
import { CountryFlag } from '@/components/country-flag';
import { ServiceIcon } from '@/components/service-icon';
import { apiBulkMarkup, apiBulkMarkupStatus, apiServiceCountries } from '@/lib/endpoints';
import { formatMoney } from '@/lib/format';
import type { AdminOffer, ServiceDto } from '@/lib/types';
import { toast } from '@/stores/toast-store';
import { cn } from '@/lib/cn';

const parseMoney = (t: string) => Number(t.replace(/\D/g, '')) || 0;
const fmtMoneyInput = (n: number) => (n ? n.toLocaleString('ru-RU').replace(/,/g, ' ') : '');

type Mode = 'all' | 'pick';

/**
 * Ommaviy ustama: tanlangan (yoki barcha) davlatlarga bir xil ustama.
 * Sotuv narxi = JORIY tan narxi + ustama — tan narxi o'zgarsa narx o'zi
 * yangilanadi (avto-narx). Narxlash serverda fonda yuradi, bu oyna esa
 * jarayonni kuzatib turadi.
 */
export function BulkMarkupSheet({
  services,
  offers,
  onClose,
}: {
  services: ServiceDto[];
  offers: AdminOffer[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [serviceId, setServiceId] = useState('');
  const [mode, setMode] = useState<Mode>('all');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [markupText, setMarkupText] = useState('');
  const [watching, setWatching] = useState(false);
  const markup = parseMoney(markupText);

  const { data: countries, isFetching: countriesLoading } = useQuery({
    queryKey: ['service-countries', serviceId],
    queryFn: () => apiServiceCountries(serviceId),
    enabled: !!serviceId,
  });
  const list = countries ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? list.filter((c) => c.nameUz.toLowerCase().includes(q)) : list;
  }, [list, search]);

  const targetIds = mode === 'all' ? list.map((c) => c.id) : [...picked];
  const existing = useMemo(() => {
    const set = new Set(targetIds);
    return offers.filter((o) => o.serviceId === serviceId && set.has(o.countryId));
  }, [offers, serviceId, targetIds]);
  const manualExisting = existing.filter((o) => o.markupUzs == null).length;

  // Jarayon holati — boshlangach har 1.5 soniyada kuzatamiz.
  const { data: status } = useQuery({
    queryKey: ['bulk-markup-status'],
    queryFn: apiBulkMarkupStatus,
    refetchInterval: watching ? 1500 : false,
  });
  // Oyna ochilganda oldingi jarayon hali ketayotgan bo'lsa — kuzatishni davom ettiramiz.
  useEffect(() => {
    if (status?.running) setWatching(true);
  }, [status?.running]);
  useEffect(() => {
    if (watching && status && !status.running && status.finishedAt) {
      setWatching(false);
      qc.invalidateQueries({ queryKey: ['offers'] });
      toast.success(
        `${status.priced} ta yo'nalish narxlandi` +
          (status.skipped ? ` · ${status.skipped} tasida hozir raqam yo'q` : ''),
      );
    }
  }, [watching, status, qc]);

  const start = useMutation({
    mutationFn: () =>
      apiBulkMarkup(
        mode === 'all'
          ? { serviceId, all: true, markupUzs: markup }
          : { serviceId, countryIds: [...picked], markupUzs: markup },
      ),
    onSuccess: (s) => {
      qc.setQueryData(['bulk-markup-status'], s);
      setWatching(true);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const running = !!status?.running;
  const pct = status?.total ? Math.round((status.done / status.total) * 100) : 0;
  const valid = !!serviceId && targetIds.length > 0 && markupText.trim() !== '' && !running;

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Sheet open onClose={onClose} title="Ommaviy ustama">
      <div className="space-y-4">
        <div className="flex gap-2.5 rounded-2xl bg-[var(--color-primary)]/[0.06] p-3.5">
          <Sparkles size={16} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
          <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
            Sotuv narxi = <b className="text-[var(--color-text)]">tan narxi + siz kiritgan ustama</b>.
            Tan narxi o&apos;zgarsa, narx <b className="text-[var(--color-text)]">avtomatik</b>{' '}
            yangilanadi — hech qachon zarariga sotmaysiz.
          </p>
        </div>

        {running || (status?.finishedAt && watching) ? (
          <div className="rounded-2xl border border-[var(--color-border)] p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="inline-flex items-center gap-2 font-semibold">
                <Loader2 size={15} className="animate-spin text-[var(--color-primary)]" />
                Narxlanmoqda…
              </span>
              <span className="tabular-nums text-[var(--color-text-muted)]">
                {status?.done ?? 0} / {status?.total ?? 0}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bg)]">
              <div
                className="h-full rounded-full bg-[var(--color-primary)] transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              Narxlandi: <b className="text-[var(--color-success)]">{status?.priced ?? 0}</b>
              {status?.skipped ? (
                <>
                  {' '}· hozir raqam yo&apos;q: <b>{status.skipped}</b>
                </>
              ) : null}
              . Oynani yopsangiz ham jarayon davom etadi.
            </p>
          </div>
        ) : (
          <>
            <Field label="Xizmat">
              <PickerSelect
                value={serviceId}
                onChange={(v) => {
                  setServiceId(v);
                  setPicked(new Set());
                }}
                options={services.map((s) => ({
                  value: s.id,
                  label: s.nameUz,
                  icon: <ServiceIcon slug={s.slug} emoji={s.emoji} />,
                }))}
                placeholder="Xizmatni tanlang"
                title="Xizmat"
              />
            </Field>

            {serviceId && (
              <Field label="Qaysi davlatlarga?">
                <Segmented<Mode>
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: 'all', label: `Hammasi${list.length ? ` (${list.length})` : ''}` },
                    { value: 'pick', label: `Tanlash${picked.size ? ` (${picked.size})` : ''}` },
                  ]}
                />
              </Field>
            )}

            {serviceId && mode === 'pick' && (
              <div className="rounded-2xl border border-[var(--color-border)]">
                <div className="flex items-center gap-2 border-b border-[var(--color-border)] p-2">
                  <div className="relative flex-1">
                    <Search
                      size={14}
                      className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                    />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Davlatni qidirish"
                      className="h-9 pl-8 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setPicked((prev) => {
                        const next = new Set(prev);
                        const allOn = filtered.every((c) => next.has(c.id));
                        filtered.forEach((c) => (allOn ? next.delete(c.id) : next.add(c.id)));
                        return next;
                      })
                    }
                    className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10"
                  >
                    {filtered.length && filtered.every((c) => picked.has(c.id))
                      ? 'Tozalash'
                      : 'Belgilash'}
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto p-1">
                  {countriesLoading ? (
                    <p className="p-3 text-center text-xs text-[var(--color-text-muted)]">
                      Davlatlar yuklanmoqda…
                    </p>
                  ) : (
                    filtered.map((c) => {
                      const on = picked.has(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggle(c.id)}
                          className={cn(
                            'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors',
                            on ? 'bg-[var(--color-primary)]/[0.07]' : 'hover:bg-[var(--color-bg)]',
                          )}
                        >
                          <span
                            className={cn(
                              'grid h-[18px] w-[18px] shrink-0 place-items-center rounded-md border transition-colors',
                              on
                                ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                                : 'border-[var(--color-border)]',
                            )}
                          >
                            {on && <CheckCircle2 size={12} strokeWidth={3} />}
                          </span>
                          <CountryFlag
                            iso2={c.iso2}
                            className="h-4 w-[22px] shrink-0 rounded-[3px] object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.1)]"
                          />
                          <span className="truncate">{c.nameUz}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {serviceId && (
              <Field
                label="Ustama (so'm)"
                hint="Har bir raqamdan olinadigan sizning foydangiz — tan narxi ustiga qo'shiladi"
              >
                <Input
                  inputMode="numeric"
                  value={markupText}
                  onChange={(e) => {
                    // 0 ham yaroqli ustama (sof tan narxida sotish) — bo'sh qatordan farqlaymiz.
                    const digits = e.target.value.replace(/\D/g, '');
                    setMarkupText(digits === '' ? '' : fmtMoneyInput(Number(digits)) || '0');
                  }}
                  placeholder="2 000"
                />
              </Field>
            )}

            {serviceId && targetIds.length > 0 && markupText.trim() !== '' && (
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-xs leading-relaxed text-[var(--color-text-muted)]">
                <p>
                  <b className="text-[var(--color-text)]">{targetIds.length}</b> ta davlat ·
                  ustama <b className="text-[var(--color-success)]">+{formatMoney(markup)}</b>
                </p>
                <p className="mt-1">
                  Masalan, tan narxi {formatMoney(7800)} bo&apos;lsa — mijozga{' '}
                  <b className="text-[var(--color-text)]">
                    {formatMoney(Math.ceil((7800 + markup) / 100) * 100)}
                  </b>
                  .
                </p>
                {manualExisting > 0 && (
                  <p className="mt-1.5 flex gap-1.5 text-amber-700">
                    <Info size={13} className="mt-0.5 shrink-0" />
                    <span>
                      {manualExisting} ta mavjud taklifning qo&apos;lda qo&apos;yilgan narxi avto-narxga
                      almashadi.
                    </span>
                  </p>
                )}
                <p className="mt-1.5">
                  Hozir raqami yo&apos;q davlatlar o&apos;tkazib yuboriladi.
                </p>
              </div>
            )}

            <Button
              fullWidth
              loading={start.isPending}
              disabled={!valid}
              onClick={() => start.mutate()}
            >
              Qo&apos;llash
            </Button>
          </>
        )}
      </div>
    </Sheet>
  );
}
