'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TariffUpgrade } from '@/components/tariff-upgrade';
import { SettingsHeader, useStore, TARIFF_LABELS } from '../_shared';

export default function TariffSettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useStore();
  const tenant = data?.tenant ?? null;

  return (
    <div>
      <SettingsHeader title="Tarif" description="Joriy reja va yangilash" />

      {isLoading ? (
        <div className="max-w-2xl">
          <Skeleton className="h-72" />
        </div>
      ) : !tenant ? (
        <Card>
          <div className="px-4 py-10 text-center text-sm text-[var(--color-text-muted)]">Do&apos;kon topilmadi</div>
        </Card>
      ) : (
        <div className="max-w-2xl">
          <Card>
            <CardHeader title={`Joriy tarif: ${TARIFF_LABELS[tenant.tariffPlan] ?? tenant.tariffPlan}`} />
            <CardBody className="space-y-3 text-sm">
              {tenant.pendingTariff && (
                <p className="text-amber-600">
                  To&apos;lov kutilmoqda:{' '}
                  <span className="font-semibold">{TARIFF_LABELS[tenant.pendingTariff] ?? tenant.pendingTariff}</span>{' '}
                  — tasdiqlanishi bilan faollashadi
                </p>
              )}
              <TariffUpgrade
                currentPlan={tenant.tariffPlan}
                onClose={() => qc.invalidateQueries({ queryKey: ['my-store'] })}
              />
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
