'use client';

import { useState, type ReactNode } from 'react';
import { Check, CheckCircle2, ChevronDown } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { cn } from '@/lib/cn';

interface Option {
  value: string;
  label: string;
  /** Variantning chap tomonida ko'rinadigan ixtiyoriy belgi (masalan, bayroq SVG). */
  icon?: ReactNode;
  /** Allaqachon qo'shilgan — o'ng tomonda doimiy yashil galochka ko'rinadi. */
  added?: boolean;
}

/** Mobil uchun qulay tanlov — native <select> o'rniga bottom-sheet ro'yxat. */
export function PickerSelect({
  value,
  onChange,
  options,
  placeholder = 'Tanlang…',
  title = 'Tanlang',
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full h-11 px-4 rounded-xl border border-[var(--color-border)] bg-white text-sm flex items-center justify-between gap-2 text-left focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
      >
        <span
          className={cn(
            'inline-flex items-center gap-2 truncate',
            selected ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]',
          )}
        >
          {selected?.icon}
          <span className="truncate">{selected ? selected.label : placeholder}</span>
        </span>
        <ChevronDown size={18} className="text-[var(--color-text-muted)] shrink-0" />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        <ul className="space-y-0.5 pb-2">
          {options.map((o) => {
            const active = o.value === value;
            return (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between gap-3 px-3 py-3 rounded-xl text-left text-sm transition-colors',
                    active
                      ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-medium'
                      : 'hover:bg-gray-50',
                  )}
                >
                  <span className="inline-flex items-center gap-2.5 min-w-0">
                    {o.icon}
                    <span className="truncate">{o.label}</span>
                  </span>
                  {o.added ? (
                    <CheckCircle2 size={17} className="shrink-0 text-[var(--color-success)]" />
                  ) : active ? (
                    <Check size={16} className="shrink-0" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </>
  );
}
