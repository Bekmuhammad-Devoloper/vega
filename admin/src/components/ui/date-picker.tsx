'use client';

import { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

const MONTHS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
];
const WEEKDAYS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];

const pad = (n: number) => String(n).padStart(2, '0');
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function parseISO(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
function display(s: string): string {
  const d = parseISO(s);
  return d ? `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}` : '';
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Sanani tanlang',
  disablePast = false,
}: {
  value: string; // 'YYYY-MM-DD' | ''
  onChange: (v: string) => void;
  placeholder?: string;
  disablePast?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseISO(value);
  const [view, setView] = useState<Date>(() => selected ?? new Date());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const d = parseISO(value);
    if (d) setView(d);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const today = new Date();
  const todayISO = toISO(today);
  const year = view.getFullYear();
  const month = view.getMonth();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7; // Dushanba = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full h-11 px-3 rounded-xl border border-[var(--color-border)] bg-white flex items-center justify-between gap-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
      >
        <span className={value ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'}>
          {value ? display(value) : placeholder}
        </span>
        <Calendar size={16} className="text-[var(--color-text-muted)] shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 left-0 w-[300px] max-w-[92vw] rounded-2xl border border-[var(--color-border)] bg-white shadow-xl p-3">
          {/* Sarlavha: oy/yil + strelkalar */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setView(new Date(year, month - 1, 1))}
              className="h-8 w-8 grid place-items-center rounded-lg hover:bg-[var(--color-bg)] text-[var(--color-text-muted)]"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-bold">{MONTHS[month]} {year}</span>
            <button
              type="button"
              onClick={() => setView(new Date(year, month + 1, 1))}
              className="h-8 w-8 grid place-items-center rounded-lg hover:bg-[var(--color-bg)] text-[var(--color-text-muted)]"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Hafta kunlari */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((w, i) => (
              <span
                key={w}
                className={`h-7 grid place-items-center text-[11px] font-medium ${
                  i >= 5 ? 'text-[var(--color-danger)]/70' : 'text-[var(--color-text-muted)]'
                }`}
              >
                {w}
              </span>
            ))}
          </div>

          {/* Kunlar */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (d === null) return <span key={`e${i}`} />;
              const iso = toISO(new Date(year, month, d));
              const isSelected = value === iso;
              const isToday = todayISO === iso;
              const past = disablePast && iso < todayISO;
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={past}
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                  className={[
                    'h-9 rounded-lg text-sm transition-colors',
                    past ? 'text-[var(--color-text-muted)]/40 cursor-not-allowed' : 'hover:bg-[var(--color-bg)]',
                    isSelected
                      ? 'bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary)]'
                      : isToday
                        ? 'ring-1 ring-[var(--color-primary)] text-[var(--color-primary)] font-semibold'
                        : 'text-[var(--color-text)]',
                  ].join(' ')}
                >
                  {d}
                </button>
              );
            })}
          </div>

          {/* Pastki tugmalar */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--color-border)]">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className="text-xs font-medium text-[var(--color-danger)] px-2 py-1 rounded-lg hover:bg-rose-50"
            >
              Tozalash
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(todayISO);
                setOpen(false);
              }}
              className="text-xs font-medium text-[var(--color-primary)] px-2 py-1 rounded-lg hover:bg-[var(--color-primary)]/10"
            >
              Bugun
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
