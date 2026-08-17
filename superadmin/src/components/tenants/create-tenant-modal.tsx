'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Gift, Star, Rocket, Crown, type LucideIcon } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { apiCreateTenant } from '@/lib/endpoints';
import type { TariffPlan } from '@/lib/types';
import { toast } from '@/stores/toast-store';

const TARIFFS: {
  plan: TariffPlan;
  Icon: LucideIcon;
  name: string;
  price: string;
  color: string;
}[] = [
  { plan: 'FREE', Icon: Gift, name: 'Free', price: '0', color: 'text-[var(--color-tier-free)]' },
  { plan: 'STANDARD', Icon: Star, name: 'Standard', price: '199 000', color: 'text-[var(--color-tier-standard)]' },
  { plan: 'PRO', Icon: Rocket, name: 'Pro', price: '499 000', color: 'text-[var(--color-tier-pro)]' },
  { plan: 'PREMIUM', Icon: Crown, name: 'Premium', price: '999 000', color: 'text-[var(--color-tier-premium)]' },
];

export function CreateTenantModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [slug, setSlug] = useState('');
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerTelegramId, setOwnerTelegramId] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [tariffPlan, setTariffPlan] = useState<TariffPlan>('FREE');

  const mut = useMutation({
    mutationFn: () =>
      apiCreateTenant({
        slug,
        shopName,
        ownerName,
        ownerEmail: ownerEmail.trim() || undefined,
        ownerTelegramId: ownerTelegramId.trim() || undefined,
        ownerPhone: ownerPhone.trim() || undefined,
        tariffPlan,
      }),
    onSuccess: (t) => {
      toast.success(`"${t.shopName}" yaratildi`);
      // Reset
      setSlug('');
      setShopName('');
      setOwnerName('');
      setOwnerTelegramId('');
      setOwnerEmail('');
      setOwnerPhone('');
      setTariffPlan('FREE');
      onCreated(t.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-\s]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 40);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // Telegram orqali kirish asosiy — lekin egasini aniqlash uchun
    // Telegram ID yoki email'dan kamida bittasi bo'lishi shart.
    if (!ownerTelegramId.trim() && !ownerEmail.trim()) {
      toast.error('Telegram ID yoki email kiriting');
      return;
    }
    mut.mutate();
  }

  return (
    <Modal open={open} onClose={onClose} title="Yangi do'kon yaratish" size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Do'kon nomi">
            <Input
              value={shopName}
              onChange={(e) => {
                setShopName(e.target.value);
                if (!slug) setSlug(generateSlug(e.target.value));
              }}
              placeholder="Eshik Bozori"
              required
              autoFocus
            />
          </Field>
          <Field label="Slug (URL)" hint="shop-name.platform.uz">
            <Input
              value={slug}
              onChange={(e) =>
                setSlug(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, '')
                    .slice(0, 40),
                )
              }
              placeholder="eshik-bozori"
              required
              pattern="[a-z0-9-]+"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Egasi (ism)">
            <Input
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Sardor Karimov"
              required
            />
          </Field>
          <Field label="Telegram ID" hint="Sotuvchining raqamli ID si">
            <Input
              inputMode="numeric"
              value={ownerTelegramId}
              onChange={(e) =>
                setOwnerTelegramId(e.target.value.replace(/[^0-9]/g, ''))
              }
              placeholder="123456789"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Email" hint="Ixtiyoriy">
            <Input
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="sardor@eshik.uz"
            />
          </Field>
          <Field label="Telefon" hint="Ixtiyoriy">
            <Input
              type="tel"
              value={ownerPhone}
              onChange={(e) => setOwnerPhone(e.target.value)}
              placeholder="+998 90 123 45 67"
            />
          </Field>
        </div>

        <Field label="Boshlang'ich tarif">
          <div className="grid grid-cols-2 gap-2">
            {TARIFFS.map(({ plan, Icon, name, price, color }) => {
              const active = tariffPlan === plan;
              return (
                <button
                  key={plan}
                  type="button"
                  onClick={() => setTariffPlan(plan)}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                    active
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 ring-1 ring-[var(--color-primary)]'
                      : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-primary)]/30'
                  }`}
                >
                  <Icon className={`h-5 w-5 shrink-0 ${color}`} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--color-text)]">
                      {name}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      {price} so'm
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Field>

        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Bekor
          </Button>
          <Button type="submit" loading={mut.isPending}>
            Yaratish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
