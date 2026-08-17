export type Locale = 'uz' | 'ru';

export interface MeDto {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  phone: string | null;
  language: Locale;
  /** Mijozning do'kondagi balansi (so'mda). Backend qo'shmasa — undefined. */
  balance?: number;
  createdAt: string;
}

// ───── Katalog (platforma darajasi) ─────

export interface ServiceDto {
  id: string;
  slug: string;
  nameUz: string;
  nameRu: string;
  emoji: string | null;
  heroCode?: string | null;
  telegramOnly: boolean;
  isActive: boolean;
  position: number;
}

export interface CountryDto {
  id: string;
  slug: string;
  nameUz: string;
  nameRu: string;
  flag: string;
  iso2: string;
  heroCode?: string | null;
  isActive: boolean;
  position: number;
}

// ───── Storefront (reseller takliflari) ─────

/** Prisma Decimal JSON'da string bo'lib keladi — number ham qabul qilamiz. */
export type Money = number | string;

export interface StorefrontOffer {
  id: string;
  serviceId: string;
  countryId: string;
  service: ServiceDto;
  country: CountryDto;
  retailPrice: Money;
  isActive: boolean;
}

// ───── Raqam buyurtmalari ─────

export type NumberOrderStatus =
  | 'WAITING_CODE'
  | 'RECEIVED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'ERROR';

export interface NumberOrder {
  id: string;
  orderNumber: string;
  service: ServiceDto;
  country: CountryDto;
  provider: string;
  phone: string;
  status: NumberOrderStatus;
  code: string | null;
  smsText: string | null;
  retailPrice: Money;
  createdAt: string;
  expiresAt: string;
  receivedAt: string | null;
  cancelledAt: string | null;
}

// ───── Digital (Telegram Stars / Premium) ─────

export type DigitalKind = 'STARS' | 'PREMIUM';

/** Storefront'dagi bitta paket/reja (masalan "100 Stars" yoki "Premium 3 oy"). */
export interface DigitalProduct {
  productId: string;
  label: string;
  /** Stars soni yoki Premium oy soni. */
  amount: number;
  retailPrice: Money;
}

export interface DigitalStorefront {
  starsEnabled: boolean;
  premiumEnabled: boolean;
  stars: DigitalProduct[];
  premium: DigitalProduct[];
}

export type DigitalOrderStatus = 'PENDING' | 'FULFILLED' | 'CANCELLED';

export interface DigitalOrder {
  id: string;
  orderNumber: string;
  kind: DigitalKind;
  username: string;
  status: DigitalOrderStatus;
  retailPrice: Money;
  digitalProduct: { label: string; amount: number };
  createdAt: string;
}

// ───── Sozlamalar (do'kon brendi, aloqa) ─────

export interface PublicSettings {
  store: {
    name?: string;
    phone?: string;
    address?: string;
    workingHours?: string;
    about?: string;
    primaryColor?: string | null;
    logoUrl?: string | null;
    backgroundColor?: string | null;
    backgroundImageUrl?: string | null;
    branded?: boolean;
    mainChannelUrl?: string | null;
    reviewChannelUrl?: string | null;
    adminContactUrl?: string | null;
  };
  business: {
    minOrderAmount: number;
    deliveryFee: number;
    freeDeliveryThreshold: number;
    deliveryEnabled: boolean;
    currency: string;
  };
  prepayment: { enabled: boolean; percent: number };
  payments: { payme: boolean; click: boolean; card: boolean };
  cardPayment: { number: string; holder: string } | null;
}

// ───── Analitika (tracking) ─────

export type EventType =
  | 'VIEW_HOME'
  | 'VIEW_CATALOG'
  | 'VIEW_ORDERS'
  | 'VIEW_ORDER_DETAIL'
  | 'VIEW_PROFILE'
  | 'ORDER_PLACED'
  | 'ORDER_CANCEL';
