import { Badge } from '@/components/ui/badge';
import type { NumberOrderStatus } from '@/lib/types';

const LABELS: Record<NumberOrderStatus, string> = {
  WAITING_CODE: 'Kod kutilmoqda',
  RECEIVED: 'Kod olindi',
  CANCELLED: 'Bekor qilindi',
  EXPIRED: 'Muddati tugadi',
  ERROR: 'Xatolik',
};

const TONES: Record<NumberOrderStatus, 'amber' | 'green' | 'red' | 'gray'> = {
  WAITING_CODE: 'amber',
  RECEIVED: 'green',
  CANCELLED: 'red',
  EXPIRED: 'gray',
  ERROR: 'red',
};

export function NumberStatusBadge({ status }: { status: NumberOrderStatus }) {
  return <Badge tone={TONES[status] ?? 'gray'}>{LABELS[status] ?? status}</Badge>;
}

export const NUMBER_STATUS_LABEL = LABELS;
