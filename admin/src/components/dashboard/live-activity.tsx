'use client';

import { useEffect, useRef, useState } from 'react';
import { Activity, Eye, Heart, ShoppingCart, Package, X } from 'lucide-react';
import { useAdminSocket } from '@/hooks/use-socket';
import { Card, CardHeader } from '@/components/ui/card';
import { formatRelative } from '@/lib/format';
import { toast } from '@/stores/toast-store';
import { useQueryClient } from '@tanstack/react-query';

type LiveItem = {
  id: number;
  ts: number;
  type: 'user-event' | 'order-created' | 'order-status-changed' | 'support-new-ticket';
  text: string;
  icon: 'view' | 'cart' | 'fav' | 'order' | 'remove';
};

const MAX_ITEMS = 50;

function eventToItem(payload: unknown, id: number): LiveItem | null {
  const p = payload as {
    userId?: string;
    type?: string;
    productId?: string;
    orderNumber?: string;
    total?: number;
    status?: string;
  };
  if (!p?.type) return null;

  let text = '';
  let icon: LiveItem['icon'] = 'view';
  switch (p.type) {
    case 'VIEW_PRODUCT':
      text = `User mahsulot ko'rdi`;
      icon = 'view';
      break;
    case 'CART_ADD':
      text = `Savatga qo'shildi`;
      icon = 'cart';
      break;
    case 'CART_REMOVE':
      text = `Savatdan o'chirildi`;
      icon = 'remove';
      break;
    case 'FAVORITE_ADD':
      text = `Sevimliga qo'shildi`;
      icon = 'fav';
      break;
    case 'ORDER_PLACED':
      text = `Buyurtma yaratildi`;
      icon = 'order';
      break;
    case 'SEARCH_QUERY':
      text = `Qidiruv: ${(p as { payload?: { q?: string } }).payload?.q ?? ''}`;
      icon = 'view';
      break;
    default:
      text = p.type;
  }
  return { id, ts: Date.now(), type: 'user-event', text, icon };
}

const ICONS = {
  view: <Eye size={14} className="text-[var(--color-info)]" />,
  cart: <ShoppingCart size={14} className="text-[var(--color-primary)]" />,
  fav: <Heart size={14} className="text-[var(--color-danger)]" />,
  order: <Package size={14} className="text-[var(--color-success)]" />,
  remove: <X size={14} className="text-[var(--color-text-muted)]" />,
};

export function LiveActivity() {
  const [items, setItems] = useState<LiveItem[]>([]);
  const [paused, setPaused] = useState(false);
  const nextId = useRef(0);
  const qc = useQueryClient();

  useAdminSocket({
    'user-event': (payload) => {
      if (paused) return;
      const item = eventToItem(payload, ++nextId.current);
      if (item) setItems((prev) => [item, ...prev].slice(0, MAX_ITEMS));
    },
    'order-created': (payload) => {
      const p = payload as { orderNumber?: string; total?: number };
      const id = ++nextId.current;
      const newItem: LiveItem = {
        id,
        ts: Date.now(),
        type: 'order-created',
        text: `🛒 Yangi buyurtma #${p.orderNumber ?? ''}`,
        icon: 'order',
      };
      setItems((prev) => [newItem, ...prev].slice(0, MAX_ITEMS));
      toast.success(`Yangi buyurtma #${p.orderNumber}`);
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
    'order-status-changed': () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
    'support-new-ticket': () => {
      toast.info('Yangi support tiket');
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
      qc.invalidateQueries({ queryKey: ['support', 'open-count'] });
    },
    connected: () => {
      // ok
    },
  });

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Activity size={16} className="text-[var(--color-primary)]" />
            Live activity
          </span>
        }
        action={
          <button
            onClick={() => setPaused((v) => !v)}
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
        }
      />
      <div className="max-h-[480px] overflow-y-auto">
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
            Hozircha eventlar yo&apos;q
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {items.map((it) => (
              <li key={it.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                <span className="h-7 w-7 rounded-full bg-gray-50 grid place-items-center shrink-0">{ICONS[it.icon]}</span>
                <span className="flex-1 truncate">{it.text}</span>
                <span className="text-xs text-[var(--color-text-muted)] shrink-0">{formatRelative(new Date(it.ts))}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
