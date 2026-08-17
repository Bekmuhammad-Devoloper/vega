'use client';

type WebApp = typeof import('@twa-dev/sdk').default;

let cached: WebApp | null = null;

export function getWebApp(): WebApp | null {
  if (typeof window === 'undefined') return null;
  if (cached) return cached;
  if ((window as unknown as { Telegram?: { WebApp?: WebApp } }).Telegram?.WebApp) {
    cached = (window as unknown as { Telegram: { WebApp: WebApp } }).Telegram.WebApp;
    return cached;
  }
  return null;
}

export function getInitData(): string {
  const wa = getWebApp();
  // In dev (browser), fall back to a stub so calls still happen — server will reject.
  if (!wa) return process.env.NEXT_PUBLIC_DEV_INITDATA ?? '';
  return wa.initData;
}

export function haptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning'): void {
  const wa = getWebApp();
  if (!wa) return;
  if (type === 'success' || type === 'error' || type === 'warning') {
    wa.HapticFeedback?.notificationOccurred(type);
  } else {
    wa.HapticFeedback?.impactOccurred(type);
  }
}

export function showAlert(message: string): void {
  const wa = getWebApp();
  if (wa?.showAlert) wa.showAlert(message);
  else if (typeof window !== 'undefined') window.alert(message);
}
