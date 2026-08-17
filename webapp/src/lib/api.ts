import { API_URL } from './env';
import { getInitData } from './telegram';
import type { Locale } from '@/i18n';

export class ApiError extends Error {
  readonly statusCode: number;
  readonly details?: unknown;
  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

let currentLocale: Locale = 'uz';
export function setApiLocale(locale: Locale): void {
  currentLocale = locale;
}
export function getApiLocale(): Locale {
  return currentLocale;
}

/**
 * Qaysi do'kon (sotuvchi) ochilgan — URL ?shop=, Telegram start_param yoki localStorage'dan.
 * Bir marta aniqlanib, SPA navigatsiyasida saqlanadi.
 */
let shopSlug: string | undefined;
export function getShopSlug(): string | null {
  if (shopSlug !== undefined) return shopSlug || null;
  if (typeof window === 'undefined') return null;
  let slug = '';
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('shop');
    const tg = (
      window as unknown as {
        Telegram?: { WebApp?: { initDataUnsafe?: { start_param?: string } } };
      }
    ).Telegram?.WebApp?.initDataUnsafe?.start_param;
    const stored = window.localStorage.getItem('shop_slug');
    slug = (fromUrl || tg || stored || '').trim();
    if (slug) window.localStorage.setItem('shop_slug', slug);
  } catch {
    slug = '';
  }
  shopSlug = slug;
  return slug || null;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: unknown;
  query?: Record<string, unknown>;
  signal?: AbortSignal;
  skipAuth?: boolean;
};

function buildUrl(path: string, query?: Record<string, unknown>): string {
  // Relative path → use current origin (works through tunnel + lokal)
  const isAbsolute = path.startsWith('http://') || path.startsWith('https://');
  const isRelative = API_URL.startsWith('/');
  const base =
    isAbsolute
      ? ''
      : isRelative && typeof window !== 'undefined'
        ? window.location.origin + API_URL
        : isRelative
          ? `http://localhost:5174${API_URL}` // SSR fallback (rare)
          : API_URL;
  const url = new URL(isAbsolute ? path : `${base}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal, skipAuth } = options;
  const headers: Record<string, string> = {
    'Accept-Language': currentLocale,
    // Bypass localtunnel landing page (har doim mumkin, zarari yo'q)
    'bypass-tunnel-reminder': '1',
  };
  if (!skipAuth) {
    const initData = getInitData();
    if (initData) headers['X-Telegram-Init-Data'] = initData;
  }
  // Multi-tenant: qaysi do'kon (sotuvchi) ochilganini bildiramiz
  const shop = getShopSlug();
  if (shop) headers['X-Tenant-Slug'] = shop;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
    credentials: 'omit',
  });

  if (res.status === 204) return undefined as unknown as T;

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    payload = undefined;
  }

  if (!res.ok) {
    const errObj = (payload as { message?: string; details?: unknown }) ?? {};
    throw new ApiError(errObj.message ?? `HTTP ${res.status}`, res.status, errObj.details);
  }
  return payload as T;
}

/** Fayl (multipart/form-data) yuklash — chek rasmlari va h.k. uchun. */
export async function apiUploadForm<T>(path: string, file: File, field = 'file'): Promise<T> {
  const headers: Record<string, string> = {
    'Accept-Language': currentLocale,
    'bypass-tunnel-reminder': '1',
  };
  const initData = getInitData();
  if (initData) headers['X-Telegram-Init-Data'] = initData;
  const shop = getShopSlug();
  if (shop) headers['X-Tenant-Slug'] = shop;

  const form = new FormData();
  form.append(field, file);

  const res = await fetch(buildUrl(path), {
    method: 'POST',
    headers, // Content-Type'ni brauzer o'zi (boundary bilan) qo'yadi
    body: form,
    credentials: 'omit',
  });

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    payload = undefined;
  }
  if (!res.ok) {
    const errObj = (payload as { message?: string; details?: unknown }) ?? {};
    throw new ApiError(errObj.message ?? `HTTP ${res.status}`, res.status, errObj.details);
  }
  return payload as T;
}

/** Oldindan tuzilgan FormData'ni POST qiladi (auth + tenant header bilan). */
export async function apiPostForm<T>(path: string, form: FormData): Promise<T> {
  const headers: Record<string, string> = {
    'Accept-Language': currentLocale,
    'bypass-tunnel-reminder': '1',
  };
  const initData = getInitData();
  if (initData) headers['X-Telegram-Init-Data'] = initData;
  const shop = getShopSlug();
  if (shop) headers['X-Tenant-Slug'] = shop;

  const res = await fetch(buildUrl(path), {
    method: 'POST',
    headers, // Content-Type'ni brauzer boundary bilan qo'yadi
    body: form,
    credentials: 'omit',
  });
  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    payload = undefined;
  }
  if (!res.ok) {
    const errObj = (payload as { message?: string; details?: unknown }) ?? {};
    throw new ApiError(errObj.message ?? `HTTP ${res.status}`, res.status, errObj.details);
  }
  return payload as T;
}

export async function sendBeaconBatch(path: string, events: unknown[]): Promise<void> {
  const initData = getInitData();
  const url = buildUrl(path);
  if (typeof navigator === 'undefined' || !navigator.sendBeacon) {
    void api(path, { method: 'POST', body: { events } }).catch(() => undefined);
    return;
  }
  const blob = new Blob([JSON.stringify({ events, initData })], { type: 'application/json' });
  navigator.sendBeacon(url, blob);
}
