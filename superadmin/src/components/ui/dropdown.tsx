'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import type { LucideIcon } from 'lucide-react';

export interface DropdownItem {
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
}

const MENU_WIDTH = 208;

export function Dropdown({
  trigger,
  items,
  align = 'right',
}: {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Menyu — body'ga portal + fixed. Trigger o'rniga qarab joylashadi
  // (overflow/transform ota-elementlar qirqmaydi, orqa fonga tushmaydi).
  const place = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = align === 'right' ? r.right - MENU_WIDTH : r.left;
    setCoords({
      top: r.bottom + 4,
      left: Math.max(8, Math.min(left, window.innerWidth - MENU_WIDTH - 8)),
    });
  };

  useLayoutEffect(() => {
    if (open) place();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onEsc);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onEsc);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', place);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const menu =
    open && coords ? (
      <AnimatePresence>
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, y: -6, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.95 }}
          transition={{ duration: 0.12 }}
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            width: MENU_WIDTH,
            zIndex: 70,
          }}
          className="glass-strong rounded-xl border border-[var(--color-border-strong)] shadow-2xl py-1.5"
        >
          {items.map((item, i) => {
            if (item.divider) {
              return (
                <div
                  key={`d-${i}`}
                  className="my-1 mx-2 border-t border-[var(--color-border)]"
                />
              );
            }
            const Icon = item.icon;
            const className = cn(
              'flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors text-left',
              item.disabled && 'opacity-40 cursor-not-allowed',
              !item.disabled &&
                (item.danger
                  ? 'text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10'
                  : 'text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'),
            );
            const inner = (
              <>
                {Icon && <Icon size={14} className="shrink-0" />}
                <span className="flex-1">{item.label}</span>
              </>
            );
            if (item.href) {
              return (
                <a
                  key={i}
                  href={item.href}
                  className={className}
                  onClick={() => setOpen(false)}
                >
                  {inner}
                </a>
              );
            }
            return (
              <button
                key={i}
                type="button"
                disabled={item.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  if (item.disabled) return;
                  item.onClick?.();
                  setOpen(false);
                }}
                className={className}
              >
                {inner}
              </button>
            );
          })}
        </motion.div>
      </AnimatePresence>
    ) : null;

  return (
    <div ref={triggerRef} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((s) => !s);
        }}
      >
        {trigger}
      </button>
      {typeof document !== 'undefined' && menu
        ? createPortal(menu, document.body)
        : null}
    </div>
  );
}
