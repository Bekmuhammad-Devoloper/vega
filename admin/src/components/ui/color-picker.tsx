'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * Telegram Mini App'da ishlaydigan rang tanlagich.
 *
 * Native `<input type="color">` Telegram WebView'da (ayniqsa iOS) ochilmaydi —
 * shuning uchun bu komponent faqat DOM + pointer event'lar bilan qurilgan:
 *   • preset palitra (tez tanlash)
 *   • SV (to'yinganlik/yorqinlik) kvadrati — suriladi
 *   • hue (tus) slider — suriladi
 * Surish window darajasidagi pointer listener'lar bilan ishlaydi (setPointerCapture'ga
 * bog'liq emas) — shu sababli iOS WKWebView'da ham ishonchli ishlaydi.
 * Yonidagi hex input bilan birga ishlaydi (qiymat ikki tomonlama sinxron).
 */

const DEFAULT_PRESETS = [
  '#2F6BFF', '#0EA5E9', '#14B8A6', '#16A34A', '#25D463', '#F5F056',
  '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#0F172A', '#FFFFFF',
];

interface HSV {
  h: number; // 0..360
  s: number; // 0..1
  v: number; // 0..1
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** "abc" / "#abc" / "aabbcc" / "#aabbcc" → "#aabbcc" (kichik harf). Yaroqsiz bo'lsa null. */
function normHex(hex: string | null | undefined): string | null {
  if (!hex) return null;
  let h = hex.trim();
  if (/^[0-9a-fA-F]{3}$/.test(h) || /^[0-9a-fA-F]{6}$/.test(h)) h = '#' + h;
  if (/^#[0-9a-fA-F]{3}$/.test(h)) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  return /^#[0-9a-fA-F]{6}$/.test(h) ? h.toLowerCase() : null;
}

function hexToHsv(hex: string): HSV {
  const m = normHex(hex) ?? '#000000';
  const r = parseInt(m.slice(1, 3), 16) / 255;
  const g = parseInt(m.slice(3, 5), 16) / 255;
  const b = parseInt(m.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const to = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function ColorPicker({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  fallback = '#2F6BFF',
}: {
  value: string;
  onChange: (hex: string) => void;
  presets?: string[];
  fallback?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = normHex(value) ?? fallback;
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(current));
  const wrapRef = useRef<HTMLDivElement>(null);
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  // hsv'ning eng so'nggi qiymati — surish vaqtida tus/to'yinganlikni yo'qotmaslik uchun.
  const hsvRef = useRef(hsv);
  hsvRef.current = hsv;

  // Tashqi qiymat o'zgarsa (hex input yoki boshqa joydan) — HSV holatini sinxronlaymiz.
  useEffect(() => {
    const norm = normHex(value);
    if (norm && norm !== hsvToHex(hsv.h, hsv.s, hsv.v)) setHsv(hexToHsv(norm));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Tashqariga bosilganda yoki Escape bosilganda popover yopiladi.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const apply = (next: HSV) => {
    hsvRef.current = next;
    setHsv(next);
    onChange(hsvToHex(next.h, next.s, next.v));
  };

  const onSv = (clientX: number, clientY: number) => {
    const el = svRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cur = hsvRef.current;
    apply({
      h: cur.h,
      s: clamp01((clientX - r.left) / r.width),
      v: 1 - clamp01((clientY - r.top) / r.height),
    });
  };

  const onHue = (clientX: number) => {
    const el = hueRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cur = hsvRef.current;
    apply({ h: clamp01((clientX - r.left) / r.width) * 360, s: cur.s, v: cur.v });
  };

  /**
   * Surish — window darajasidagi listener'lar orqali (capture'ga bog'liq emas).
   * Barmoq element tashqarisiga chiqsa ham ishlaydi; pointerup/cancel'da tozalanadi.
   */
  const startDrag = (
    compute: (clientX: number, clientY: number) => void,
    e: React.PointerEvent,
  ) => {
    e.preventDefault();
    compute(e.clientX, e.clientY);
    const move = (ev: PointerEvent) => compute(ev.clientX, ev.clientY);
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

  const hueColor = hsvToHex(hsv.h, 1, 1);

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Rang tanlash"
        className="h-11 w-14 shrink-0 rounded-lg border border-[var(--color-border)] bg-white p-1"
      >
        <span className="block h-full w-full rounded" style={{ background: current }} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Rang tanlash"
          className="absolute left-0 z-50 mt-2 w-64 max-w-[calc(100vw-2.5rem)] rounded-2xl border border-[var(--color-border)] bg-white p-3 shadow-xl"
        >
          {/* SV kvadrat — to'yinganlik (gorizontal) + yorqinlik (vertikal) */}
          <div
            ref={svRef}
            onPointerDown={(e) => startDrag(onSv, e)}
            className="relative h-32 w-full touch-none select-none rounded-lg"
            style={{
              background: `linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, ${hueColor})`,
            }}
          >
            <span
              className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
              style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: current }}
            />
          </div>

          {/* Hue (tus) slider */}
          <div
            ref={hueRef}
            onPointerDown={(e) => startDrag((x) => onHue(x), e)}
            className="relative mt-3 h-3 w-full touch-none select-none rounded-full"
            style={{
              background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
            }}
          >
            <span
              className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
              style={{ left: `${(hsv.h / 360) * 100}%`, background: hueColor }}
            />
          </div>

          {/* Preset palitra */}
          <div className="mt-3 grid grid-cols-6 gap-1.5">
            {presets.map((p) => {
              const norm = normHex(p) ?? p;
              const active = current.toLowerCase() === norm.toLowerCase();
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => apply(hexToHsv(norm))}
                  className={cn(
                    'h-7 w-full rounded-md border transition',
                    active
                      ? 'border-[var(--color-text)] ring-2 ring-[var(--color-text)]/20'
                      : 'border-[var(--color-border)]',
                  )}
                  style={{ background: norm }}
                  aria-label={norm}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
