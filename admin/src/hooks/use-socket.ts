'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { loadAccessToken } from '@/lib/api';

type AdminEvent =
  | 'user-event'
  | 'order-created'
  | 'order-status-changed'
  | 'support-new-ticket'
  | 'connected';

type Handlers = Partial<Record<AdminEvent, (payload: unknown) => void>>;

export function useAdminSocket(handlers: Handlers) {
  const socketRef = useRef<Socket | null>(null);
  // handlersRef — har render'da yangilanadi. Socket listenerlari shu ref orqali
  // chaqirilgani uchun, ular har doim eng yangi handler'ni ko'radi va `[]` deps
  // bilan ham stale closure muammosi bo'lmaydi.
  const handlersRef = useRef<Handlers>(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const token = loadAccessToken();
    if (!token) return;
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    const socket = io(`${base}/admin`, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
    });
    socketRef.current = socket;

    const events: AdminEvent[] = [
      'user-event',
      'order-created',
      'order-status-changed',
      'support-new-ticket',
      'connected',
    ];

    const dispatch = (event: AdminEvent) => (payload: unknown) => {
      handlersRef.current[event]?.(payload);
    };
    const dispatchers = events.map((e) => ({ event: e, fn: dispatch(e) }));
    for (const { event, fn } of dispatchers) socket.on(event, fn);

    return () => {
      for (const { event, fn } of dispatchers) socket.off(event, fn);
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return socketRef;
}
