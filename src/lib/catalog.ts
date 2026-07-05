// UI uchun tanlangan xizmatlar va davlatlar ro'yxati.
// slug — 5sim API'dagi nomlar bilan bir xil bo'lishi kerak.

export interface Product {
  slug: string;
  name: string;
  emoji: string;
}

export interface Country {
  slug: string;
  name: string;
  flag: string;
}

export const PRODUCTS: Product[] = [
  { slug: "telegram", name: "Telegram", emoji: "✈️" },
  { slug: "whatsapp", name: "WhatsApp", emoji: "💬" },
  { slug: "instagram", name: "Instagram", emoji: "📸" },
  { slug: "google", name: "Google / Gmail", emoji: "🔴" },
  { slug: "facebook", name: "Facebook", emoji: "👍" },
  { slug: "tiktok", name: "TikTok", emoji: "🎵" },
  { slug: "twitter", name: "Twitter / X", emoji: "🐦" },
  { slug: "viber", name: "Viber", emoji: "🟣" },
  { slug: "uber", name: "Uber", emoji: "🚗" },
];

export const COUNTRIES: Country[] = [
  { slug: "uzbekistan", name: "O'zbekiston", flag: "🇺🇿" },
  { slug: "usa", name: "AQSH", flag: "🇺🇸" },
  { slug: "kazakhstan", name: "Qozog'iston", flag: "🇰🇿" },
  { slug: "ukraine", name: "Ukraina", flag: "🇺🇦" },
  { slug: "india", name: "Hindiston", flag: "🇮🇳" },
  { slug: "indonesia", name: "Indoneziya", flag: "🇮🇩" },
  { slug: "philippines", name: "Filippin", flag: "🇵🇭" },
  { slug: "germany", name: "Germaniya", flag: "🇩🇪" },
  { slug: "france", name: "Fransiya", flag: "🇫🇷" },
  { slug: "poland", name: "Polsha", flag: "🇵🇱" },
];

export function productBySlug(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

export function countryBySlug(slug: string): Country | undefined {
  return COUNTRIES.find((c) => c.slug === slug);
}
