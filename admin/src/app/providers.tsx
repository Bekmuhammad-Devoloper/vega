'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { apiMe } from '@/lib/endpoints';
import { useAuthStore } from '@/stores/auth-store';
import { loadAccessToken } from '@/lib/api';
import { ToastContainer } from '@/components/ui/toast';

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
      setInitialized(true);
      if (!isPublic) router.replace('/login');
      return;
    }
    apiMe()
      .then((admin) => {
        setAdmin(admin);
        setInitialized(true);
        if (isPublic) router.replace('/');
      })
      .catch(() => {
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
