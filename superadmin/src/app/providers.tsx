'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { loadAccessToken } from '@/lib/api';
import { apiFetchMe } from '@/lib/endpoints';
import { useAuthStore } from '@/stores/auth-store';
import { ToastViewport } from '@/components/ui/toast';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  const setAdmin = useAuthStore((s) => s.setAdmin);
  const setInitialized = useAuthStore((s) => s.setInitialized);

  useEffect(() => {
    const token = loadAccessToken();
    if (!token) {
      setInitialized(true);
      return;
    }
    apiFetchMe()
      .then((admin) => setAdmin(admin))
      .catch(() => setAdmin(null))
      .finally(() => setInitialized(true));
  }, [setAdmin, setInitialized]);

  return (
    <QueryClientProvider client={client}>
      {children}
      <ToastViewport />
    </QueryClientProvider>
  );
}
