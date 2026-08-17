'use client';

import { useQuery } from '@tanstack/react-query';
import { apiSupportOpenCount } from '@/lib/endpoints';
import { useAuthStore } from '@/stores/auth-store';

const SUPPORT_VIEWER_ROLES = ['SUPERADMIN', 'ADMIN', 'MODERATOR'];

/** Yangi (javob berilmagan) support tiketlari soni — nav badge uchun, har 60s yangilanadi. */
export function useOpenTicketCount(): number {
  const admin = useAuthStore((s) => s.admin);
  const canSee = !!admin && SUPPORT_VIEWER_ROLES.includes(admin.role);
  const { data } = useQuery({
    queryKey: ['support', 'open-count'],
    queryFn: apiSupportOpenCount,
    enabled: canSee,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  return canSee ? data?.count ?? 0 : 0;
}
