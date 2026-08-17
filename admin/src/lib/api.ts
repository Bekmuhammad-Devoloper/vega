const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export class ApiError extends Error {
  readonly statusCode: number;
  readonly details?: unknown;
  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: unknown;
  query?: Record<string, unknown>;
  signal?: AbortSignal;
  formData?: FormData;
};

let accessToken: string | null = null;
export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (typeof window !== 'undefined') {
    if (token) localStorage.setItem('admin_at', token);
    else localStorage.removeItem('admin_at');
  }
}
export function loadAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  if (accessToken) return accessToken;
  accessToken = localStorage.getItem('admin_at');
  return accessToken;
}

function buildUrl(path: string, query?: Record<string, unknown>): string {
  const base = typeof window !== 'undefined' ? window.location.origin + API_URL : `http://localhost:5175${API_URL}`;
  const url = new URL(`${base}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

let refreshPromise: Promise<string> | null = null;

async function refreshToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const res = await fetch(buildUrl('/admin/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      setAccessToken(null);
      throw new ApiError('Session expired', 401);
    }
    const data = (await res.json()) as { accessToken: string };
    setAccessToken(data.accessToken);
    return data.accessToken;
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

export async function api<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { method = 'GET', body, query, signal, formData } = options;
  const headers: Record<string, string> = {};
  const token = loadAccessToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body !== undefined && !formData) headers['Content-Type'] = 'application/json';

  const res = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: formData ? formData : body !== undefined ? JSON.stringify(body) : undefined,
    signal,
    credentials: 'include',
  });

  if (res.status === 401 && !isRetry && !path.includes('/auth/')) {
    try {
      await refreshToken();
      return api<T>(path, options, true);
    } catch {
      throw new ApiError('Unauthorized', 401);
    }
  }

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
