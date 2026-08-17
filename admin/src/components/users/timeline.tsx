'use client';

import Image from 'next/image';
import { useEffect, useRef, type ReactElement } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Activity, Eye, Heart, ShoppingCart, Package, X, Search, Tag } from 'lucide-react';
import { apiUserTimeline } from '@/lib/endpoints';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/format';
import type { UserEventItem } from '@/lib/types';

const ICONS: Record<string, ReactElement> = {
  VIEW_HOME: <Activity size={14} className="text-[var(--color-info)]" />,
  VIEW_CATALOG: <Activity size={14} className="text-[var(--color-info)]" />,
  VIEW_PRODUCT: <Eye size={14} className="text-[var(--color-primary)]" />,
  SEARCH_QUERY: <Search size={14} className="text-[var(--color-info)]" />,
  CART_ADD: <ShoppingCart size={14} className="text-[var(--color-success)]" />,
  CART_REMOVE: <X size={14} className="text-[var(--color-danger)]" />,
  CART_UPDATE_QTY: <ShoppingCart size={14} className="text-[var(--color-text-muted)]" />,
  FAVORITE_ADD: <Heart size={14} className="text-[var(--color-danger)]" />,
  FAVORITE_REMOVE: <X size={14} className="text-[var(--color-text-muted)]" />,
  CHECKOUT_START: <Package size={14} className="text-[var(--color-warning)]" />,
  ORDER_PLACED: <Package size={14} className="text-[var(--color-success)]" />,
  ORDER_CANCEL: <X size={14} className="text-[var(--color-danger)]" />,
  PROMO_APPLY: <Tag size={14} className="text-[var(--color-success)]" />,
  PROMO_REMOVE: <Tag size={14} className="text-[var(--color-text-muted)]" />,
};

const LABELS: Record<string, string> = {
  VIEW_HOME: '🏠 Bosh sahifaga kirdi',
  VIEW_CATALOG: '📑 Katalog ko\'rdi',
  VIEW_CATEGORY: '📁 Kategoriya ochdi',
  VIEW_PRODUCT: 'Mahsulotni ko\'rdi',
  VIEW_CART: '🛒 Savatga kirdi',
  VIEW_FAVORITES: '❤️ Sevimlilarni ochdi',
  VIEW_ORDERS: '📋 Buyurtmalarni ochdi',
  VIEW_ORDER_DETAIL: 'Buyurtma detalini ochdi',
  SEARCH_QUERY: 'Qidirdi',
  APPLY_FILTER: 'Filter qo\'lladi',
  CART_ADD: 'Savatga qo\'shdi',
  CART_UPDATE_QTY: 'Miqdorni o\'zgartirdi',
  CART_REMOVE: 'Savatdan o\'chirdi',
  FAVORITE_ADD: 'Sevimlilarga qo\'shdi',
  FAVORITE_REMOVE: 'Sevimlidan o\'chirdi',
  PROMO_APPLY: 'Promo kod qo\'lladi',
  PROMO_REMOVE: 'Promo kodni o\'chirdi',
  CHECKOUT_START: 'Checkoutni boshladi',
  ORDER_PLACED: '✅ Buyurtma berdi',
  ORDER_CANCEL: '❌ Buyurtmani bekor qildi',
  PRODUCT_DURATION: 'Sahifada vaqt o\'tkazdi',
  BANNER_CLICK: 'Banner bosdi',
};

function payloadText(e: UserEventItem): string | null {
  if (!e.payload) return null;
  if (e.type === 'SEARCH_QUERY') {
    return `«${(e.payload.q as string) ?? ''}»`;
  }
  if (e.type === 'PRODUCT_DURATION') {
    return `${(e.payload.durationSec as number) ?? 0}s`;
  }
  if (e.type === 'PROMO_APPLY' && e.payload.code) {
    return `${e.payload.code}`;
  }
  return null;
}

export function UserTimeline({ userId }: { userId: string }) {
  const query = useInfiniteQuery({
    queryKey: ['user-timeline', userId],
    queryFn: ({ pageParam }) => apiUserTimeline(userId, { cursor: pageParam, limit: 50 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
    });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [query]);

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  if (query.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <div className="px-4 py-10 text-center text-sm text-[var(--color-text-muted)]">Hech qanday harakat yo&apos;q</div>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <ul className="divide-y divide-[var(--color-border)]">
          {items.map((e) => (
            <li key={e.id} className="px-4 py-2.5 flex items-start gap-3">
              <span className="h-7 w-7 rounded-full bg-gray-50 grid place-items-center shrink-0">
                {ICONS[e.type] ?? <Activity size={14} className="text-[var(--color-text-muted)]" />}
              </span>
              <div className="flex-1 min-w-0 text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{LABELS[e.type] ?? e.type}</span>
                  {payloadText(e) && (
                    <span className="text-xs text-[var(--color-text-muted)]">{payloadText(e)}</span>
                  )}
                </div>
                {e.product && (
                  <div className="flex items-center gap-2 mt-1 text-xs text-[var(--color-text-muted)]">
                    {e.product.imageUrl && (
                      <div className="relative h-6 w-6 rounded overflow-hidden bg-gray-100 shrink-0">
                        <Image src={e.product.imageUrl} alt="" fill className="object-cover" sizes="24px" />
                      </div>
                    )}
                    <span className="truncate">{e.product.title}</span>
                  </div>
                )}
              </div>
              <span className="text-xs text-[var(--color-text-muted)] shrink-0">{formatDateTime(e.createdAt)}</span>
            </li>
          ))}
        </ul>
      </Card>
      <div ref={sentinelRef} className="h-10" />
    </>
  );
}
