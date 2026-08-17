'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Smartphone, User } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useLocaleStore } from '@/stores/locale-store';
import { tr, getMessages } from '@/i18n';

const items = [
  {
    href: '/',
    label: 'catalog',
    icon: LayoutGrid,
    isActive: (p: string) => p === '/',
  },
  {
    href: '/orders',
    label: 'orders',
    icon: Smartphone,
    isActive: (p: string) => p.startsWith('/orders'),
  },
  {
    href: '/profile',
    label: 'profile',
    icon: User,
    isActive: (p: string) =>
      p.startsWith('/profile') || p.startsWith('/support') || p.startsWith('/about'),
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const locale = useLocaleStore((s) => s.locale);
  const messages = getMessages(locale);

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-[var(--color-border)] pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-3 max-w-md mx-auto">
        {items.map((it) => {
          const active = it.isActive(pathname);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 py-2.5 relative',
                  active ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]',
                )}
              >
                <it.icon size={22} />
                <span className="text-[10px] font-medium leading-tight">
                  {tr(messages, `nav.${it.label}`)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
