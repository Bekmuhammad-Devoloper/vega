export function formatMoney(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '0';
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '0';
  return new Intl.NumberFormat('ru-RU').format(Math.round(n)).replace(/,/g, ' ') + " so'm";
}

/**
 * Opt-in money formatter that splits the numeric amount from its unit so the UI
 * can de-emphasise " so'm". Does NOT change the global `formatMoney` used by
 * other screens. With `compact`, only very large sums collapse so a KPI card
 * never overflows a ~160px mobile column, while typical daily figures stay exact:
 *   105 000   -> "105 000 so'm"   (to'liq — odatdagi qiymatlar o'zgarmaydi)
 *   1 250 000 -> "1.25 mln so'm"
 *   2 400 000 000 -> "2.4 mlrd so'm"
 */
export function formatMoneyParts(
  value: number | string | null | undefined,
  opts: { compact?: boolean } = {},
): { amount: string; unit: string } {
  const unit = "so'm";
  if (value === null || value === undefined) return { amount: '0', unit };
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return { amount: '0', unit };

  if (opts.compact) {
    const abs = Math.abs(n);
    // Faqat millionlardan boshlab qisqartiramiz — to'liq son mobil kartochkaga
    // sig'maydigan holatda. Undan past qiymatlar to'liq (aniq) ko'rsatiladi.
    if (abs >= 1_000_000_000) return { amount: trimZeros((n / 1_000_000_000).toFixed(2)) + ' mlrd', unit };
    if (abs >= 1_000_000) return { amount: trimZeros((n / 1_000_000).toFixed(2)) + ' mln', unit };
  }
  const amount = new Intl.NumberFormat('ru-RU').format(Math.round(n)).replace(/,/g, ' ');
  return { amount, unit };
}

function trimZeros(s: string): string {
  // "1.20" -> "1.2", "3.00" -> "3", "120" -> "120" (only strip a *fractional* tail)
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

/**
 * Katta sanoq qiymatlarini (buyurtma/tashrif soni) KPI kartochkasiga sig'adigan
 * qilib qisqartiradi. Oddiy kichik sonlar to'liq (bo'sh joy bilan) ko'rsatiladi:
 *   0 -> "0"   ·   12 345 -> "12 345"   ·   1 250 000 -> "1.25 mln"   ·   3 000 000 000 -> "3 mlrd"
 */
export function formatCount(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '0';
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return trimZeros((n / 1_000_000_000).toFixed(2)) + ' mlrd';
  if (abs >= 1_000_000) return trimZeros((n / 1_000_000).toFixed(2)) + ' mln';
  return new Intl.NumberFormat('ru-RU').format(Math.round(n)).replace(/,/g, ' ');
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const x = typeof d === 'string' ? new Date(d) : d;
  return x.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const x = typeof d === 'string' ? new Date(d) : d;
  return x.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelative(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const x = typeof d === 'string' ? new Date(d) : d;
  const diffSec = Math.round((Date.now() - x.getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s oldin`;
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m oldin`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h oldin`;
  return formatDateTime(x);
}
