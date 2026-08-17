'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Phone,
  Tags,
  Sparkles,
  Wallet,
  Users,
  BarChart3,
  Tag,
  MessageCircle,
  Image as ImageIcon,
  Megaphone,
  Radio,
  Settings,
  ShieldCheck,
  UsersRound,
  LogOut,
  ChevronLeft,
  Menu,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { apiLogout } from '@/lib/endpoints';
import { useOpenTicketCount } from '@/hooks/use-open-tickets';
import { setAccessToken } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Brand } from '@/components/brand';
import { StoreSwitcher } from '@/components/store-switcher';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  superadminOnly?: boolean;
  roles?: string[]; // berilsa — faqat shu rollarga ko'rinadi
}

const BOSS = ['SUPERADMIN', 'ADMIN'];
const CATALOG = ['SUPERADMIN', 'ADMIN', 'CREATOR'];
const VIEWER = ['SUPERADMIN', 'ADMIN', 'MODERATOR'];

// Creator faqat shu sahifalarni ko'radi — boshqa hamma narsa yashiriladi.
const CREATOR_ROUTES = ['/offers', '/more'];
function navVisible(role: string | undefined, it: { href: string; superadminOnly?: boolean; roles?: string[] }): boolean {
  if (role === 'CREATOR') return CREATOR_ROUTES.includes(it.href);
  if (it.superadminOnly && role !== 'SUPERADMIN') return false;
  if (it.roles && !(role && it.roles.includes(role))) return false;
  return true;
}

const NAV: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/orders', label: 'Buyurtmalar', icon: Phone },
  { href: '/offers', label: 'Narxlar', icon: Tags, roles: CATALOG },
  { href: '/stars-premium', label: 'Stars / Premium', icon: Sparkles, roles: BOSS },
  { href: '/wallet', label: 'Hamyon', icon: Wallet, roles: BOSS },
  { href: '/users', label: 'Foydalanuvchilar', icon: Users, roles: VIEWER },
  { href: '/analytics', label: 'Analytics', icon: BarChart3, roles: VIEWER },
  { href: '/promo-codes', label: 'Promo kodlar', icon: Tag, roles: CATALOG },
  { href: '/support', label: 'Support', icon: MessageCircle, roles: VIEWER },
  { href: '/banners', label: 'Bannerlar', icon: ImageIcon, roles: CATALOG },
  { href: '/channel-posts', label: "Kanal e'lonlari", icon: Radio, roles: CATALOG },
  { href: '/broadcasts', label: 'Xabarnomalar', icon: Megaphone, roles: BOSS },
  { href: '/team', label: 'Jamoa', icon: UsersRound, roles: BOSS },
  { href: '/settings', label: 'Sozlamalar', icon: Settings, roles: BOSS },
  { href: '/admins', label: 'Adminlar', icon: ShieldCheck, superadminOnly: true },
];

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-danger)] px-1.5 text-[11px] font-semibold text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const admin = useAuthStore((s) => s.admin);
  const openTickets = useOpenTicketCount();

  const logout = useMutation({
    mutationFn: apiLogout,
    onSuccess: () => {
      setAccessToken(null);
      window.location.href = '/login';
    },
  });

  const visibleNav = NAV.filter((it) => navVisible(admin?.role, it));

  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-[var(--color-border)] bg-white shrink-0 h-dvh sticky top-0">
      <div className="px-5 h-14 flex items-center border-b border-[var(--color-border)]">
        <Brand />
      </div>
      <div className="px-3 pt-3">
        <StoreSwitcher />
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <ul className="space-y-0.5">
          {visibleNav.map((it) => {
            const active = it.href === '/' ? pathname === '/' : pathname.startsWith(it.href);
            return (
              <li key={it.href}>
                <Link
                  href={it.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                    active
                      ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                      : 'text-[var(--color-text)] hover:bg-gray-50',
                  )}
                >
                  <it.icon size={18} />
                  {it.label}
                  {it.href === '/support' && <NavBadge count={openTickets} />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-[var(--color-border)] px-4 py-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-9 w-9 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] grid place-items-center font-semibold text-sm">
            {admin?.fullName.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{admin?.fullName}</p>
            <p className="text-xs text-[var(--color-text-muted)] truncate">{admin?.role}</p>
          </div>
        </div>
        <button
          onClick={() => logout.mutate()}
          className="w-full inline-flex items-center justify-center gap-2 h-9 rounded-xl text-sm font-medium text-[var(--color-text-muted)] hover:bg-gray-50"
        >
          <LogOut size={16} /> Chiqish
        </button>
      </div>
    </aside>
  );
}

export function MobileTopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const isRoot = pathname === '/';
  return (
    <header className="md:hidden sticky top-0 z-30 bg-white border-b border-[var(--color-border)]">
      <div className="px-3 h-14 flex items-center gap-1">
        {!isRoot && (
          <button
            onClick={() => router.back()}
            aria-label="Orqaga"
            className="h-9 w-9 grid place-items-center rounded-full text-[var(--color-text)] hover:bg-gray-100 active:scale-95 transition"
          >
            <ChevronLeft size={22} />
          </button>
        )}
        <Brand />
      </div>
    </header>
  );
}

const BOTTOM_NAV: NavItem[] = [
  { href: '/', label: 'Bosh', icon: LayoutDashboard },
  { href: '/orders', label: 'Raqamlar', icon: Phone },
  { href: '/offers', label: 'Narxlar', icon: Tags, roles: CATALOG },
  { href: '/wallet', label: 'Hamyon', icon: Wallet, roles: BOSS },
  { href: '/more', label: 'Boshqa', icon: Menu },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const openTickets = useOpenTicketCount();
  const admin = useAuthStore((s) => s.admin);
  const items = BOTTOM_NAV.filter((it) => navVisible(admin?.role, it));
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-[var(--color-border)] pb-[env(safe-area-inset-bottom)]">
      <ul
        className="grid px-1 pt-1"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((it) => {
          const active = it.href === '/' ? pathname === '/' : pathname.startsWith(it.href);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 py-2 mx-1 rounded-xl transition-colors',
                  active
                    ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/10'
                    : 'text-[var(--color-text-muted)] active:bg-gray-100',
                )}
              >
                <span className="relative">
                  <it.icon size={20} />
                  {it.href === '/more' && openTickets > 0 && (
                    <span className="absolute -right-2 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[10px] font-semibold text-white">
                      {openTickets > 9 ? '9+' : openTickets}
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-medium">{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
