import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/uz-latn';

dayjs.extend(relativeTime);
dayjs.locale('uz-latn');

export function formatUzs(value: number | string | null | undefined, withSuffix = true): string {
  const n = typeof value === 'string' ? Number(value) : value ?? 0;
  if (!Number.isFinite(n)) return '0';
  const formatted = new Intl.NumberFormat('uz-UZ').format(Math.round(n));
  return withSuffix ? `${formatted} so'm` : formatted;
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  const n = value ?? 0;
  if (!Number.isFinite(n)) return '0';
  return new Intl.NumberFormat('uz-UZ', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export function formatCompact(value: number | null | undefined): string {
  const n = value ?? 0;
  if (!Number.isFinite(n)) return '0';
  return new Intl.NumberFormat('uz-UZ', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function formatBytes(mb: number | null | undefined): string {
  const m = mb ?? 0;
  if (m < 1) return `${(m * 1024).toFixed(0)} KB`;
  if (m < 1024) return `${m.toFixed(1)} MB`;
  return `${(m / 1024).toFixed(2)} GB`;
}

export function formatDate(value: string | Date | null | undefined, withTime = false): string {
  if (!value) return '—';
  return dayjs(value).format(withTime ? 'DD.MM.YYYY HH:mm' : 'DD.MM.YYYY');
}

export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return dayjs(value).fromNow();
}

export function formatPct(value: number | null | undefined, decimals = 1): string {
  const n = value ?? 0;
  return `${n.toFixed(decimals)}%`;
}

export function formatUsd(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? Number(value) : value ?? 0;
  return `$${n.toFixed(2)}`;
}
