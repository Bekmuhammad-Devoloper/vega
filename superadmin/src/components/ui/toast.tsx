'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToastStore, type ToastVariant } from '@/stores/toast-store';

const ICONS: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const COLORS: Record<ToastVariant, string> = {
  success: 'text-[var(--color-success)] border-[var(--color-success)]/30',
  error: 'text-[var(--color-danger)] border-[var(--color-danger)]/30',
  info: 'text-[var(--color-info)] border-[var(--color-info)]/30',
  warning: 'text-[var(--color-warning)] border-[var(--color-warning)]/30',
};

export function ToastViewport() {
  const items = useToastStore((s) => s.items);
  const remove = useToastStore((s) => s.remove);

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {items.map((it) => {
          const Icon = ICONS[it.variant];
          return (
            <motion.div
              key={it.id}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              className={`pointer-events-auto glass rounded-xl border ${COLORS[it.variant]} px-4 py-3 flex items-center gap-3 min-w-[280px] max-w-[400px]`}
            >
              <Icon size={18} />
              <span className="text-sm text-[var(--color-text)] flex-1">{it.message}</span>
              <button
                onClick={() => remove(it.id)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
