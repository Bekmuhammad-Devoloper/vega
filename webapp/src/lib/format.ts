import type { Locale } from '@/i18n';

export function formatMoney(value: number | string, locale: Locale = 'uz'): string {
  const n = typeof value === 'string' ? Number(value) : value;
  const formatted = new Intl.NumberFormat('ru-RU').format(Math.round(n)).replace(/,/g, ' ');
  return `${formatted} ${locale === 'ru' ? 'сум' : "so'm"}`;
}

export function formatDate(date: string | Date, locale: Locale = 'uz'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(date: string | Date, locale: Locale = 'uz'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString(locale === 'ru' ? 'ru-RU' : 'uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
