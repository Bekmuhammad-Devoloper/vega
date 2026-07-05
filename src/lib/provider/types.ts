// SMS-provayderlar uchun umumiy interfeys.
// 5sim yoki boshqa provayder shu shaklga moslashtiriladi, shunda ilova
// qolgan qismini o'zgartirmasdan provayderni almashtirsa bo'ladi.

export interface ProviderPrice {
  product: string;
  country: string;
  operator: string;
  costRub: number; // provayder narxi (USD — 5sim USD'da qaytaradi)
  count: number; // mavjud raqamlar soni
}

export interface BoughtNumber {
  providerId: string;
  phone: string;
  operator: string;
  costRub: number;
  expiresAt: Date | null;
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

export interface SmsProvider {
  readonly name: string;
  /** Berilgan xizmat + davlat uchun eng arzon narx (yoki null). */
  getPrice(product: string, country: string): Promise<ProviderPrice | null>;
  /** Raqam sotib olish. */
  buy(product: string, country: string, operator?: string): Promise<BoughtNumber>;
  /** Buyurtma holatini va kelgan SMS'larni tekshirish. */
  check(providerId: string): Promise<OrderState>;
  /** Buyurtmani bekor qilish (SMS kelmasa — pul qaytariladi). */
  cancel(providerId: string): Promise<void>;
  /** Buyurtmani yakunlash (SMS olindi, tugatildi). */
  finish(providerId: string): Promise<void>;
  /** Provayderdagi balans (RUB) — admin/monitoring uchun. */
  balanceRub(): Promise<number>;
}
