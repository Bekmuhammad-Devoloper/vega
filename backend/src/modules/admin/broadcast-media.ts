/**
 * Broadcast media: havola (link) orqali media qo'shish yordamchilari.
 * - Telegram kanal posti havolasi -> copyMessage uchun {fromChatId, messageId}
 * - Instagram havolasi -> og:video/og:image dan media baytlarini olish (best-effort)
 */

export interface TgPostRef {
  fromChatId: string;
  messageId: number;
}

/**
 * t.me post havolasini (chat_id, message_id) ga ajratadi.
 *  - https://t.me/<username>/<id>            -> @<username>, id
 *  - https://t.me/s/<username>/<id>          -> @<username>, id  (web-preview)
 *  - https://t.me/<username>/<thread>/<id>   -> @<username>, id  (forum/topic)
 *  - https://t.me/c/<internalId>/<id>        -> -100<internalId>, id  (private)
 */
export function parseTelegramPostLink(raw: string): TgPostRef | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (host !== 't.me' && host !== 'telegram.me' && host !== 'telegram.dog') return null;
  let parts = u.pathname.split('/').filter(Boolean);
  if (parts[0] === 's') parts = parts.slice(1); // web-preview prefix
  if (parts.length < 2) return null;

  const messageId = Number(parts[parts.length - 1]);
  if (!Number.isInteger(messageId) || messageId <= 0) return null;

  if (parts[0] === 'c') {
    // /c/<internalId>/<msgId> — kamida 3 segment bo'lishi shart
    if (parts.length < 3) return null;
    const internalId = parts[1];
    if (!/^\d+$/.test(internalId)) return null;
    return { fromChatId: `-100${internalId}`, messageId };
  }

  const username = parts[0];
  if (!/^[A-Za-z][A-Za-z0-9_]{3,}$/.test(username)) return null;
  // reserved/non-channel paths
  if (['joinchat', 'addstickers', 'share', 'addlist', 'proxy', 'socks', 'login', 'iv'].includes(username.toLowerCase())) {
    return null;
  }
  return { fromChatId: `@${username}`, messageId };
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/gi, '/')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export function isInstagramLink(raw: string): boolean {
  try {
    return /(^|\.)instagram\.com$/i.test(new URL(raw.trim()).hostname);
  } catch {
    return false;
  }
}

/** SSRF himoyasi: faqat https va ichki/maxsus IP bo'lmagan host. */
function isSafePublicHttpsUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  let h = u.hostname.toLowerCase();
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1); // IPv6 qavslarini olib tashlash
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return false;
  // IPv4 ichki/maxsus diapazonlar va metadata
  if (/^127\.|^10\.|^192\.168\.|^169\.254\.|^0\./.test(h)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
  if (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return false;
  return true;
}

export interface ResolvedMedia {
  type: 'photo' | 'video';
  buffer: Buffer;
  mime: string;
}

/**
 * Instagram post/reel havolasidan media baytlarini olishga URINADI (best-effort).
 * Instagram botlarni faol bloklaydi — muvaffaqiyatsiz bo'lsa null qaytaradi.
 */
export async function resolveInstagramMedia(raw: string): Promise<ResolvedMedia | null> {
  try {
    const res = await fetch(raw.trim(), {
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: {
        'user-agent':
          'Mozilla/5.0 (compatible; facebookexternalhit/1.1; +http://www.facebook.com/externalhit_uatext.php)',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();

    const og = (prop: string): string | null => {
      const m =
        html.match(new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i')) ??
        html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, 'i'));
      return m ? decodeHtmlEntities(m[1]) : null;
    };

    const videoUrl = og('og:video') ?? og('og:video:secure_url');
    const imageUrl = og('og:image');
    const mediaUrl = videoUrl ?? imageUrl;
    if (!mediaUrl || !isSafePublicHttpsUrl(mediaUrl)) return null;

    const mres = await fetch(mediaUrl, {
      headers: { 'user-agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(12000),
      redirect: 'manual', // redirect'ni kuzatmaymiz — SSRF (ichki hostga yo'naltirish) oldini olish
    });
    if (!mres.ok) return null; // 3xx redirect ham !ok — bloklanadi
    const declaredLen = Number(mres.headers.get('content-length') ?? '0');
    if (declaredLen > 50 * 1024 * 1024) return null;
    const buffer = Buffer.from(new Uint8Array(await mres.arrayBuffer()));
    if (buffer.length === 0 || buffer.length > 50 * 1024 * 1024) return null;
    const mime = mres.headers.get('content-type') ?? (videoUrl ? 'video/mp4' : 'image/jpeg');
    return { type: videoUrl ? 'video' : 'photo', buffer, mime };
  } catch {
    return null;
  }
}
