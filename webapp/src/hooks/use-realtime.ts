'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { getInitData } from '@/lib/telegram';
import { getShopSlug } from '@/lib/api';
import { toast } from '@/stores/toast-store';
import { useLocaleStore } from '@/stores/locale-store';
import { getMessages, tr } from '@/i18n';

/**
 * WebApp real-time hook.
 * /user namespace orqali server bilan ulanadi va kerakli queries ni invalidate qiladi.
 *
 * Eshitiladigan event'lar:
 * - order:status_changed  — foydalanuvchining buyurtma statusi o'zgardi
 * - support:new_response  — supportga admin javob berdi
 * - product:updated/created/deleted — mahsulot o'zgardi
 * - categories:invalidate — kategoriya'lar o'zgardi
 * - banners:invalidate    — bannerlar o'zgardi
 */
export function useRealtime(): void {
  const qc = useQueryClient();
  const locale = useLocaleStore((s) => s.locale);

  useEffect(() => {
    let socket: Socket | null = null;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      const initData = getInitData();
      // Do'kon slug'i SHART: initData do'konning O'Z boti bilan imzolangan,
      // server esa tekshirish uchun aynan shu do'kon tokenini olishi kerak.
      // Slug yuborilmasa server global bot tokeni bilan tekshirib, imzo
      // noto'g'ri chiqardi va mijoz shaxsiy xabarlarni umuman olmasdi.
      const tenantSlug = getShopSlug();
      const base = typeof window !== 'undefined' ? window.location.origin : '';
      socket = io(`${base}/user`, {
        path: '/socket.io',
        auth: { initData, tenantSlug },
        transports: ['websocket', 'polling'],
        withCredentials: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      socket.on('order:status_changed', (payload: { orderId: string; status: string; orderNumber: string }) => {
        qc.invalidateQueries({ queryKey: ['number-orders'] });
        qc.invalidateQueries({ queryKey: ['number-order', payload.orderId] });
        const msg = getMessages(locale);
        const statusLabel = tr(msg, `order.status.${payload.status}`);
        toast.info(`#${payload.orderNumber} → ${statusLabel}`);
      });

      socket.on('support:new_response', () => {
        qc.invalidateQueries({ queryKey: ['support-tickets-my'] });
        const msg = getMessages(locale);
        toast.info(tr(msg, 'support.newResponse') || 'Support javob keldi');
      });

      socket.on('product:updated', (payload: { productId: string }) => {
        qc.invalidateQueries({ queryKey: ['product', payload.productId] });
        qc.invalidateQueries({ queryKey: ['products'] });
        qc.invalidateQueries({ queryKey: ['related', payload.productId] });
      });

      socket.on('product:created', () => {
        qc.invalidateQueries({ queryKey: ['products'] });
      });

      socket.on('product:deleted', (payload: { productId: string }) => {
        qc.invalidateQueries({ queryKey: ['product', payload.productId] });
        qc.invalidateQueries({ queryKey: ['products'] });
        qc.invalidateQueries({ queryKey: ['favorites'] });
        qc.invalidateQueries({ queryKey: ['cart'] });
      });

      socket.on('categories:invalidate', () => {
        qc.invalidateQueries({ queryKey: ['categories'] });
      });

      socket.on('banners:invalidate', () => {
        qc.invalidateQueries({ queryKey: ['banners'] });
      });
    };

    // 500ms da'gi delay — initial page load'da socket ham parallel ulanmasin
    const t = setTimeout(connect, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
      if (socket) {
        socket.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
