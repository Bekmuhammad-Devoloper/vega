'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Search, X, Heart, ShoppingCart, Package, UserRound, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Segmented } from '@/components/ui/segmented';
import { UserStatusBadge } from '@/components/user-status-badge';
import { apiListAdminUsers } from '@/lib/endpoints';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

type Filter = 'all' | 'no' | 'yes';

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [blocked, setBlocked] = useState<Filter>('all');

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const query = useInfiniteQuery({
    queryKey: ['admin-users', { q: debounced, blocked }],
    queryFn: ({ pageParam }) =>
      apiListAdminUsers({
        q: debounced || undefined,
        isBlocked: blocked === 'all' ? undefined : blocked === 'yes',
        cursor: pageParam,
        limit: 30,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    // Filtr/qidiruv almashganda oq ekran ko'rsatmaymiz — eskisi turadi.
    placeholderData: (prev) => prev,
  });

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && query.hasNextPage && !query.isFetchingNextPage) {
          query.fetchNextPage();
        }
      },
      // Pastga yetmasdan oldin yuklaymiz — "sekin" hissi yo'qoladi.
      { rootMargin: '300px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [query]);

  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const busy = search !== debounced || (query.isFetching && !query.isFetchingNextPage);

  return (
    <div>
      <PageHeader
        title="Foydalanuvchilar"
        description={
          query.isLoading
            ? 'Yuklanmoqda…'
            : items.length === 0
              ? 'Hozircha yo’q'
              : `${items.length}${query.hasNextPage ? '+' : ''} ta ko’rsatildi`
        }
      />

      {/* ── Qidiruv + status filtri ── */}
      <div className="mb-4 space-y-2 max-w-2xl">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Telegram ID / @username / ism / telefon"
            className={cn('pl-9', search && 'pr-9')}
            inputMode="search"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Tozalash"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center rounded-lg text-[var(--color-text-muted)] hover:bg-black/[0.05] active:scale-95 transition"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <Segmented<Filter>
          value={blocked}
          onChange={setBlocked}
          options={[
            { value: 'all', label: 'Hammasi', dot: 'blue' },
            { value: 'no', label: 'Faol', dot: 'green' },
            { value: 'yes', label: 'Bloklangan', dot: 'red' },
          ]}
        />
      </div>

      {query.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[86px] rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <div className="px-4 py-12 text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-[var(--color-bg)] grid place-items-center text-[var(--color-text-muted)]">
              <UserRound size={22} />
            </div>
            <p className="text-sm font-medium">Topilmadi</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {debounced
                ? 'Qidiruv bo’yicha natija yo’q — boshqacha yozib ko’ring.'
                : blocked === 'yes'
                  ? 'Bloklangan foydalanuvchi yo’q.'
                  : 'Do’koningizga hali hech kim kirmagan.'}
            </p>
          </div>
        </Card>
      ) : (
        <>
          <div
            className={cn(
              'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 transition-opacity',
              busy && 'opacity-60',
            )}
          >
            {items.map((u) => {
              const name = u.firstName ?? u.username ?? `ID ${u.telegramId}`;
              return (
                <Link
                  key={u.id}
                  href={`/users/${u.id}`}
                  prefetch={false}
                  className={cn(
                    'group relative rounded-2xl border bg-white p-3 flex items-center gap-3',
                    'transition-all duration-150 active:scale-[0.99]',
                    u.isBlocked
                      ? 'border-rose-200/70 bg-rose-50/30 hover:border-rose-300'
                      : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:shadow-[0_4px_16px_-6px_rgba(47,107,255,0.35)]',
                  )}
                >
                  {/* Avatar + holat nuqtasi */}
                  <div className="relative shrink-0">
                    <div
                      className={cn(
                        'h-12 w-12 rounded-full grid place-items-center font-semibold overflow-hidden text-base',
                        'ring-2 ring-white shadow-sm',
                        u.isBlocked
                          ? 'bg-rose-100 text-rose-400'
                          : 'bg-gradient-to-br from-[var(--color-primary)]/15 to-[var(--color-primary)]/5 text-[var(--color-primary)]',
                      )}
                    >
                      {u.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={u.photoUrl}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className={cn(
                            'h-full w-full object-cover',
                            u.isBlocked && 'grayscale opacity-75',
                          )}
                        />
                      ) : (
                        name.slice(0, 1).toUpperCase()
                      )}
                    </div>
                    <span
                      className={cn(
                        'absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-white',
                        u.isBlocked ? 'bg-rose-500' : 'bg-emerald-500',
                      )}
                    />
                  </div>

                  {/* Ma'lumot */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p
                        className={cn(
                          'text-sm font-semibold truncate',
                          u.isBlocked && 'text-[var(--color-text-muted)]',
                        )}
                      >
                        {name}
                      </p>
                      {u.isBlocked && <UserStatusBadge blocked size="sm" className="shrink-0" />}
                    </div>

                    {u.username ? (
                      <p className="text-xs text-[var(--color-text-muted)] truncate">@{u.username}</p>
                    ) : (
                      <p className="text-xs text-[var(--color-text-muted)] truncate tabular-nums">
                        ID {u.telegramId}
                      </p>
                    )}

                    <div className="mt-1 flex items-center gap-2.5 text-[11px]">
                      <Stat icon={<Package size={11} />} value={u.ordersCount} title="Buyurtmalar" />
                      <Stat icon={<ShoppingCart size={11} />} value={u.cartCount} title="Savatda" />
                      <Stat icon={<Heart size={11} />} value={u.favoritesCount} title="Sevimlilar" />
                    </div>
                  </div>

                  {/* O'ng ustun */}
                  <div className="shrink-0 flex flex-col items-end justify-between self-stretch py-0.5">
                    <span className="text-[10px] text-[var(--color-text-muted)] whitespace-nowrap">
                      {formatRelative(u.lastSeenAt)}
                    </span>
                    <ChevronRight
                      size={16}
                      className="text-[var(--color-text-muted)]/40 group-hover:text-[var(--color-primary)] transition-colors"
                    />
                  </div>
                </Link>
              );
            })}
          </div>

          {query.isFetchingNextPage && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-[86px] rounded-2xl" />
              ))}
            </div>
          )}
          <div ref={sentinelRef} className="h-10" />
        </>
      )}
    </div>
  );
}

function Stat({ icon, value, title }: { icon: React.ReactNode; value: number; title: string }) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-0.5 tabular-nums',
        value > 0 ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-muted)]/45',
      )}
    >
      {icon}
      {value}
    </span>
  );
}
