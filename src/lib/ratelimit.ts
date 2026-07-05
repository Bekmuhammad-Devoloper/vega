// Oddiy xotira ichidagi rate-limiter (fixed window).
// MVP uchun yetarli; ko'p instansiyali prod'da Redis'ga o'tkazing.

const store = globalThis as unknown as {
  __rlBuckets?: Map<string, { count: number; resetAt: number }>;
};
const buckets = (store.__rlBuckets ??= new Map());

export interface RateResult {
  ok: boolean;
  retryAfter: number; // soniya
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateResult {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count += 1;
  return { ok: true, retryAfter: 0 };
}

/** So'rovdan mijoz IP'sini oladi (proxy orqasida ham). */
export function getIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "local";
}

/** Limit oshsa 429 javob, aks holda null. */
export function limitOr429(
  req: Request,
  action: string,
  limit: number,
  windowMs: number
): Response | null {
  const { ok, retryAfter } = rateLimit(`${action}:${getIp(req)}`, limit, windowMs);
  if (ok) return null;
  return Response.json(
    { error: `Juda ko'p urinish. ${retryAfter} soniyadan keyin qayta urining.` },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}
