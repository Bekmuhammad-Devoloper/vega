import { TariffPlan } from '@prisma/client';

export interface TariffOption {
  value: TariffPlan;
  label: string;
  /** Bir martalik narx (so'm) — model bir martalik (priceMonthly = bir martalik narx). */
  priceMonthly: number;
  priceYearly: number;
  yearlyDiscount: number;
  tagline: string;
  popular?: boolean;
  trialDays: number;
  /** Bir martalik faollashtirish narxi (so'm). */
  oneTimePrice: number;
  /** Server (hosting) uchun OYLIK to'lov — tarif narxidan alohida (so'm). */
  serverMonthly: number;
  features: string[];
}

// Bir martalik tariflar (reseller bir marta to'laydi -> do'kon+bot ochiladi).
// Tarif to'lovi bir martalik; server esa har oy alohida. Oylik/yillik obuna YO'Q.
// Narxlar TariffConfig.oneTimePrice (DB) bilan mos.
export const TARIFFS: TariffOption[] = [
  {
    value: 'FREE',
    label: 'Free',
    priceMonthly: 0,
    priceYearly: 0,
    yearlyDiscount: 0,
    tagline: "Sinab ko'rish uchun",
    trialDays: 0,
    oneTimePrice: 0,
    serverMonthly: 0,
    features: [
      'Telegram raqamlarini sotish',
      "O'z Telegram-botingiz",
      'Cheksiz buyurtmalar',
      'Referal tizimi',
    ],
  },
  {
    value: 'STANDARD',
    label: 'Standart',
    priceMonthly: 119_000,
    priceYearly: 119_000,
    yearlyDiscount: 0,
    tagline: 'Boshlovchi reseller uchun',
    trialDays: 0,
    oneTimePrice: 119_000,
    serverMonthly: 25_000,
    features: [
      "O'z do'koningiz + Telegram-bot",
      'Barcha xizmat va davlatlar',
      "Payme va Click orqali to'lov",
      "Do'kon statistikasi",
      'Otziv kanali (ijtimoiy isbot)',
      'Referal tizimi',
      "24/7 qo'llab-quvvatlash",
    ],
  },
  {
    value: 'PREMIUM',
    label: 'Premium',
    priceMonthly: 219_000,
    priceYearly: 219_000,
    yearlyDiscount: 0,
    tagline: "O'z web saytingiz bilan",
    popular: true,
    trialDays: 0,
    oneTimePrice: 219_000,
    serverMonthly: 30_000,
    features: [
      '🌐 Shaxsiy web sayt',
      '⚡ 2x tezlik (kuchliroq server)',
      'Standart imkoniyatlarining barchasi',
      "White-label (o'z brendingiz)",
      "Maxsus qo'llab-quvvatlash",
    ],
  },
];

export function trialDaysFor(_plan: TariffPlan): number {
  return 0;
}
