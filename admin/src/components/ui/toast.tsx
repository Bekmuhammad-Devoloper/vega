'use client';
import { useToastStore } from '@/stores/toast-store';
import { Check, Info, X } from 'lucide-react';

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none w-[92%] max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto bg-white rounded-2xl shadow-lg px-4 py-3 flex items-center gap-3 border border-[var(--color-border)]"
        >
          <div
            className={
              t.type === 'success'
                ? 'text-[var(--color-success)]'
                : t.type === 'error'
                  ? 'text-[var(--color-danger)]'
                  : 'text-[var(--color-primary)]'
            }
          >
            {t.type === 'success' ? <Check size={20} /> : t.type === 'error' ? <X size={20} /> : <Info size={20} />}
          </div>
          <p className="text-sm flex-1">{t.message}</p>
        </div>
      ))}
    </div>
  );
}
