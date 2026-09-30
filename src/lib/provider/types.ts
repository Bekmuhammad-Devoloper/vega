// SMS-provayderlar uchun umumiy interfeys.
// 5sim yoki boshqa provayder shu shaklga moslashtiriladi, shunda ilova
// qolgan qismini o'zgartirmasdan provayderni almashtirsa bo'ladi.

export interface ProviderPrice {
  product: string;
  country: string;
  operator: string;
  costRub: number; // provayder narxi (valyuta: `currency`, default USD)
  currency?: "USD" | "RUB";
  count: number; // mavjud raqamlar soni
}

export interface BoughtNumber {
  providerId: string;
  phone: string;
  operator: string;
  costRub: number;
  currency?: "USD" | "RUB";
  expiresAt: Date | null;
  /** Xariddayoq yetkazilgan mahsulot (masalan Premium gift havolasi). */
  delivered?: ProviderSms;
  /** false — provayderda bekor qilib/pulni qaytarib bo'lmaydi (LZT). */
  refundable?: boolean;
}

export interface ProviderSms {
  code: string | null;
  text: string | null;
  sender: string | null;
}

export interface OrderState {
  status: string; // provayder statusi (PENDING, RECEIVED, CANCELED, ...)
  phone?: string;
  sms: ProviderSms[];
}

/** Mahsulotga xos qo'shimcha ma'lumot (masalan Stars oluvchisi). */
export interface BuyExtra {
  username?: string;
}

export interface SmsProvider {
  readonly name: string;
  /** Berilgan xizmat + davlat uchun eng arzon narx (yoki null). */
  getPrice(product: string, country: string): Promise<ProviderPrice | null>;
  /** Raqam sotib olish. */
  buy(
    product: string,
    country: string,
    operator?: string,
    extra?: BuyExtra
  ): Promise<BoughtNumber>;
  /** Buyurtma holatini va kelgan SMS'larni tekshirish. */
  check(providerId: string): Promise<OrderState>;
  /** Buyurtmani bekor qilish (SMS kelmasa — pul qaytariladi). */
  cancel(providerId: string): Promise<void>;
  /** Buyurtmani yakunlash (SMS olindi, tugatildi). */
  finish(providerId: string): Promise<void>;
  /** Provayderdagi balans (RUB) — admin/monitoring uchun. */
  balanceRub(): Promise<number>;
}
