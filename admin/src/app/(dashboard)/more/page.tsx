'use client';

import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import {
  BarChart3,
  ChevronRight,
  Gift,
  Image as ImageIcon,
  LogOut,
  Megaphone,
  MessageCircle,
  Radio,
  Settings,
  ShieldCheck,
  Sparkles,
  Tag,
  Users,
  UsersRound,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { StoreSwitcher } from '@/components/store-switcher';
import { apiLogout } from '@/lib/endpoints';
import { setAccessToken } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useOpenTicketCount } from '@/hooks/use-open-tickets';

interface Item {
  href: string;
  icon: typeof Settings;
  label: string;
  superadminOnly?: boolean;
  roles?: string[];
}

const BOSS = ['SUPERADMIN', 'ADMIN'];
const CATALOG = ['SUPERADMIN', 'ADMIN', 'CREATOR'];
const VIEWER = ['SUPERADMIN', 'ADMIN', 'MODERATOR'];

const ITEMS: Item[] = [
  { href: '/stars-premium', icon: Sparkles, label: 'Stars / Premium', roles: BOSS },
  { href: '/analytics', icon: BarChart3, label: 'Analytics', roles: VIEWER },
  { href: '/users', icon: Users, label: 'Foydalanuvchilar', roles: VIEWER },
  { href: '/promo-codes', icon: Tag, label: 'Promo kodlar', roles: CATALOG },
  { href: '/support', icon: MessageCircle, label: 'Support', roles: VIEWER },
  { href: '/banners', icon: ImageIcon, label: 'Bannerlar', roles: CATALOG },
  { href: '/channel-posts', icon: Radio, label: "Kanal e'lonlari", roles: CATALOG },
  { href: '/broadcasts', icon: Megaphone, label: 'Xabarnomalar', roles: BOSS },
  { href: '/team', icon: UsersRound, label: 'Jamoa', roles: BOSS },
  { href: '/referral', icon: Gift, label: 'Referal', roles: BOSS },
  { href: '/settings', icon: Settings, label: 'Sozlamalar', roles: BOSS },
  { href: '/admins', icon: ShieldCheck, label: 'Adminlar', superadminOnly: true },
];

export default function MorePage() {
  const admin = useAuthStore((s) => s.admin);
  const openTickets = useOpenTicketCount();
  const logout = useMutation({
    mutationFn: apiLogout,
    onSuccess: () => {
      setAccessToken(null);
      window.location.href = '/login';
    },
  });
  const visible = ITEMS.filter((i) => {
    // Creator faqat narxlar/takliflar bilan ishlaydi — "Boshqa" ro'yxati bo'sh.
    if (admin?.role === 'CREATOR') return false;
    if (i.superadminOnly && admin?.role !== 'SUPERADMIN') return false;
    if (i.roles && !(admin && i.roles.includes(admin.role))) return false;
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="pt-1 pb-1">
        <StoreSwitcher size="lg" />
      </div>

      <Card>
        <ul className="divide-y divide-[var(--color-border)]">
          {visible.map((it) => (
            <li key={it.href}>
              <Link href={it.href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50">
                <span className="h-9 w-9 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] grid place-items-center">
                  <it.icon size={18} />
                </span>
                <span className="flex-1 text-sm font-medium">{it.label}</span>
                {it.href === '/support' && openTickets > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-danger)] px-1.5 text-[11px] font-semibold text-white">
                    {openTickets > 99 ? '99+' : openTickets}
                  </span>
                )}
                <ChevronRight size={18} className="text-[var(--color-text-muted)]" />
              </Link>
            </li>
          ))}
          <li>
            <button onClick={() => logout.mutate()} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 text-left">
              <span className="h-9 w-9 rounded-xl bg-rose-50 text-[var(--color-danger)] grid place-items-center">
                <LogOut size={18} />
              </span>
              <span className="flex-1 text-sm font-medium">Chiqish</span>
            </button>
          </li>
        </ul>
      </Card>
    </div>
  );
}
