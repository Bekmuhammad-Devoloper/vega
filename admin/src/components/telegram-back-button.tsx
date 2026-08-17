'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface TgBackButton {
  show: () => void;
  hide: () => void;
  onClick: (cb: () => void) => void;
  offClick: (cb: () => void) => void;
}
interface TgWebApp {
  ready?: () => void;
  expand?: () => void;
  BackButton?: TgBackButton;
}

function getWebApp(): TgWebApp | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
}

/**
 * Telegram Mini App'ning native "orqaga" tugmasini boshqaradi:
 * root sahifada yashiradi, ichki sahifalarda ko'rsatadi va bosilganda orqaga qaytaradi.
 */
export function TelegramBackButton() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const wa = getWebApp();
    wa?.ready?.();
    wa?.expand?.();
  }, []);

  useEffect(() => {
    const bb = getWebApp()?.BackButton;
    if (!bb) return;
    const handler = () => router.back();
    bb.onClick(handler);
    if (pathname && pathname !== '/') bb.show();
    else bb.hide();
    return () => {
      bb.offClick(handler);
    };
  }, [pathname, router]);

  return null;
}
