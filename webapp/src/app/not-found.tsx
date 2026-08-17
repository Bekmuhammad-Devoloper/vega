import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-dvh grid place-items-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-bold mb-2">404</h1>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">Sahifa topilmadi</p>
        <Link href="/">
          <Button>Bosh sahifaga</Button>
        </Link>
      </div>
    </div>
  );
}
