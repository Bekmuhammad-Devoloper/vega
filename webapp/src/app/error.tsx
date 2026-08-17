'use client';

import { Button } from '@/components/ui/button';

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-dvh grid place-items-center p-6 text-center">
      <div>
        <h1 className="text-xl font-bold mb-2">Xatolik yuz berdi</h1>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">{error.message}</p>
        <Button onClick={reset}>Qayta urinish</Button>
      </div>
    </div>
  );
}
