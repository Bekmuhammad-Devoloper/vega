'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

export function PageHeader({ title, rightSlot, backHref }: { title: string; rightSlot?: React.ReactNode; backHref?: string }) {
  const router = useRouter();
  const back = () => {
    if (backHref) router.push(backHref);
    else router.back();
  };
  return (
    <header className="sticky top-0 z-20 bg-[var(--color-bg)]/95 backdrop-blur border-b border-[var(--color-border)]/40">
      <div className="px-3 h-14 flex items-center gap-2 max-w-md mx-auto">
        <button
          onClick={back}
          className="h-9 w-9 rounded-full bg-white border border-[var(--color-border)] grid place-items-center"
          aria-label="Back"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-base font-semibold flex-1 truncate">{title}</h1>
        {rightSlot}
      </div>
    </header>
  );
}
