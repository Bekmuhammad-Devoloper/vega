'use client';

import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { apiUserInterests } from '@/lib/endpoints';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const COLORS = ['#2F6BFF', '#16A34A', '#F59E0B', '#EF4444', '#8B5CF6', '#0EA5E9', '#EC4899', '#10B981', '#F97316', '#6366F1'];

export function UserInterests({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['user-interests', userId],
    queryFn: () => apiUserInterests(userId),
  });

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  const totalScore = data.topCategories.reduce((a, b) => a + b.score, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader title="Top kategoriyalar" />
        <CardBody>
          {data.topCategories.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-8">Ma&apos;lumot yo&apos;q</p>
          ) : (
            <>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.topCategories.slice(0, 6)}
                      dataKey="score"
                      nameKey="titleUz"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                    >
                      {data.topCategories.slice(0, 6).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-1.5 mt-2">
                {data.topCategories.map((c, i) => (
                  <li key={c.categoryId} className="flex items-center gap-2 text-sm">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ background: COLORS[i % COLORS.length] }}
                    />
                    <span className="flex-1 truncate">{c.titleUz}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {Math.round((c.score / Math.max(totalScore, 1)) * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Ko'p ko'rilgan mahsulotlar" />
        {data.topProducts.length === 0 ? (
          <CardBody>
            <p className="text-sm text-[var(--color-text-muted)] text-center py-8">Ma&apos;lumot yo&apos;q</p>
          </CardBody>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {data.topProducts.map((p) => (
              <li key={p.id} className="px-4 py-2 flex items-center gap-3">
                {p.imageUrl ? (
                  <div className="relative h-9 w-9 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                    <Image src={p.imageUrl} alt="" fill className="object-cover" sizes="36px" />
                  </div>
                ) : (
                  <div className="h-9 w-9 rounded-lg bg-gray-100 shrink-0" />
                )}
                <span className="flex-1 text-sm truncate">
                  {p.title}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">{p.viewCount}× ko&apos;rdi</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {data.cartAbandonment.length > 0 && (
        <Card className="md:col-span-2">
          <CardHeader title="Savatga qo'shdi, lekin sotib olmadi" />
          <ul className="divide-y divide-[var(--color-border)]">
            {data.cartAbandonment.map((p) => (
              <li key={p.productId} className="px-4 py-2.5 flex items-center justify-between text-sm">
                <span className="truncate">{p.titleUz}</span>
                <span className="text-xs text-[var(--color-text-muted)]">{p.addCount}× qo&apos;shdi</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
