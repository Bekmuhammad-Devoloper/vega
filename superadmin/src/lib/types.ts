export type PlatformRole = 'OWNER' | 'DEVOPS' | 'FINANCE' | 'SALES' | 'SUPPORT';

export interface PlatformAdminDto {
  id: string;
  email: string;
  fullName: string;
  role: PlatformRole;
  isActive: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  createdAt: string;
}

export type TariffPlan = 'FREE' | 'STANDARD' | 'PRO' | 'PREMIUM';
export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'PENDING_PAYMENT';
export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'PAST_DUE';
export type InvoiceStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED';

// Reseller do'kon (virtual raqam sotuvchi). Bir martalik faollashtirish modeli.
export interface TenantDto {
  id: string;
  slug: string;
  shopName: string;
  ownerName: string;
  ownerEmail: string | null;
  ownerPhone: string | null;
  ownerTelegramId: string | null;
  ownerUsername: string | null;
  // Reseller ulgurji hamyoni (raqam sotib olish uchun)
  walletBalance: string;
  tariffPlan: TariffPlan;
  // Bir martalik faollashtirish
  isActivated: boolean;
  activationPaidAt: string | null;
  activationAmount: string | null;
  status: TenantStatus;
  suspendedReason: string | null;
  suspendedAt: string | null;
  logoUrl: string | null;
  customDomain: string | null;
  isWhiteLabel: boolean;
  botUsername: string | null;
  lastActivityAt: string;
  totalRevenue: string; // reseller foydasi jami
  totalOrders: number;
  ordersCount: number; // raqam-buyurtmalar soni
  createdAt: string;
  updatedAt: string;
}

