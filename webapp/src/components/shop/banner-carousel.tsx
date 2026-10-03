'use client';

import { useEffect, useRef, useState } from 'react';
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
}: {
  placement: 'home' | 'category';
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

  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => {
      const el = track.current;
      if (!el) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % banners.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
    }, 5000);
    return () => clearInterval(t);
  }, [banners.length]);

  if (!banners.length) return null;

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
        {banners.map((b, i) => (
          <button
            key={b.id}
            type="button"
            onClick={() => click(b)}
            className="relative aspect-[2.4/1] w-full shrink-0 snap-center overflow-hidden bg-[var(--color-bg)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={b.imageUrl}
              alt=""
              loading={i === 0 ? 'eager' : 'lazy'}
              decoding="async"
              className="h-full w-full object-cover"
            />
          </button>
        ))}
      </div>
      {banners.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {banners.map((b, i) => (
            <span
              key={b.id}
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
