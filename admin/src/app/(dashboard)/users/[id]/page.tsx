'use client';

import { use, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { Lock, Unlock } from 'lucide-react';
import type { AdminUserDetail, AdminUserListItem, CursorPage } from '@/lib/types';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { NumberStatusBadge } from '@/components/number-status-badge';
import { UserTimeline } from '@/components/users/timeline';
import { UserInterests } from '@/components/users/interests';
import { apiGetAdminUser, apiUpdateUser, apiUserOrders } from '@/lib/endpoints';
import { formatDateTime, formatMoney } from '@/lib/format';
import { toast } from '@/stores/toast-store';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/auth-store';

type Tab = 'profile' | 'timeline' | 'interests' | 'orders';

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab] = useState<Tab>('profile');
  const qc = useQueryClient();
  const admin = useAuthStore((s) => s.admin);

  const { data: user, isLoading } = useQuery({
    queryKey: ['admin-user', id],
    queryFn: () => apiGetAdminUser(id),
  });

  const block = useMutation({
    mutationFn: (isBlocked: boolean) => apiUpdateUser(id, { isBlocked }),
    onSuccess: (_data, isBlocked) => {
      // Profil sahifasini darhol yangilaymiz
      qc.setQueryData<AdminUserDetail>(['admin-user', id], (old) =>
        old ? { ...old, isBlocked } : old,
      );
      // Ro'yxat keshidagi shu userni ham darhol yangilaymiz (barcha filtrlar bo'yicha),
      // shunda "Userlar" ro'yxatiga qaytganda eski (bloklangan) holat ko'rinib qolmaydi.
      qc.setQueriesData<InfiniteData<CursorPage<AdminUserListItem>>>(
        { queryKey: ['admin-users'] },
        (old) =>
          old
            ? {
                ...old,
                pages: old.pages.map((page) => ({
                  ...page,
                  items: page.items.map((it) => (it.id === id ? { ...it, isBlocked } : it)),
                })),
              }
            : old,
      );
      // Serverdan aniq holatni qayta olamiz (filtr a'zoligini ham to'g'rilaydi)
      qc.invalidateQueries({ queryKey: ['admin-user', id] });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(isBlocked ? 'Bloklandi' : 'Blokdan chiqarildi');
    },
  });

  if (isLoading || !user) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const canBlock = admin?.role === 'SUPERADMIN' || admin?.role === 'ADMIN';

  return (
    <div>
      <PageHeader
        title={user.firstName ?? user.username ?? `ID ${user.telegramId}`}
        description={user.username ? `@${user.username}` : 'Foydalanuvchi'}
        backHref="/users"
        rightSlot={
          canBlock ? (
            <Button
              size="sm"
              variant={user.isBlocked ? 'success' : 'danger'}
              loading={block.isPending}
              onClick={() => block.mutate(!user.isBlocked)}
            >
              {user.isBlocked ? <Unlock size={14} /> : <Lock size={14} />}
              {user.isBlocked ? 'Blokdan chiqarish' : 'Bloklash'}
            </Button>
          ) : null
        }
      />

      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar -mx-4 px-4">
        {(['profile', 'timeline', 'interests', 'orders'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'h-9 px-4 rounded-full text-xs font-medium whitespace-nowrap border',
              tab === t
                ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                : 'bg-white text-[var(--color-text-muted)] border-[var(--color-border)]',
            )}
          >
            {t === 'profile' ? 'Profil' : t === 'timeline' ? 'Faollik' : t === 'interests' ? 'Qiziqishlar' : 'Buyurtmalar'}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader title="Ma'lumotlar" />
            <CardBody className="space-y-2 text-sm">
              <Row label="Telegram ID" value={user.telegramId} />
              <Row label="Username" value={user.username ? `@${user.username}` : '—'} />
              <Row label="Ism" value={[user.firstName, user.lastName].filter(Boolean).join(' ') || '—'} />
              <Row label="Telefon" value={user.phone ?? '—'} />
              <Row label="Til" value={user.language === 'ru' ? 'Русский' : "O'zbekcha"} />
              <Row label="Status" value={user.isBlocked ? <Badge tone="red">Bloklangan</Badge> : <Badge tone="green">Faol</Badge>} />
              <Row label="Oxirgi tashrif" value={formatDateTime(user.lastSeenAt)} />
              <Row label="Ro'yxatdan o'tgan" value={formatDateTime(user.createdAt)} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Statistika" />
            <CardBody className="space-y-2 text-sm">
              <Row label="Buyurtmalar" value={user.stats.ordersCount.toString()} />
              <Row label="Jami tushum" value={formatMoney(user.stats.revenue)} />
              <Row label="O'rtacha buyurtma" value={formatMoney(user.stats.avgOrderValue)} />
              <Row label="Savatda" value={user.stats.cartCount.toString()} />
              <Row label="Sevimlilarda" value={user.stats.favoritesCount.toString()} />
              <Row label="Eventlar" value={user.stats.eventsCount.toString()} />
            </CardBody>
          </Card>
        </div>
      )}

      {tab === 'timeline' && <UserTimeline userId={user.id} />}
      {tab === 'interests' && <UserInterests userId={user.id} />}
      {tab === 'orders' && <UserOrdersTab userId={user.id} />}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span className="font-medium text-right truncate">{value}</span>
    </div>
  );
}

function UserOrdersTab({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['user-orders', userId],
    queryFn: () => apiUserOrders(userId, { limit: 50 }),
  });
  if (isLoading || !data) return <Skeleton className="h-40" />;
  if (data.items.length === 0)
    return (
      <Card>
        <div className="px-4 py-10 text-center text-sm text-[var(--color-text-muted)]">Buyurtmalar yo&apos;q</div>
      </Card>
    );
  return (
    <Card>
      <ul className="divide-y divide-[var(--color-border)]">
        {data.items.map((o) => (
          <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">#{o.orderNumber}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{formatDateTime(o.createdAt)}</p>
            </div>
            <NumberStatusBadge status={o.status} />
            <p className="font-bold text-[var(--color-primary)] whitespace-nowrap">{formatMoney(o.total)}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
