'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { MobileBottomNav, MobileTopBar, Sidebar } from '@/components/layout/sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { admin, initialized } = useAuthStore();

  useEffect(() => {
    if (initialized && !admin) router.replace('/login');
  }, [initialized, admin, router]);

  if (!admin) return null;

  return (
    <div className="min-h-dvh flex relative">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 relative">
        <MobileTopBar />
        <main className="flex-1 px-4 md:px-8 py-5 md:py-8 pb-24 md:pb-8 overflow-x-hidden fade-in">
          <div className="max-w-[1600px] mx-auto">{children}</div>
        </main>
        <MobileBottomNav />
      </div>
    </div>
  );
}
