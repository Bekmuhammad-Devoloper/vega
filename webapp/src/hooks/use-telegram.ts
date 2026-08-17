'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getWebApp } from '@/lib/telegram';

export function useTelegramInit(): void {
  useEffect(() => {
    const wa = getWebApp();
    if (!wa) return;
    try {
      wa.ready();
      wa.expand();
      wa.setHeaderColor('#FFFFFF');
      wa.setBackgroundColor('#F4F6FA');
    } catch {
      // ignore
    }
  }, []);
}

export function useTelegramBackButton(): void {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const wa = getWebApp();
    if (!wa?.BackButton) return;
    const isRoot = pathname === '/';
    const handler = () => router.back();

    if (isRoot) {
      wa.BackButton.hide();
    } else {
      wa.BackButton.show();
      wa.BackButton.onClick(handler);
    }
    return () => {
      wa.BackButton.offClick(handler);
    };
  }, [pathname, router]);
}

export function useTelegramUser() {
  const wa = getWebApp();
  return wa?.initDataUnsafe?.user ?? null;
}
