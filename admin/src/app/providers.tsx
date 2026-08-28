'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { apiMe } from '@/lib/endpoints';
import { useAuthStore } from '@/stores/auth-store';
import { loadAccessToken } from '@/lib/api';
import { ToastContainer } from '@/components/ui/toast';
import type { AdminDto } from '@/lib/types';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <AuthInit>{children}</AuthInit>
      <ToastContainer />
    </QueryClientProvider>
  );
}

/** Oxirgi muvaffaqiyatli `apiMe()` natijasi — ilovani darhol chizish uchun. */
const ME_CACHE_KEY = 'admin_me';

function readCachedAdmin(): AdminDto | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ME_CACHE_KEY);
    return raw ? (JSON.parse(raw) as AdminDto) : null;
  } catch {
    return null;
  }
}

function forgetCachedAdmin(): void {
  try {
    localStorage.removeItem(ME_CACHE_KEY);
  } catch {
    /* localStorage o'chirilgan bo'lishi mumkin */
  }
}

function AuthInit({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { setAdmin, setInitialized, initialized } = useAuthStore();

  useEffect(() => {
    // Public sahifalar — auth talab qilmaydi (/register Telegram onboarding o'zini boshqaradi)
    const PUBLIC_PATHS = ['/login', '/register'];
    const isPublic = PUBLIC_PATHS.includes(pathname);
    const token = loadAccessToken();
    if (!token) {
      forgetCachedAdmin();
      setInitialized(true);
      if (!isPublic) router.replace('/login');
      return;
    }

    // TEZLIK: token bor va oldin muvaffaqiyatli kirgan bo'lsak — ilovani
    // DARHOL chizamiz, `apiMe()` esa fonda tekshiradi. Ilgari har ochilishda
    // butun ekran spinner bo'lib turib tarmoq javobi kutilardi (mobil
    // internetda bu 0.5–2 soniyalik "muzlash" degani edi).
    const cached = readCachedAdmin();
    if (cached) {
      setAdmin(cached);
      setInitialized(true);
    }

    apiMe()
      .then((admin) => {
        setAdmin(admin);
        setInitialized(true);
        try {
          localStorage.setItem(ME_CACHE_KEY, JSON.stringify(admin));
        } catch {
          /* kvota to'lgan bo'lishi mumkin — muhim emas */
        }
        if (isPublic) router.replace('/');
      })
      .catch(() => {
        // Token yaroqsiz — keshni tozalab, login'ga qaytaramiz.
        forgetCachedAdmin();
        setAdmin(null);
        setInitialized(true);
        if (!isPublic) router.replace('/login');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!initialized) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <div className="h-10 w-10 border-4 border-gray-200 border-t-[var(--color-primary)] rounded-full animate-spin" />
      </div>
    );
  }
  return <>{children}</>;
}