export interface TenantListResponse {
  items: TenantDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PlatformKpi {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  pendingTenants: number; // faollashtirilmagan (bir martalik to'lov kutilmoqda)
  mrr: number;
  arr: number;
  newThisMonth: number;
  churnRate: number;
  todayOrders: number; // bugungi raqam-buyurtmalar
  todayRevenue: number; // bugungi foyda (profit)
}

export interface TariffDistribution {
  plan: TariffPlan;
  count: number;
  mrr: number;
}

export interface RevenuePoint {
  date: string;
  revenue: number;
  newSubs: number;
}

export interface ActivityEvent {
  id: string;
  type:
    | 'tenant_signup'
    | 'tariff_upgrade'
    | 'payment_success'
    | 'payment_failed'
    | 'tenant_suspended'
    | 'support_ticket';
  tenantName: string | null;
  tenantId: string | null;
  description: string;
  amount?: number;
  createdAt: string;
}

export interface LoginResponse {
  accessToken: string;
  admin: PlatformAdminDto;
  requires2FA?: boolean;
  tempToken?: string;
}

// ─── Audit ────────────────────────────────────────────────
export interface AuditLogDto {
  id: string;
  adminId: string;
  admin: { id: string; fullName: string; email: string; role: PlatformRole };
  action: string;
  targetType: string | null;
  targetId: string | null;
  changes: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditListResponse {
  items: AuditLogDto[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Tariff Config ────────────────────────────────────────
// Bir martalik faollashtirish tarifi (narx + feature limitlari).
export interface TariffConfigDto {
  id: string;
  plan: TariffPlan;
  oneTimePrice: string; // BIR MARTALIK faollashtirish narxi
  maxServices: number; // reseller nechta xizmat taklif eta oladi
  maxCountries: number;
  maxAdmins: number;
  customBot: boolean;
  customDomain: boolean;
  whiteLabel: boolean;
  features: Record<string, unknown>;
  badge: string | null;
  description: string | null;
  isActive: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Subscriptions ────────────────────────────────────────
// Bir martalik faollashtirish yozuvi (endsAt — muddatsiz uchun null).
export interface SubscriptionDto {
  id: string;
  tenantId: string;
  tenant: {
    id: string;
    shopName: string;
    ownerEmail: string | null;
    status: TenantStatus;
    logoUrl: string | null;
  };
  plan: TariffPlan;
  amount: string;
  currency: string;
  startsAt: string;
  endsAt: string | null;
  status: SubscriptionStatus;
  paymentMethod: string | null;
  createdAt: string;
}

export interface SubscriptionsSummary {
  active: number;
  expiringSoon: number;
  pastDue: number;
  totalMrr: number;
}

export interface SubscriptionListResponse {
  items: SubscriptionDto[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Billing / Invoices ───────────────────────────────────
export interface InvoiceDto {
  id: string;
  invoiceNumber: string;
  tenantId: string;
  tenant: {
    id: string;
    shopName: string;
    ownerEmail: string | null;
    logoUrl: string | null;
  };
  amount: string;
  currency: string;
  status: InvoiceStatus;
  kind: string; // ACTIVATION | WALLET_TOPUP
  paymentProvider: string | null;
  providerTxId: string | null;
  paidAt: string | null;
  dueDate: string;
  description: string | null;
  createdAt: string;
}

export interface BillingSummary {
  paid: number;
  pending: number;
  failed: number;
  totalPaidMtd: number;
  totalPending: number;
}

export interface InvoiceListResponse {
  items: InvoiceDto[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Settings ─────────────────────────────────────────────
export interface PlatformSetting {
  key: string;
  value: unknown;
  category: string;
  updatedBy: string | null;
  updatedAt: string;
}

// ─── Analytics ────────────────────────────────────────────
export interface FunnelStep {
  step: string;
  label: string;
  count: number;
}

export interface CohortBucket {
  month: string;
  total: number;
  active: number;
  paying: number;
  revenue: number;
}

export interface GeoPoint {
  region: string;
  count: number;
  revenue: number;
}

// ─── Infrastructure ───────────────────────────────────────
export interface ServerHealth {
  hostname: string;
  platform: string;
  arch: string;
  nodeVersion: string;
  uptime: { os: number; process: number };
  memory: {
    totalGb: number;
    freeGb: number;
    usedGb: number;
    usedPct: number;
    processRssMb: number;
    processHeapMb: number;
  };
  cpu: {
    cores: number;
    model: string;
    speed: number;
    loadAvg: number[];
    userMs: number;
    systemMs: number;
  };
}

export interface DbStats {
  tables: Array<{ table: string; count: number }>;
  totalSize: string;
  totalBytes: number;
  sizeMb: number;
}

export interface JobsStats {
  channelPosts: { pending: number; sent: number; failed: number };
  broadcasts: Array<{
    id: string;
    status: string;
    totalCount: number;
    sentCount: number;
    failedCount: number;
    createdAt: string;
  }>;
}

// ─── Support ──────────────────────────────────────────────
export interface SupportTicketDto {
  id: string;
  userId: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    photoUrl: string | null;
  };
  responses: Array<{ id: string }>;
}

export interface SupportTicketListResponse {
  items: SupportTicketDto[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Broadcasts ───────────────────────────────────────────
export interface BroadcastDto {
  id: string;
  messageUz: string;
  messageRu: string | null;
  filters: unknown;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  status: string;
  createdById: string;
  createdAt: string;
  finishedAt: string | null;
}

export interface BroadcastListResponse {
  items: BroadcastDto[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Digital (Stars / Premium) ────────────────────────────
// Platforma egasi Stars/Premium katalogini boshqaradi va buyurtmalarni
// Fragment orqali qo'lda yetkazadi.
export type DigitalKind = 'STARS' | 'PREMIUM';

export interface DigitalProductDto {
  id: string;
  kind: DigitalKind;
  label: string; // ko'rsatiladigan nom (masalan "500 Stars" yoki "Premium 3 oy")
  amount: number; // Stars soni yoki Premium oylar soni
  wholesaleUsd: number | string; // ulgurji narx (USD)
  isActive: boolean;
  position: number;
  providerServiceId?: string | null; // SMM avto-yetkazish service id
  providerQty?: number | null;
}

export interface DigitalOrderDto {
  id: string;
  orderNumber: string;
  kind: DigitalKind;
  username: string; // sovg'a qilinadigan @username
  retailPrice: number | string; // mijoz to'lagan narx (UZS)
  wholesalePrice: number | string; // platforma tannarxi (UZS)
  digitalProduct: { label: string; amount: number };
  tenant: { slug: string; shopName: string };
  user: { username: string | null; telegramId: string | null };
  createdAt: string;
}
