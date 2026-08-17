// Default — nisbiy '/api' (same-origin). next.config rewrites uni BACKEND_URL ga
// proxy qiladi (prod: 127.0.0.1:2400, dev: localhost:4000). Shu sabab har serverda
// alohida env shart emas. Boshqa originga ulanish kerak bo'lsagina NEXT_PUBLIC_API_URL bering.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api';
export const BOT_USERNAME = process.env.NEXT_PUBLIC_BOT_USERNAME ?? '';
