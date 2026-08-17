'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Receipt,
  Wallet,
  BarChart3,
  Server,
  MessageCircle,
  Megaphone,
  Users,
  ScrollText,
  Tags,
  Gift,
  Sparkles,
  Star,
  Settings,
  Wrench,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { apiLogout } from '@/lib/endpoints';
import { setAccessToken } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { PlatformRole } from '@/lib/types';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: PlatformRole[];
  badge?: string;
  exact?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    label: 'Boshqaruv',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/tenants', label: 'Do\'konlar', icon: Building2 },
      { href: '/subscriptions', label: 'Obunalar', icon: CreditCard, roles: ['FINANCE', 'SALES'] },
      { href: '/billing', label: 'Billing', icon: Receipt, roles: ['FINANCE'] },
      { href: '/topups', label: "To'ldirishlar", icon: Wallet, roles: ['FINANCE'] },
    ],
  },
  {
    label: 'Analitika',
    items: [
      { href: '/analytics', label: 'Platforma analitika', icon: BarChart3 },
      { href: '/infrastructure', label: 'Server resurslari', icon: Server, roles: ['DEVOPS'] },
    ],
  },
  {
    label: 'Stars/Premium',
    items: [
      { href: '/digital', label: 'Yetkazish', icon: Sparkles, exact: true },
      { href: '/digital/products', label: 'Mahsulotlar', icon: Star },
    ],
  },
  {
    label: 'Operatsiya',
    items: [
      { href: '/support', label: 'Support', icon: MessageCircle, roles: ['SUPPORT'] },
      { href: '/broadcasts', label: 'Broadcasts', icon: Megaphone, roles: ['SALES', 'SUPPORT'] },
    ],
  },
  {
    label: 'Konfiguratsiya',
    items: [
      { href: '/tariffs', label: 'Tariflar', icon: Tags, roles: ['FINANCE'] },
      { href: '/referral', label: 'Referal', icon: Gift, roles: ['FINANCE'] },
      { href: '/team', label: 'Komanda', icon: Users },
      { href: '/audit', label: 'Audit log', icon: ScrollText, roles: ['DEVOPS', 'FINANCE'] },
      { href: '/settings', label: 'Sozlamalar', icon: Settings, roles: ['DEVOPS'] },
      { href: '/dev', label: 'Dev tools', icon: Wrench, roles: ['DEVOPS'] },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const admin = useAuthStore((s) => s.admin);
  const hasRole = useAuthStore((s) => s.hasRole);

  const logout = useMutation({
    mutationFn: apiLogout,
    onSuccess: () => {
      setAccessToken(null);
      window.location.href = '/login';
    },
  });

  const visibleGroups = NAV.map((group) => ({
    ...group,
    items: group.items.filter((it) => !it.roles || hasRole(...it.roles)),
  })).filter((g) => g.items.length > 0);

  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] shrink-0 h-dvh sticky top-0 relative z-10">
      {/* Logo */}
      <div className="px-5 h-16 flex items-center border-b border-[var(--color-border)] gap-3">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] grid place-items-center text-white shadow-lg shadow-indigo-500/30">
          <span className="text-sm font-bold">SA</span>
        </div>
        <div>
          <h1 className="font-bold text-sm leading-tight">Super Admin</h1>
          <p className="text-[10px] text-[var(--color-text-subtle)] uppercase tracking-wider">
            Control Tower
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5 no-scrollbar">
        {visibleGroups.map((group) => (
          <div key={group.label}>
            <div className="px-3 mb-1.5 text-[10px] font-semibold text-[var(--color-text-subtle)] uppercase tracking-wider">
              {group.label}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((it) => {
                const active =
                  it.exact || it.href === '/'
                    ? pathname === it.href
                    : pathname.startsWith(it.href);
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group',
                        active
                          ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)] shadow-sm'
                          : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]',
                      )}
                    >
                      <it.icon
                        size={17}
                        className={cn(
                          'transition-transform',
                          active && 'scale-110',
                        )}
                      />
                      <span className="flex-1">{it.label}</span>
                      {it.badge && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--color-danger)]/20 text-[var(--color-danger)]">
                          {it.badge}
                        </span>
                      )}
                      {active && <ChevronRight size={14} />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-[var(--color-border)] px-3 py-3">
        <Link
          href="/team"
          className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors mb-1.5"
        >
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] grid place-items-center text-white font-semibold text-sm shadow-md">
            {admin?.fullName.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate text-[var(--color-text)]">
              {admin?.fullName}
            </p>
            <p className="text-[10px] text-[var(--color-text-subtle)] uppercase tracking-wider">
              {admin?.role}
            </p>
          </div>
        </Link>
        <button
          onClick={() => logout.mutate()}
          className="w-full inline-flex items-center justify-center gap-2 h-9 rounded-lg text-xs font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] transition-colors"
        >
          <LogOut size={14} /> Chiqish
        </button>
      </div>
    </aside>
  );
}

export function MobileTopBar() {
  return (
    <header className="md:hidden sticky top-0 z-30 glass border-b border-[var(--color-border)]">
      <div className="px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] grid place-items-center text-white text-xs font-bold">
            SA
          </div>
          <h1 className="font-bold text-sm">Super Admin</h1>
        </div>
      </div>
    </header>
  );
}

const BOTTOM_NAV: NavItem[] = [
  { href: '/', label: 'Bosh', icon: LayoutDashboard },
  { href: '/tenants', label: 'Do\'konlar', icon: Building2 },
  { href: '/analytics', label: 'Analitika', icon: BarChart3 },
  { href: '/billing', label: 'Billing', icon: Receipt },
  { href: '/team', label: 'Komanda', icon: Users },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 glass border-t border-[var(--color-border)] pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-5">
        {BOTTOM_NAV.map((it) => {
          const active = it.href === '/' ? pathname === '/' : pathname.startsWith(it.href);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 py-2.5 transition-colors',
                  active
                    ? 'text-[var(--color-primary)]'
                    : 'text-[var(--color-text-muted)]',
                )}
              >
                <it.icon size={20} />
                <span className="text-[10px] font-medium">{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
