'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { TariffOption } from '@/lib/endpoints';

function formatPrice(v: number): string {
  return v === 0 ? 'Bepul' : `${v.toLocaleString('ru-RU')} so'm`;
}

const FAST_MS = 1200; // dastlabki tezlik
const SLOW_MS = 2500; // 10s dan keyin sekinroq
const SWITCH_AFTER_MS = 10_000;

export function TariffCarousel({
  tariffs,
  value,
  onChange,
}: {
  tariffs: TariffOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [dragPx, setDragPx] = useState(0);
  const [width, setWidth] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const moved = useRef(false);

  // Konteyner kengligini o'lchaymiz (translate hisobi uchun)
  useEffect(() => {
    const measure = () => setWidth(containerRef.current?.offsetWidth ?? 0);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Avto-aylanish: 10s gacha 0.5s, keyin 2s
  useEffect(() => {
    if (!auto || tariffs.length <= 1) return;
    const tick = () => setIndex((i) => (i + 1) % tariffs.length);
    let id = window.setInterval(tick, FAST_MS);
    const slow = window.setTimeout(() => {
      window.clearInterval(id);
      id = window.setInterval(tick, SLOW_MS);
    }, SWITCH_AFTER_MS);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(slow);
    };
  }, [auto, tariffs.length]);

  const stopAuto = () => setAuto(false);

  const goTo = (i: number, select = true) => {
    const clamped = Math.max(0, Math.min(tariffs.length - 1, i));
    setIndex(clamped);
    if (select && tariffs[clamped]) onChange(tariffs[clamped].value);
  };

  function onPointerDown(e: React.PointerEvent) {
    stopAuto();
    setDragging(true);
    startX.current = e.clientX;
    moved.current = false;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > 6) moved.current = true;
    setDragPx(dx);
  }
  function onPointerUp() {
    if (!dragging) return;
    setDragging(false);
    const threshold = (width || 300) * 0.18;
    if (dragPx <= -threshold) goTo(index + 1);
    else if (dragPx >= threshold) goTo(index - 1);
    else goTo(index); // surilmadi → joriy kartani tanlash
    setDragPx(0);
  }

  const translate = -(index * width) + (dragging ? dragPx : 0);

  return (
    <div>
      <div
        ref={containerRef}
        className="overflow-hidden select-none touch-pan-y"
        style={{ cursor: dragging ? 'grabbing' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="flex items-stretch"
          style={{
            transform: `translateX(${translate}px)`,
            transition: dragging ? 'none' : 'transform 350ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {tariffs.map((t) => {
            const selected = value === t.value;
            return (
              <div key={t.value} className="shrink-0 px-1" style={{ width: width || '100%' }}>
                <div
                  onClick={() => {
                    if (moved.current) return; // drag bo'lsa tanlamaymiz
                    stopAuto();
                    onChange(t.value);
                  }}
                  className={cn(
                    'h-full rounded-2xl border p-4 transition-all',
                    selected
                      ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/30 bg-[var(--color-primary)]/[0.03]'
                      : 'border-[var(--color-border)] bg-white',
                  )}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base">{t.label}</span>
                      {t.popular && (
                        <span className="text-[10px] font-bold uppercase tracking-wide bg-[var(--color-primary)] text-white px-2 py-0.5 rounded-full">
                          Mashhur
                        </span>
                      )}
                    </div>
                    <span
                      className={cn(
                        'h-5 w-5 rounded-full border-2 grid place-items-center shrink-0',
                        selected
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                          : 'border-[var(--color-border)]',
                      )}
                    >
                      {selected && <Check size={12} />}
                    </span>
                  </div>

                  <p className="text-2xl font-extrabold tracking-tight leading-none">
                    {formatPrice(t.priceMonthly)}
                    {t.priceMonthly > 0 && (
                      <span className="text-sm font-medium text-[var(--color-text-muted)]"> bir martalik</span>
                    )}
                  </p>
                  {t.serverMonthly ? (
                    <p className="mt-1 text-xs font-medium text-[var(--color-text-muted)]">
                      + server: {t.serverMonthly.toLocaleString('ru-RU')} so&apos;m/oy
                    </p>
                  ) : null}
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">{t.tagline}</p>

                  <ul className="mt-3 space-y-1.5">
                    {t.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-2 text-[13px] text-[var(--color-text)]"
                      >
                        <Check size={14} className="text-[var(--color-primary)] mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Boshqaruv: strelka + nuqtalar */}
      <div className="flex items-center justify-between mt-3">
        <button
          type="button"
          aria-label="Oldingi"
          onClick={() => {
            stopAuto();
            goTo(index - 1);
          }}
          disabled={index === 0}
          className="h-9 w-9 grid place-items-center rounded-full border border-[var(--color-border)] bg-white text-[var(--color-text)] disabled:opacity-40"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="flex items-center gap-1.5">
          {tariffs.map((t, i) => (
            <button
              key={t.value}
              type="button"
              aria-label={t.label}
              onClick={() => {
                stopAuto();
                goTo(i);
              }}
              className={cn(
                'h-2 rounded-full transition-all',
                i === index ? 'w-5 bg-[var(--color-primary)]' : 'w-2 bg-[var(--color-border)]',
              )}
            />
          ))}
        </div>

        <button
          type="button"
          aria-label="Keyingi"
          onClick={() => {
            stopAuto();
            goTo(index + 1);
          }}
          disabled={index === tariffs.length - 1}
          className="h-9 w-9 grid place-items-center rounded-full border border-[var(--color-border)] bg-white text-[var(--color-text)] disabled:opacity-40"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
