export type AdminRole = 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'CREATOR' | 'MODERATOR';

export interface AdminDto {
  id: string;
  email: string;
  fullName: string;
  role: AdminRole;
  isActive: boolean;
  createdAt: string;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** Prisma Decimal JSON'da string bo'lib kelishi mumkin — number ham qabul qilamiz. */
export type Money = number | string;

// ───── Foydalanuvchi buyurtma statusi (mijoz tarixida ishlatiladi) ─────
export type OrderStatus =
  | 'WAITING_CODE'
  | 'RECEIVED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'ERROR';

// ───── Katalog (platforma xizmatlari va davlatlari) ─────

export interface ServiceDto {
  id: string;
  slug: string;
  nameUz: string;
  nameRu: string;
  emoji: string | null;
  heroCode?: string | null;
  telegramOnly?: boolean;
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

// ───── Reseller takliflari (xizmat × davlat + retail narx) ─────

export interface AdminOffer {
  id: string;
  serviceId: string;
  countryId: string;
  /** Backend odatda service/country obyektini ham qo'shib yuboradi. */
  service?: ServiceDto;
  country?: CountryDto;
  retailPrice: Money;
  /** Ulgurji narx (agar backend qaytarsa) — foyda hisobi uchun. */
  wholesalePrice?: Money;
  isActive: boolean;
  createdAt?: string;
}

// ───── Raqam buyurtmalari (mijozlar sotib olgan) ─────

export type NumberOrderStatus = OrderStatus;

export interface AdminNumberOrder {
  id: string;
  orderNumber: string;
  user: {
    id: string;
    username: string | null;
    firstName: string | null;
    telegramId: string;
  } | null;
  service: ServiceDto;
  country: CountryDto;
  provider?: string;
  phone: string;
  status: NumberOrderStatus;
  code: string | null;
  smsText?: string | null;
  retailPrice: Money;
  wholesalePrice?: Money;
  profit?: Money;
  createdAt: string;
  expiresAt?: string | null;
  receivedAt?: string | null;
  cancelledAt?: string | null;
}

// ───── Digital tovarlar (Telegram Stars / Premium) ─────

export type DigitalKind = 'STARS' | 'PREMIUM';

/** Platforma katalogi — reseller shu paketlarga retail narx qo'yadi. */
export interface DigitalProduct {
  id: string;
  kind: DigitalKind;
  /** Masalan "100 Stars" yoki "Premium 3 oy". */
  label: string;
  /** Stars soni yoki oylik muddat. */
  amount: number;
  /** Platforma ulgurji narxi (USD). */
  wholesaleUsd: number;
  /** O'sha ulgurji narx so'mda — kursni backend qo'llaydi. */
  wholesaleUzs: number;
  isActive: boolean;
  position: number;
}

/** Reseller o'z narxi (katalog mahsulotiga bog'langan). */
export interface DigitalOffer {
  id: string;
  digitalProductId: string;
  digitalProduct: {
    id: string;
    kind: DigitalKind;
    label: string;
    amount: number;
    wholesaleUsd: number;
  };
  retailPrice: Money;
  isActive: boolean;
}

export type DigitalOrderStatus = 'PENDING' | 'FULFILLED' | 'CANCELLED';

export interface DigitalOrder {
  id: string;
  orderNumber: string;
  kind: DigitalKind;
  username: string | null;
  status: DigitalOrderStatus;
  retailPrice: Money;
  profit: Money;
  digitalProduct: { label: string };
  user?: {
    username?: string | null;
    firstName?: string | null;
    telegramId?: string | null;
  } | null;
  createdAt: string;
}

/** Funksiyani yoqish holati (PATCH /admin/digital/settings javobi). */
export interface DigitalSettings {
  starsEnabled: boolean;
  premiumEnabled: boolean;
}

// ───── Ulgurji hamyon ─────

export type WalletTxnType = string;

export interface WalletTransaction {
  id?: string;
  type: WalletTxnType;
  amount: Money;
  balanceAfter: Money;
  note?: string | null;
  createdAt: string;
  /** TOPUP uchun to'lov cheki rasmi (ustiga bossa ochiladi). */
  receiptUrl?: string | null;
}

export interface WalletData {
  balance: Money;
  transactions: WalletTransaction[];
}

// ───── Raqam statistikasi (defensiv — maydonlar backendga qarab bo'lmasligi mumkin) ─────

export interface NumberStats {
  total?: number;
  received?: number;
  waiting?: number;
  cancelled?: number;
  revenue?: Money;
  wholesale?: Money;
  profit?: Money;
  today?: {
    total?: number;
    revenue?: Money;
    profit?: Money;
  };
}

// ───── Foydalanuvchilar ─────

export interface AdminUserListItem {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  phone: string | null;
  language: 'uz' | 'ru';
  /** Mijozning shu do'kondagi hisob balansi (so'm). */
  balance: number;
  isBlocked: boolean;
  ordersCount: number;
  lastSeenAt: string;
  createdAt: string;
}

export interface AdminUserDetail extends AdminUserListItem {
  stats: {
    ordersCount: number;
    revenue: number;
    avgOrderValue: number;
    eventsCount: number;
  };
}

export interface UserEventItem {
  id: string;
  type: string;
  productId: string | null;
  categoryId: string | null;
  payload: Record<string, unknown> | null;
  product: { id: string; title: string; imageUrl: string | null } | null;
  createdAt: string;
}

export interface InterestsResponse {
  topCategories: Array<{
    categoryId: string;
    titleUz: string;
    titleRu: string;
    score: number;
    views: number;
    cartAdds: number;
    favorites: number;
    orders: number;
  }>;
  topProducts: Array<{ id: string; title: string; imageUrl: string | null; viewCount: number }>;
  cartAbandonment: Array<{ productId: string; titleUz: string; addCount: number }>;
}

// ───── Statistika (overview / timeseries / funnel) ─────

export interface StatsOverview {
  today: { orders: number; revenue: number; uniqueVisitors: number; conversion: number };
  delta: { orders: number; revenue: number; uniqueVisitors: number; conversion: number };
  totals: { users: number; activeProducts: number; ordersTotal: number };
}

export interface TimeseriesPoint {
  day: string;
  orders: number;
  revenue: number;
  visitors: number;
}

export interface FunnelData {
  visits: number;
  productViews: number;
  cartAdds: number;
  checkouts: number;
  orders: number;
}

// ───── Promo kodlar ─────

export interface PromoCodeView {
  id: string;
  code: string;
  type: 'PERCENT' | 'FIXED';
  value: number;
  minOrderAmount: number | null;
  maxDiscount: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  usageLimit: number | null;
  perUserLimit: number;
  usageCount: number;
  isPublic: boolean;
  isActive: boolean;
  descriptionUz: string | null;
  descriptionRu: string | null;
  createdAt: string;
}

// ───── Support ─────

export interface SupportTicketListItem {
  id: string;
  subject: string;
  message: string;
  status: string;
  user: { id: string; username: string | null; firstName: string | null; telegramId: string };
  createdAt: string;
}

// ───── Bannerlar ─────

export interface BannerView {
  id: string;
  placement: string;
  imageUrlUz: string;
  imageUrlRu: string | null;
  targetType: string;
  targetValue: string | null;
  position: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

// ───── Xabarnomalar (broadcast) ─────

export interface BroadcastFilters {
  hasOrders?: boolean;
  noOrdersInDays?: number;
  activeInDays?: number;
  language?: 'uz' | 'ru';
  excludeBlocked?: boolean;
}

export interface BroadcastItem {
  id: string;
  messageUz: string;
  messageRu: string | null;
  mediaType?: 'text' | 'photo' | 'video';
  mediaUrl?: string | null;
  filters: BroadcastFilters;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdById: string;
  createdAt: string;
  finishedAt: string | null;
}
