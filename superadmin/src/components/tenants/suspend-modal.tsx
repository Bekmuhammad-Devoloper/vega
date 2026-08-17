'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Ban } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Textarea, Select } from '@/components/ui/input';
import { apiSuspendTenant } from '@/lib/endpoints';
import type { TenantDto } from '@/lib/types';
import { toast } from '@/stores/toast-store';

const REASONS = [
  "To'lovi muddati o'tgan",
  "Shartnoma buzilgan",
  "Mijoz so'roviga ko'ra",
  "Spam yoki firibgarlik",
  'Texnik tekshiruv',
  'Boshqa',
];

export function SuspendModal({
  tenant,
  onClose,
  onChanged,
}: {
  tenant: TenantDto | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [reason, setReason] = useState(REASONS[0]);
  const [detail, setDetail] = useState('');

  const mut = useMutation({
    mutationFn: () => apiSuspendTenant(tenant!.id, detail ? `${reason}: ${detail}` : reason),
    onSuccess: () => {
      toast.success("Do'kon to'xtatildi");
      setReason(REASONS[0]);
      setDetail('');
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal
      open={!!tenant}
      onClose={onClose}
      title={`Do'konni to'xtatish — ${tenant?.shopName ?? ''}`}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mut.mutate();
        }}
        className="space-y-3"
      >
        <p className="text-xs text-[var(--color-warning)] bg-[var(--color-warning)]/10 px-3 py-2 rounded-lg">
          ⚠️ Do'kon mijozlar uchun mavjud bo'lmaydi, lekin ma'lumotlar saqlanadi.
          Resume orqali qayta yoqishingiz mumkin.
        </p>

        <Field label="To'xtatish sababi">
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Qo'shimcha izoh" hint="Ixtiyoriy">
          <Textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Tafsilotlarni yozing..."
            rows={3}
          />
        </Field>

        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Bekor
          </Button>
          <Button type="submit" variant="danger" loading={mut.isPending}>
            <Ban size={14} />
            To'xtatish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
