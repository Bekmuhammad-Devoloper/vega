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
  spider: string; // SPIDER TG API ISO2 kodi (Telegram uchun)
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
  { slug: "uzbekistan", name: "O'zbekiston", flag: "🇺🇿", hero: "40", spider: "UZ" },
  { slug: "south_africa", name: "Janubiy Afrika", flag: "🇿🇦", hero: "31", spider: "ZA" },
  { slug: "indonesia", name: "Indoneziya", flag: "🇮🇩", hero: "6", spider: "ID" },
  { slug: "colombia", name: "Kolumbiya", flag: "🇨🇴", hero: "33", spider: "CO" },
  { slug: "canada", name: "Kanada", flag: "🇨🇦", hero: "36", spider: "CA" },
  { slug: "brazil", name: "Braziliya", flag: "🇧🇷", hero: "73", spider: "BR" },
  { slug: "usa", name: "AQSH", flag: "🇺🇸", hero: "187", spider: "US" },
  { slug: "uk", name: "Angliya", flag: "🇬🇧", hero: "16", spider: "GB" },
  { slug: "egypt", name: "Misr", flag: "🇪🇬", hero: "21", spider: "EG" },
  { slug: "ghana", name: "Gana", flag: "🇬🇭", hero: "38", spider: "GH" },
  { slug: "kenya", name: "Keniya", flag: "🇰🇪", hero: "8", spider: "KE" },
  { slug: "morocco", name: "Marokko", flag: "🇲🇦", hero: "37", spider: "MA" },
  { slug: "nigeria", name: "Nigeriya", flag: "🇳🇬", hero: "19", spider: "NG" },
  { slug: "oman", name: "Ummon", flag: "🇴🇲", hero: "107", spider: "OM" },
  { slug: "myanmar", name: "Myanma", flag: "🇲🇲", hero: "5", spider: "MM" },
  { slug: "philippines", name: "Filippin", flag: "🇵🇭", hero: "4", spider: "PH" },
  { slug: "vietnam", name: "Vetnam", flag: "🇻🇳", hero: "10", spider: "VN" },
  { slug: "pakistan", name: "Pokiston", flag: "🇵🇰", hero: "66", spider: "PK" },
  { slug: "bangladesh", name: "Bangladesh", flag: "🇧🇩", hero: "60", spider: "BD" },
  { slug: "thailand", name: "Tailand", flag: "🇹🇭", hero: "52", spider: "TH" },
  { slug: "malaysia", name: "Malayziya", flag: "🇲🇾", hero: "7", spider: "MY" },
  { slug: "india", name: "Hindiston", flag: "🇮🇳", hero: "22", spider: "IN" },
  { slug: "china", name: "Xitoy", flag: "🇨🇳", hero: "3", spider: "CN" },
  { slug: "mexico", name: "Meksika", flag: "🇲🇽", hero: "54", spider: "MX" },
  { slug: "argentina", name: "Argentina", flag: "🇦🇷", hero: "39", spider: "AR" },
  { slug: "chile", name: "Chili", flag: "🇨🇱", hero: "151", spider: "CL" },
  { slug: "saudi", name: "Saudiya", flag: "🇸🇦", hero: "53", spider: "SA" },
  { slug: "turkey", name: "Turkiya", flag: "🇹🇷", hero: "62", spider: "TR" },
  { slug: "romania", name: "Ruminiya", flag: "🇷🇴", hero: "32", spider: "RO" },
  { slug: "netherlands", name: "Niderlandiya", flag: "🇳🇱", hero: "48", spider: "NL" },
  { slug: "spain", name: "Ispaniya", flag: "🇪🇸", hero: "56", spider: "ES" },
  { slug: "germany", name: "Germaniya", flag: "🇩🇪", hero: "43", spider: "DE" },
  { slug: "france", name: "Fransiya", flag: "🇫🇷", hero: "78", spider: "FR" },
  { slug: "poland", name: "Polsha", flag: "🇵🇱", hero: "15", spider: "PL" },
  { slug: "italy", name: "Italiya", flag: "🇮🇹", hero: "86", spider: "IT" },
  { slug: "kazakhstan", name: "Qozog'iston", flag: "🇰🇿", hero: "2", spider: "KZ" },
  { slug: "ukraine", name: "Ukraina", flag: "🇺🇦", hero: "1", spider: "UA" },
];

export function productBySlug(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

export function countryBySlug(slug: string): Country | undefined {
  return COUNTRIES.find((c) => c.slug === slug);
}
