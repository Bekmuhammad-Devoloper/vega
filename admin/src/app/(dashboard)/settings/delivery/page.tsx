'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Truck, ShoppingCart } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiUpdateStoreDelivery, apiListSettings, apiUpsertSetting } from '@/lib/endpoints';
import { toast } from '@/stores/toast-store';
import { SettingsHeader, useStore, formatMoneyInput, parseMoneyInput } from '../_shared';

export default function DeliverySettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useStore();
  const tenant = data?.tenant ?? null;

  // Yetkazib berish (per-tenant)
  const [delivery, setDelivery] = useState({ enabled: true, fee: 0, freeFrom: 0 });
  const inited = useRef(false);
  useEffect(() => {
    if (!tenant || inited.current) return;
    setDelivery({ enabled: tenant.delivery.enabled, fee: tenant.delivery.fee, freeFrom: tenant.delivery.freeFrom ?? 0 });
    inited.current = true;
  }, [tenant]);
  const saveDelivery = useMutation({
    mutationFn: () =>
      apiUpdateStoreDelivery({
        enabled: delivery.enabled,
        fee: delivery.fee,
        freeFrom: delivery.freeFrom > 0 ? delivery.freeFrom : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-store'] });
      toast.success('Yetkazib berish saqlandi');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Minimal buyurtma summasi (global business sozlamasi)
  const { data: settingsList } = useQuery({ queryKey: ['admin-settings'], queryFn: apiListSettings });
  const savedBusiness = (settingsList?.find((s) => s.key === 'business')?.value ?? {}) as Record<string, unknown>;
  const [minOrder, setMinOrder] = useState(0);
  const minInited = useRef(false);
  useEffect(() => {
    if (!settingsList || minInited.current) return;
    setMinOrder(Number(savedBusiness.minOrderAmount ?? 30000));
    minInited.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsList]);
  const saveMinOrder = useMutation({
    mutationFn: () => apiUpsertSetting('business', { ...savedBusiness, minOrderAmount: minOrder }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-settings'] });
      toast.success('Minimal buyurtma saqlandi');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div>
      <SettingsHeader title="Yetkazib berish" description="Yoqish/o'chirish, narx va minimal buyurtma" />

      {isLoading ? (
        <div className="max-w-2xl space-y-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-28" />
        </div>
      ) : !tenant ? (
        <Card>
          <div className="px-4 py-10 text-center text-sm text-[var(--color-text-muted)]">Do&apos;kon topilmadi</div>
        </Card>
      ) : (
        <div className="max-w-2xl space-y-4">
          <Card>
            <CardHeader title="Yetkazib berish" />
            <CardBody className="space-y-3">
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm">
                  <span className="font-medium">Yetkazib berish bor</span>
                  <span className="block text-xs text-[var(--color-text-muted)]">
                    O&apos;chirilsa — faqat olib ketish (narx olinmaydi)
                  </span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={delivery.enabled}
                  onClick={() => setDelivery({ ...delivery, enabled: !delivery.enabled })}
                  className={`relative h-6 w-11 rounded-full transition-colors shrink-0 ${delivery.enabled ? 'bg-[var(--color-primary)]' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${delivery.enabled ? 'translate-x-5' : ''}`} />
                </button>
              </label>

              {delivery.enabled && (
                <>
                  <Field label="Yetkazib berish narxi (so'm)">
                    <Input
                      value={formatMoneyInput(delivery.fee)}
                      onChange={(e) => setDelivery({ ...delivery, fee: parseMoneyInput(e.target.value) })}
                      placeholder="25 000"
                      inputMode="numeric"
                    />
                  </Field>
                  <Field label="Bepul yetkazib berish chegarasi (so'm)" hint="Shu summadan yuqori buyurtmaga bepul. 0 — bepul chegara yo'q.">
                    <Input
                      value={formatMoneyInput(delivery.freeFrom)}
                      onChange={(e) => setDelivery({ ...delivery, freeFrom: parseMoneyInput(e.target.value) })}
                      placeholder="500 000"
                      inputMode="numeric"
                    />
                  </Field>
                </>
              )}

              <Button loading={saveDelivery.isPending} onClick={() => saveDelivery.mutate()}>Saqlash</Button>
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                <Truck size={14} /> Narx checkout va buyurtmaga avtomatik qo&apos;llanadi.
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Minimal buyurtma" />
            <CardBody className="space-y-3">
              <Field label="Minimal buyurtma summasi (so'm)" hint="Mijoz shu summadan kam buyurtma bera olmaydi.">
                <Input
                  value={formatMoneyInput(minOrder)}
                  onChange={(e) => setMinOrder(parseMoneyInput(e.target.value))}
                  placeholder="30 000"
                  inputMode="numeric"
                />
              </Field>
              <Button loading={saveMinOrder.isPending} onClick={() => saveMinOrder.mutate()}>Saqlash</Button>
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                <ShoppingCart size={14} /> Buyurtma berishda eng kam summa.
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
