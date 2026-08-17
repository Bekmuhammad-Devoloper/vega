'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { MobileBottomNav, MobileTopBar, Sidebar } from '@/components/layout/sidebar';
import { TelegramBackButton } from '@/components/telegram-back-button';
import { TrialBanner } from '@/components/trial-banner';

// Creator faqat shu bo'limlarga kira oladi (narxlar/takliflar + "Boshqa" menyu).
const CREATOR_ALLOWED = ['/offers', '/more'];

// Aniq yo'l yoki uning subpath'i (".../new", ".../[id]"). startsWith bilan prefiks
// to'qnashuvi bo'lmasin (masalan kelajakdagi "/products-archive" noto'g'ri ochilmasin).
function isCreatorAllowed(pathname: string): boolean {
  return CREATOR_ALLOWED.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { admin, initialized } = useAuthStore();

  useEffect(() => {
    if (!initialized) return;
    if (!admin) {
      router.replace('/login');
      return;
    }
    // Creator ruxsat etilmagan sahifaga kirsa — narxlar sahifasiga qaytaramiz.
    if (admin.role === 'CREATOR' && !isCreatorAllowed(pathname)) {
      router.replace('/offers');
    }
  }, [initialized, admin, pathname, router]);

  if (!admin) return null;
  // Creator ruxsatsiz route'da — redirect kutilmoqda, kontentni ko'rsatmaymiz (flash bo'lmasin).
  if (admin.role === 'CREATOR' && !isCreatorAllowed(pathname)) return null;

  return (
    <div className="min-h-dvh flex">
      <TelegramBackButton />
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileTopBar />
        <main className="flex-1 px-4 md:px-6 py-5 md:py-6 pb-24 md:pb-6 overflow-x-hidden">
          <TrialBanner />
          {children}
        </main>
        <MobileBottomNav />
      </div>
    </div>
  );
}
