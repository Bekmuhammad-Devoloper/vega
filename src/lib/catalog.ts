// UI uchun xizmatlar va davlatlar ro'yxati.
// `hero` — HeroSMS (SMS-Activate protokoli) kodlari.

export interface Product {
  slug: string;
  name: string;
  emoji: string;
  hero: string; // HeroSMS xizmat kodi (tg, wa, ...)
}

export interface Country {
  slug: string;
  name: string;
  flag: string;
  hero: string; // HeroSMS davlat kodi
}

export const PRODUCTS: Product[] = [
  { slug: "telegram", name: "Telegram", emoji: "✈️", hero: "tg" },
  { slug: "whatsapp", name: "WhatsApp", emoji: "💬", hero: "wa" },
  { slug: "instagram", name: "Instagram", emoji: "📸", hero: "ig" },
  { slug: "google", name: "Google / Gmail", emoji: "🔴", hero: "go" },
  { slug: "facebook", name: "Facebook", emoji: "👍", hero: "fb" },
  { slug: "tiktok", name: "TikTok", emoji: "🎵", hero: "lf" },
  { slug: "twitter", name: "Twitter / X", emoji: "🐦", hero: "tw" },
  { slug: "viber", name: "Viber", emoji: "🟣", hero: "vi" },
  { slug: "uber", name: "Uber", emoji: "🚗", hero: "ub" },
];

// Mashhur + arzon + zaxirasi ko'p davlatlar (HeroSMS narxlariga ko'ra tanlangan).
export const COUNTRIES: Country[] = [
  { slug: "uzbekistan", name: "O'zbekiston", flag: "🇺🇿", hero: "40" },
  { slug: "south_africa", name: "Janubiy Afrika", flag: "🇿🇦", hero: "31" },
  { slug: "indonesia", name: "Indoneziya", flag: "🇮🇩", hero: "6" },
  { slug: "colombia", name: "Kolumbiya", flag: "🇨🇴", hero: "33" },
  { slug: "canada", name: "Kanada", flag: "🇨🇦", hero: "36" },
  { slug: "brazil", name: "Braziliya", flag: "🇧🇷", hero: "73" },
  { slug: "usa", name: "AQSH", flag: "🇺🇸", hero: "187" },
  { slug: "uk", name: "Angliya", flag: "🇬🇧", hero: "16" },
  { slug: "egypt", name: "Misr", flag: "🇪🇬", hero: "21" },
  { slug: "ghana", name: "Gana", flag: "🇬🇭", hero: "38" },
  { slug: "kenya", name: "Keniya", flag: "🇰🇪", hero: "8" },
  { slug: "morocco", name: "Marokko", flag: "🇲🇦", hero: "37" },
  { slug: "nigeria", name: "Nigeriya", flag: "🇳🇬", hero: "19" },
  { slug: "oman", name: "Ummon", flag: "🇴🇲", hero: "107" },
  { slug: "myanmar", name: "Myanma", flag: "🇲🇲", hero: "5" },
  { slug: "philippines", name: "Filippin", flag: "🇵🇭", hero: "4" },
  { slug: "vietnam", name: "Vetnam", flag: "🇻🇳", hero: "10" },
  { slug: "pakistan", name: "Pokiston", flag: "🇵🇰", hero: "66" },
  { slug: "bangladesh", name: "Bangladesh", flag: "🇧🇩", hero: "60" },
  { slug: "thailand", name: "Tailand", flag: "🇹🇭", hero: "52" },
  { slug: "malaysia", name: "Malayziya", flag: "🇲🇾", hero: "7" },
  { slug: "india", name: "Hindiston", flag: "🇮🇳", hero: "22" },
  { slug: "china", name: "Xitoy", flag: "🇨🇳", hero: "3" },
  { slug: "mexico", name: "Meksika", flag: "🇲🇽", hero: "54" },
  { slug: "argentina", name: "Argentina", flag: "🇦🇷", hero: "39" },
  { slug: "chile", name: "Chili", flag: "🇨🇱", hero: "151" },
  { slug: "saudi", name: "Saudiya", flag: "🇸🇦", hero: "53" },
  { slug: "turkey", name: "Turkiya", flag: "🇹🇷", hero: "62" },
  { slug: "romania", name: "Ruminiya", flag: "🇷🇴", hero: "32" },
  { slug: "netherlands", name: "Niderlandiya", flag: "🇳🇱", hero: "48" },
  { slug: "spain", name: "Ispaniya", flag: "🇪🇸", hero: "56" },
  { slug: "germany", name: "Germaniya", flag: "🇩🇪", hero: "43" },
  { slug: "france", name: "Fransiya", flag: "🇫🇷", hero: "78" },
  { slug: "poland", name: "Polsha", flag: "🇵🇱", hero: "15" },
  { slug: "italy", name: "Italiya", flag: "🇮🇹", hero: "86" },
  { slug: "kazakhstan", name: "Qozog'iston", flag: "🇰🇿", hero: "2" },
  { slug: "ukraine", name: "Ukraina", flag: "🇺🇦", hero: "1" },
];

export function productBySlug(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

export function countryBySlug(slug: string): Country | undefined {
  return COUNTRIES.find((c) => c.slug === slug);
}
