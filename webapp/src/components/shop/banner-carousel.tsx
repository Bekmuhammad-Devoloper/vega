'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiBanners, type BannerDto } from '@/lib/api/endpoints';
import { haptic, openLink } from '@/lib/telegram';
import { cn } from '@/lib/cn';

/**
 * Do'kon bannerlari (admin → Bannerlar). Bir nechta bo'lsa — surib
 * almashtiriladi va 5 soniyada o'zi aylanadi. Banner bo'lmasa joy egallamaydi.
 */
export function BannerCarousel({
  placement,
  onOpenService,
  className,
  leading,
}: {
  placement: 'home' | 'category';
  /** Bannerlardan oldingi doimiy slayd (masalan, bosh sahifa sarlavhasi). */
  leading?: ReactNode;
  /** targetType=category|product — shu xizmatni (id yoki slug) ochadi. */
  onOpenService?: (idOrSlug: string) => void;
  className?: string;
}) {
  const { data } = useQuery({
    queryKey: ['banners', placement],
    queryFn: () => apiBanners(placement),
    staleTime: 5 * 60_000,
  });
  const banners = data ?? [];
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const count = banners.length + (leading ? 1 : 0);
  // Slayd nisbati birinchi banner rasmining O'Z nisbatidan olinadi — admin
  // qanday o'lchamda yuklamasin, rasm kesilmaydi. Juda past/baland rasmlarda
  // sarlavha slaydi sig'ishi uchun chegaralanadi.
  const [ratio, setRatio] = useState(2.4);

  useEffect(() => {
    if (count < 2) return;
    const t = setInterval(() => {
      const el = track.current;
      if (!el) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % count;
      el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
    }, 5000);
    return () => clearInterval(t);
  }, [count]);

  if (!count) return null;

  const click = (b: BannerDto) => {
    const v = b.targetValue?.trim();
    if (!v || b.targetType === 'none') return;
    haptic('light');
    if (b.targetType === 'url') openLink(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    else onOpenService?.(v);
  };

  return (
    <div className={className}>
      <div
        ref={track}
        onScroll={(e) => {
          const el = e.currentTarget;
          setActive(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-3xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {leading && (
          <div
            style={{ aspectRatio: ratio }}
            className="relative w-full shrink-0 snap-center overflow-hidden"
          >
            {leading}
          </div>
        )}
        {banners.map((b, i) => (
          <button
            key={b.id}
            type="button"
            onClick={() => click(b)}
            style={{ aspectRatio: ratio }}
            className="relative w-full shrink-0 snap-center overflow-hidden bg-[#0b1530]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={b.imageUrl}
              alt=""
              // Yon slaydlar ham oldindan yuklanadi — aks holda almashganda bo'sh joy ko'rinadi.
              loading={i < 3 ? 'eager' : 'lazy'}
              decoding="async"
              onLoad={(e) => {
                const im = e.currentTarget;
                if (i === 0 && im.naturalWidth && im.naturalHeight) {
                  setRatio(Math.min(2.6, Math.max(1.6, im.naturalWidth / im.naturalHeight)));
                }
              }}
              className="h-full w-full object-contain"
            />
          </button>
        ))}
      </div>
      {count > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {Array.from({ length: count }, (_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === active ? 'w-4 bg-[var(--color-primary)]' : 'w-1.5 bg-[var(--color-border)]',
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
