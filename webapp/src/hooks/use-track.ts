'use client';

import { useEffect, useRef } from 'react';
import { api, sendBeaconBatch } from '@/lib/api';
import type { EventType } from '@/lib/api/types';

interface TrackEventPayload {
  type: EventType;
  productId?: string;
  categoryId?: string;
  payload?: Record<string, unknown>;
}

const queue: TrackEventPayload[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const FLUSH_INTERVAL_MS = 5000;
const MAX_BATCH = 30;

function flush(useBeacon = false): void {
  if (queue.length === 0) return;
  const batch = queue.splice(0, queue.length);
  if (useBeacon) {
    sendBeaconBatch('/events/batch', batch);
  } else {
    void api('/events/batch', { method: 'POST', body: { events: batch } }).catch(() => undefined);
  }
}

function scheduleFlush(): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => flush(), FLUSH_INTERVAL_MS);
}

function runWhenIdle(cb: () => void): void {
  if (typeof window === 'undefined') return;
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback;
  if (ric) ric(cb, { timeout: 2000 });
  else setTimeout(cb, 0);
}

export function track(event: TrackEventPayload): void {
  // Tracking bo'sh vaqtda yuborilsin — UI'ni bloklamasin
  runWhenIdle(() => {
    queue.push(event);
    if (queue.length >= MAX_BATCH) {
      flush();
    } else {
      scheduleFlush();
    }
  });
}

export function useTrackOnMount(event: TrackEventPayload): void {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    track(event);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function useFlushOnUnload(): void {
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush(true);
    };
    const onPageHide = () => flush(true);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);
}
