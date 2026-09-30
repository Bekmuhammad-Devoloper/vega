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

// Eskirgan bucket'larni vaqti-vaqti bilan tozalaymiz. Kalit fazosi qisman
// mijoz nazoratida (IP/email) bo'lgani uchun, tozalanmasa Map cheksiz o'sadi.
const MAX_BUCKETS = 10_000;
function prune(now: number): void {
  for (const [k, v] of buckets) {
    if (v.resetAt < now) buckets.delete(k);
  }
  // Tozalashdan keyin ham juda katta bo'lsa — eng eskilaridan qisqartiramiz.
  if (buckets.size > MAX_BUCKETS) {
    const sorted = [...buckets.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
    for (let i = 0; i < sorted.length - MAX_BUCKETS; i++) {
      buckets.delete(sorted[i][0]);
    }
  }
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateResult {
  const now = Date.now();
  if (buckets.size > 256 && Math.random() < 0.01) prune(now);
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

function tooMany(retryAfter: number): Response {
  return Response.json(
    { error: `Juda ko'p urinish. ${retryAfter} soniyadan keyin qayta urining.` },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
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
  return tooMany(retryAfter);
}

/**
 * Aniq kalit (masalan email) bo'yicha MUVAFFAQIYATSIZ urinishlarni cheklaydi.
 * IP bilan bir qatorda ishlatiladi: X-Forwarded-For'ni soxtalashtirib IP-limitni
 * chetlab o'tsa ham, bitta akkauntga qilinadigan parol tanlash cheklanadi.
 *
 * MUHIM: bu funksiya bucket'ni SARFLAMAYDI — faqat tekshiradi. Sarflash uchun
 * muvaffaqiyatsizlikdan keyin `recordFailure()` chaqiriladi, muvaffaqiyatda esa
 * `clearFailures()`. Aks holda begona odam qurbonning emailiga so'rov yog'dirib
 * uni tizimdan butunlay bloklab qo'ya olardi (lockout DoS).
 */
export function checkKeyOr429(
  action: string,
  key: string,
  limit: number
): Response | null {
  const b = buckets.get(`${action}:${key}`);
  const now = Date.now();
  if (!b || b.resetAt < now) return null;
  if (b.count >= limit) {
    return tooMany(Math.ceil((b.resetAt - now) / 1000));
  }
  return null;
}

/** Muvaffaqiyatsiz urinishni hisobga oladi. */
export function recordFailure(
  action: string,
  key: string,
  windowMs: number
): void {
  const k = `${action}:${key}`;
  const now = Date.now();
  const b = buckets.get(k);
  if (!b || b.resetAt < now) {
    buckets.set(k, { count: 1, resetAt: now + windowMs });
  } else {
    b.count += 1;
  }
}

/** Muvaffaqiyatli urinishdan keyin hisobni tozalaydi. */
export function clearFailures(action: string, key: string): void {
  buckets.delete(`${action}:${key}`);
}
