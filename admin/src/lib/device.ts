/**
 * Qurilma (brauzer) ID — abuse himoyasi uchun. localStorage'da bir marta
 * generatsiya qilinadi va saqlanadi. Telegram Mini App webview'ida ham
 * akkaunt almashsa saqlanadi (per-brauzer). Onboarding'da yuboriladi —
 * shu qurilmadan boshqa Telegram akkaunt bilan qayta free olishni to'sadi.
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = localStorage.getItem('vega_device');
    if (!id) {
      id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `d${Date.now()}${Math.random().toString(36).slice(2)}`;
      localStorage.setItem('vega_device', id);
    }
    return id;
  } catch {
    return '';
  }
}
