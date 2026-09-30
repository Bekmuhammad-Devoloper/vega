// UI uchun xizmatlar va davlatlar ro'yxati.
// `hero` — HeroSMS (SMS-Activate protokoli) kodlari.

export interface Product {
  slug: string;
  name: string;
  emoji: string;
  hero: string; // HeroSMS xizmat kodi (tg, wa, ...)
  /**
   * "gift" — Premium havolasi (davlat o'rniga muddat tanlanadi);
   * "stars" — Stars (davlat o'rniga paket, + @username).
   */
  kind?: "number" | "gift" | "stars";
}

export interface Country {
  slug: string;
  name: string;
  flag: string;
  hero: string; // HeroSMS davlat kodi
  spider: string; // ISO2 kodi (SPIDER va LZT Market Telegram uchun)
}

// Manbalar: Telegram raqam + Premium -> LZT Market, Stars -> iStar,
// qolgan xizmatlar (SMS-activation) -> HeroSMS.
export const PRODUCTS: Product[] = [
  { slug: "telegram", name: "Telegram", emoji: "✈️", hero: "tg" },
  { slug: "tg_premium", name: "Telegram Premium", emoji: "⭐", hero: "", kind: "gift" },
  { slug: "tg_stars", name: "Telegram Stars", emoji: "🌟", hero: "", kind: "stars" },
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
  // LZT Market'da arzon va zaxirasi bor davlatlar (faqat Telegram uchun —
  // hero kodi bo'sh: HeroSMS bu yo'nalishlarni o'tkazib yuboradi).
  { slug: "syria", name: "Suriya", flag: "🇸🇾", hero: "", spider: "SY" },
  { slug: "ethiopia", name: "Efiopiya", flag: "🇪🇹", hero: "", spider: "ET" },
  { slug: "tanzania", name: "Tanzaniya", flag: "🇹🇿", hero: "", spider: "TZ" },
  { slug: "yemen", name: "Yaman", flag: "🇾🇪", hero: "", spider: "YE" },
  { slug: "cameroon", name: "Kamerun", flag: "🇨🇲", hero: "", spider: "CM" },
  { slug: "somalia", name: "Somali", flag: "🇸🇴", hero: "", spider: "SO" },
  { slug: "uganda", name: "Uganda", flag: "🇺🇬", hero: "", spider: "UG" },
  { slug: "afghanistan", name: "Afg'oniston", flag: "🇦🇫", hero: "", spider: "AF" },
  { slug: "lebanon", name: "Livan", flag: "🇱🇧", hero: "", spider: "LB" },
  { slug: "tajikistan", name: "Tojikiston", flag: "🇹🇯", hero: "", spider: "TJ" },
  { slug: "iran", name: "Eron", flag: "🇮🇷", hero: "", spider: "IR" },
  { slug: "nepal", name: "Nepal", flag: "🇳🇵", hero: "", spider: "NP" },
  { slug: "cambodia", name: "Kambodja", flag: "🇰🇭", hero: "", spider: "KH" },
  { slug: "algeria", name: "Jazoir", flag: "🇩🇿", hero: "", spider: "DZ" },
  { slug: "kyrgyzstan", name: "Qirg'iziston", flag: "🇰🇬", hero: "", spider: "KG" },
  { slug: "iraq", name: "Iroq", flag: "🇮🇶", hero: "", spider: "IQ" },
  { slug: "sri_lanka", name: "Shri-Lanka", flag: "🇱🇰", hero: "", spider: "LK" },
  { slug: "turkmenistan", name: "Turkmaniston", flag: "🇹🇲", hero: "", spider: "TM" },
  { slug: "belarus", name: "Belarus", flag: "🇧🇾", hero: "", spider: "BY" },
  { slug: "armenia", name: "Armaniston", flag: "🇦🇲", hero: "", spider: "AM" },
  { slug: "georgia", name: "Gruziya", flag: "🇬🇪", hero: "", spider: "GE" },
  { slug: "azerbaijan", name: "Ozarbayjon", flag: "🇦🇿", hero: "", spider: "AZ" },
];

// Telegram Premium gift muddatlari. Order.country maydonida shu slug saqlanadi.
export interface Plan {
  slug: string;
  name: string;
  months: number;
}

export const PREMIUM_PLANS: Plan[] = [
  { slug: "3m", name: "3 oy", months: 3 },
  { slug: "6m", name: "6 oy", months: 6 },
  { slug: "12m", name: "12 oy", months: 12 },
];

export function planBySlug(slug: string): Plan | undefined {
  return PREMIUM_PLANS.find((p) => p.slug === slug);
}

export function isGiftProduct(slug: string): boolean {
  return productBySlug(slug)?.kind === "gift";
}

// Telegram Stars paketlari (iStar: 50 dan). Order.country'da slug saqlanadi.
export interface StarPack {
  slug: string;
  name: string;
  stars: number;
}

export const STAR_PACKS: StarPack[] = [50, 100, 250, 500, 1000, 2500, 5000].map(
  (n) => ({ slug: `${n}st`, name: `${n.toLocaleString("ru-RU")} ⭐`, stars: n })
);

export function starPackBySlug(slug: string): StarPack | undefined {
  return STAR_PACKS.find((p) => p.slug === slug);
}

export function isStarsProduct(slug: string): boolean {
  return productBySlug(slug)?.kind === "stars";
}

/** Order.country maydonini ko'rsatish uchun: davlat, Premium muddati yoki Stars paketi. */
export function variantLabel(slug: string): { flag: string; name: string } | undefined {
  const c = countryBySlug(slug);
  if (c) return { flag: c.flag, name: c.name };
  const plan = planBySlug(slug);
  if (plan) return { flag: "⭐", name: plan.name };
  const pack = starPackBySlug(slug);
  if (pack) return { flag: "🌟", name: pack.name };
  return undefined;
}

/** Buyurtma turi — status yorlig'i va ko'rinish uchun. */
export function orderKind(order: { product: string; provider?: string }): "sms" | "code" | "delivery" {
  const k = productBySlug(order.product)?.kind;
  if (k === "gift" || k === "stars") return "delivery";
  return order.provider === "lzt" ? "code" : "sms";
}

// Telegram @username (5-32 belgi; eski akkauntlarda 4 ham uchraydi).
export const USERNAME_RE = /^@?[A-Za-z][A-Za-z0-9_]{3,31}$/;

export function productBySlug(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

export function countryBySlug(slug: string): Country | undefined {
  return COUNTRIES.find((c) => c.slug === slug);
}
