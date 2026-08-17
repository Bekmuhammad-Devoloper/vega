import { api } from './api';
import type {
  ActivityEvent,
  AuditListResponse,
  BillingSummary,
  InvoiceDto,
  InvoiceListResponse,
  InvoiceStatus,
  LoginResponse,
  PlatformAdminDto,
  PlatformKpi,
  PlatformRole,
  RevenuePoint,
  SubscriptionListResponse,
  SubscriptionStatus,
  SubscriptionsSummary,
  TariffConfigDto,
  TariffDistribution,
  TariffPlan,
  TenantDto,
  TenantListResponse,
  TenantStatus,
} from './types';

// ─── Auth ─────────────────────────────────────────────────
export function apiLogin(email: string, password: string): Promise<LoginResponse> {
  return api('/super-admin/auth/login', { method: 'POST', body: { email, password } });
}
export function apiVerify2FA(tempToken: string, code: string): Promise<LoginResponse> {
  return api('/super-admin/auth/verify-2fa', { method: 'POST', body: { tempToken, code } });
}
export function apiFetchMe(): Promise<PlatformAdminDto> {
  return api('/super-admin/auth/me');
}
export function apiLogout(): Promise<void> {
  return api('/super-admin/auth/logout', { method: 'POST' });
}

// ─── Dashboard ────────────────────────────────────────────
export interface PlatformBalances {
  platform: number;
  providers: Array<{
    kind: string;
    label: string;
    configured: boolean;
    balanceUsd: number | null;
  }>;
}
export function apiFetchBalances(): Promise<PlatformBalances> {
  return api('/super-admin/dashboard/balances');
}
export function apiFetchKpi(): Promise<PlatformKpi> {
  return api('/super-admin/dashboard/kpi');
}
export function apiFetchRevenueChart(days = 30): Promise<RevenuePoint[]> {
  return api('/super-admin/dashboard/revenue', { query: { days } });
}
export function apiFetchTariffDistribution(): Promise<TariffDistribution[]> {
  return api('/super-admin/dashboard/tariff-distribution');
}
export function apiFetchActivity(limit = 20): Promise<ActivityEvent[]> {
  return api('/super-admin/dashboard/activity', { query: { limit } });
}

// ─── Tenants ──────────────────────────────────────────────
export interface TenantListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  plan?: TariffPlan;
  status?: TenantStatus;
  sort?: 'created' | 'revenue' | 'activity' | 'products';
  order?: 'asc' | 'desc';
}

export function apiFetchTenants(params: TenantListParams = {}): Promise<TenantListResponse> {
  return api('/super-admin/tenants', { query: params as Record<string, unknown> });
}
export function apiFetchTenant(id: string): Promise<TenantDto> {
  return api(`/super-admin/tenants/${id}`);
}

// ─── Do'kon tafsiloti (detail tab'lari) ───
type Money = string | number;
export interface TenantDetail {
  orders: Array<{
    id: string;
    orderNumber: string;
    service: string;
    serviceSlug: string;
    country: string;
    countryIso2: string;
    phone: string;
    status: string;
    code: string | null;
    retailPrice: Money;
    profit: Money;
    createdAt: string;
  }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    amount: Money;
    status: string;
    kind: string;
    description: string | null;
    paidAt: string | null;
    createdAt: string;
    receiptUrl: string | null;
  }>;
  walletTransactions: Array<{
    id: string;
    type: string;
    amount: Money;
    balanceAfter: Money;
    note: string | null;
    createdAt: string;
    receiptUrl: string | null;
  }>;
  offers: Array<{
    id: string;
    service: string;
    serviceSlug: string;
    country: string;
    countryIso2: string;
    retailPrice: Money;
    isActive: boolean;
  }>;
  events: Array<{ id: string; type: string; createdAt: string }>;
  subscription: {
    plan: string;
    amount: Money;
    status: string;
    startsAt: string;
    endsAt: string | null;
  } | null;
  admins: Array<{ id: string; fullName: string; email: string; role: string }>;
  customersCount: number;
  activation: {
    isActivated: boolean;
    activationPaidAt: string | null;
    activationAmount: string | null;
    tariffPlan: string;
    createdAt: string;
  };
  settings: {
    cardNumber: string | null;
    cardHolder: string | null;
    paymentChannelId: string | null;
    payme: boolean;
    click: boolean;
    botUsername: string | null;
    about: string | null;
    phone: string | null;
    workingHours: string | null;
    primaryColor: string | null;
    logoUrl: string | null;
  };
}
export function apiFetchTenantDetail(id: string): Promise<TenantDetail> {
  return api(`/super-admin/tenants/${id}/detail`);
}
export function apiSuspendTenant(id: string, reason: string): Promise<TenantDto> {
  return api(`/super-admin/tenants/${id}/suspend`, { method: 'POST', body: { reason } });
}
export function apiResumeTenant(id: string): Promise<TenantDto> {
  return api(`/super-admin/tenants/${id}/resume`, { method: 'POST' });
}
export function apiChangeTariff(id: string, plan: TariffPlan): Promise<TenantDto> {
  return api(`/super-admin/tenants/${id}/tariff`, { method: 'POST', body: { plan } });
}
export interface CreateTenantBody {
  slug: string;
  shopName: string;
  ownerName: string;
  ownerEmail?: string;
  ownerTelegramId?: string;
  ownerPhone?: string;
  tariffPlan?: TariffPlan;
}

export function apiCreateTenant(data: CreateTenantBody): Promise<TenantDto> {
  return api('/super-admin/tenants', { method: 'POST', body: data });
}

export function apiDeleteTenant(id: string): Promise<{ ok: true }> {
  return api(`/super-admin/tenants/${id}`, { method: 'DELETE' });
}

export function apiBulkTenants(
  ids: string[],
  action: 'suspend' | 'resume' | 'delete',
  reason?: string,
): Promise<{ updated: number }> {
  return api('/super-admin/tenants/bulk', {
    method: 'POST',
    body: { ids, action, reason },
  });
}

export function apiExportTenants(): Promise<TenantDto[]> {
  return api('/super-admin/tenants/export');
}

// ─── Team ─────────────────────────────────────────────────
export function apiFetchTeam(): Promise<PlatformAdminDto[]> {
  return api('/super-admin/team');
}
export function apiCreateAdmin(data: {
  email: string;
  password: string;
  fullName: string;
  role: PlatformRole;
}): Promise<PlatformAdminDto> {
  return api('/super-admin/team', { method: 'POST', body: data });
}
export function apiUpdateAdmin(
  id: string,
  data: { fullName?: string; role?: PlatformRole; isActive?: boolean },
): Promise<PlatformAdminDto> {
  return api(`/super-admin/team/${id}`, { method: 'PATCH', body: data });
}
export function apiResetAdminPassword(id: string, newPassword: string): Promise<void> {
  return api(`/super-admin/team/${id}/reset-password`, {
    method: 'POST',
    body: { newPassword },
  });
}
export function apiDeactivateAdmin(id: string): Promise<PlatformAdminDto> {
  return api(`/super-admin/team/${id}`, { method: 'DELETE' });
}
export function apiActivateAdmin(id: string): Promise<PlatformAdminDto> {
  return api(`/super-admin/team/${id}/activate`, { method: 'POST' });
}

// ─── Audit ────────────────────────────────────────────────
export interface AuditListParams {
  page?: number;
  pageSize?: number;
  adminId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  since?: string;
  until?: string;
}

export function apiFetchAudit(params: AuditListParams = {}): Promise<AuditListResponse> {
  return api('/super-admin/audit', { query: params as Record<string, unknown> });
}
export function apiFetchAuditActions(): Promise<Array<{ action: string; count: number }>> {
  return api('/super-admin/audit/actions');
}

// ─── Tariffs ──────────────────────────────────────────────
export function apiFetchTariffs(): Promise<TariffConfigDto[]> {
  return api('/super-admin/tariffs');
}
export function apiFetchTariff(plan: TariffPlan): Promise<TariffConfigDto> {
  return api(`/super-admin/tariffs/${plan}`);
}
export function apiUpdateTariff(
  plan: TariffPlan,
  data: Partial<TariffConfigDto>,
): Promise<TariffConfigDto> {
  return api(`/super-admin/tariffs/${plan}`, { method: 'PATCH', body: data });
}

// ─── Subscriptions ────────────────────────────────────────
export interface SubscriptionListParams {
  page?: number;
  pageSize?: number;
  status?: SubscriptionStatus;
  plan?: TariffPlan;
  search?: string;
  expiringWithin?: number;
}

export function apiFetchSubscriptions(
  params: SubscriptionListParams = {},
): Promise<SubscriptionListResponse> {
  return api('/super-admin/subscriptions', { query: params as Record<string, unknown> });
}
export function apiFetchSubscriptionsSummary(): Promise<SubscriptionsSummary> {
  return api('/super-admin/subscriptions/summary');
}

// ─── Billing ──────────────────────────────────────────────
export interface InvoiceListParams {
  page?: number;
  pageSize?: number;
  status?: InvoiceStatus;
  search?: string;
  provider?: string;
  since?: string;
  until?: string;
}

export function apiFetchInvoices(params: InvoiceListParams = {}): Promise<InvoiceListResponse> {
  return api('/super-admin/billing/invoices', { query: params as Record<string, unknown> });
}
export function apiFetchBillingSummary(): Promise<BillingSummary> {
  return api('/super-admin/billing/summary');
}

// ─── Hamyon to'ldirishlar (reseller cheklari — tasdiqlash/rad) ──
export interface PendingTopup {
  id: string;
  invoiceNumber: string;
  amount: string | number;
  createdAt: string;
  metadata?: {
    receiptUrl?: string;
    method?: string;
    grossAmount?: number;
    feePercent?: number;
    tonAmount?: number;
    requestedByUserId?: string;
  } | null;
  tenant: {
    id: string;
    slug: string;
    shopName: string;
    walletBalance: string | number;
  };
}
export function apiPendingTopups(): Promise<PendingTopup[]> {
  return api('/super-admin/wallet/topups');
}
export function apiApproveTopup(id: string): Promise<unknown> {
  return api(`/super-admin/wallet/topups/${id}/approve`, { method: 'POST' });
}
export function apiRejectTopup(id: string, reason?: string): Promise<unknown> {
  return api(`/super-admin/wallet/topups/${id}/reject`, {
    method: 'POST',
    body: reason ? { reason } : {},
  });
}

// ─── Platforma (egasi) balansi ─────────────────────────────
export interface PlatformWalletTx {
  id: string;
  type: string;
  amount: string | number;
  balanceAfter: string | number;
  note?: string | null;
  createdAt: string;
}
export function apiPlatformWallet(): Promise<{
  balance: number;
  transactions: PlatformWalletTx[];
}> {
  return api('/super-admin/wallet/platform');
}
export function apiPlatformTopup(amount: number, note?: string): Promise<number> {
  return api('/super-admin/wallet/platform/topup', {
    method: 'POST',
    body: note ? { amount, note } : { amount },
  });
}
export function apiFetchInvoice(id: string): Promise<InvoiceDto> {
  return api(`/super-admin/billing/invoices/${id}`);
}
export function apiCreateInvoice(data: {
  tenantId: string;
  amount: number;
  description: string;
  dueDate: string;
}): Promise<InvoiceDto> {
  return api('/super-admin/billing/invoices', { method: 'POST', body: data });
}
export function apiRefundInvoice(id: string, reason: string): Promise<InvoiceDto> {
  return api(`/super-admin/billing/invoices/${id}/refund`, {
    method: 'PATCH',
    body: { reason },
  });
}

// ─── Settings ─────────────────────────────────────────────
import type {
  BroadcastListResponse,
  CohortBucket,
  DbStats,
  DigitalKind,
  DigitalOrderDto,
  DigitalProductDto,
  FunnelStep,
  GeoPoint,
  JobsStats,
  PlatformSetting,
  ServerHealth,
  SupportTicketDto,
  SupportTicketListResponse,
} from './types';

export function apiFetchSettings(category?: string): Promise<PlatformSetting[]> {
  return api('/super-admin/settings', { query: category ? { category } : undefined });
}
export function apiFetchSettingCategories(): Promise<Array<{ category: string; count: number }>> {
  return api('/super-admin/settings/categories');
}
export function apiUpsertSetting(
  key: string,
  data: { category: string; value: unknown },
): Promise<PlatformSetting> {
  return api(`/super-admin/settings/${key}`, { method: 'PUT', body: data });
}
export function apiDeleteSetting(key: string): Promise<void> {
  return api(`/super-admin/settings/${key}`, { method: 'DELETE' });
}

// ─── Analytics ────────────────────────────────────────────
export function apiFetchFunnel(): Promise<FunnelStep[]> {
  return api('/super-admin/analytics/funnel');
}
export function apiFetchCohort(months = 6): Promise<CohortBucket[]> {
  return api('/super-admin/analytics/cohort', { query: { months } });
}
export function apiFetchGeo(): Promise<GeoPoint[]> {
  return api('/super-admin/analytics/geo');
}
export function apiFetchStatusDistribution(): Promise<Array<{ status: string; count: number }>> {
  return api('/super-admin/analytics/status-distribution');
}

// ─── Infrastructure ───────────────────────────────────────
export function apiFetchHealth(): Promise<ServerHealth> {
  return api('/super-admin/infrastructure/health');
}
export function apiFetchDbStats(): Promise<DbStats> {
  return api('/super-admin/infrastructure/database');
}
export function apiFetchJobs(): Promise<JobsStats> {
  return api('/super-admin/infrastructure/jobs');
}

// ─── Support ──────────────────────────────────────────────
export function apiFetchSupportSummary(): Promise<{
  open: number;
  resolved: number;
  today: number;
}> {
  return api('/super-admin/support/summary');
}
export function apiFetchTickets(params: {
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
}): Promise<SupportTicketListResponse> {
  return api('/super-admin/support/tickets', { query: params as Record<string, unknown> });
}
export function apiFetchTicket(id: string): Promise<SupportTicketDto> {
  return api(`/super-admin/support/tickets/${id}`);
}

// ─── Broadcasts ───────────────────────────────────────────
export function apiFetchBroadcastsSummary(): Promise<{
  total: number;
  completed: number;
  running: number;
  totalRecipients: number;
}> {
  return api('/super-admin/broadcasts/summary');
}
export function apiFetchBroadcasts(params: {
  page?: number;
  pageSize?: number;
  status?: string;
}): Promise<BroadcastListResponse> {
  return api('/super-admin/broadcasts', { query: params as Record<string, unknown> });
}

// ─── Dev tools ────────────────────────────────────────────
export function apiFetchDevRoutes(): Promise<Array<{ method: string; path: string; description: string }>> {
  return api('/super-admin/dev/routes');
}
export function apiFetchDevStats(): Promise<{
  nodeVersion: string;
  dbVersion: string;
  pid: number;
  uptime: number;
}> {
  return api('/super-admin/dev/stats');
}
export function apiRunSqlSelect(
  query: string,
): Promise<{ rows?: unknown[]; rowCount?: number; error?: string }> {
  return api('/super-admin/dev/sql/select', { method: 'POST', body: { query } });
}

// ─── Referal tizimi ──────────────────────────────────────
export interface ReferralConfigDto {
  commissionPercent: number;
  minWithdrawal: number;
}
export interface WithdrawalDto {
  id: string;
  tenantId: string;
  shopName: string;
  ownerName: string;
  ownerPhone: string | null;
  ownerUsername: string | null;
  amount: number;
  cardNumber: string;
  cardHolder: string | null;
  status: string;
  note: string | null;
  createdAt: string;
  processedAt: string | null;
}
export function apiReferralConfig(): Promise<ReferralConfigDto> {
  return api('/super-admin/referral/config');
}
export function apiSetReferralConfig(body: Partial<ReferralConfigDto>): Promise<ReferralConfigDto> {
  return api('/super-admin/referral/config', { method: 'PUT', body });
}
export function apiReferralWithdrawals(status?: string): Promise<WithdrawalDto[]> {
  return api('/super-admin/referral/withdrawals', { query: status ? { status } : undefined });
}
export function apiProcessWithdrawal(
  id: string,
  action: 'paid' | 'reject',
  note?: string,
): Promise<{ ok: boolean }> {
  return api(`/super-admin/referral/withdrawals/${id}/${action}`, { method: 'POST', body: { note } });
}

// ─── Digital (Stars / Premium) ───────────────────────────
export interface CreateDigitalProductBody {
  kind: DigitalKind;
  label: string;
  amount: number;
  wholesaleUsd: number;
  position?: number;
}
export interface UpdateDigitalProductBody {
  label?: string;
  amount?: number;
  wholesaleUsd?: number;
  isActive?: boolean;
  position?: number;
  providerServiceId?: string;
  providerQty?: number;
}

export function apiFetchDigitalProducts(): Promise<DigitalProductDto[]> {
  return api('/super-admin/digital/products');
}
export function apiCreateDigitalProduct(body: CreateDigitalProductBody): Promise<DigitalProductDto> {
  return api('/super-admin/digital/products', { method: 'POST', body });
}
export function apiUpdateDigitalProduct(
  id: string,
  body: UpdateDigitalProductBody,
): Promise<DigitalProductDto> {
  return api(`/super-admin/digital/products/${id}`, { method: 'PATCH', body });
}
export function apiFetchDigitalOrders(): Promise<DigitalOrderDto[]> {
  return api('/super-admin/digital/orders');
}
export function apiFulfillDigitalOrder(id: string, note?: string): Promise<{ ok: boolean }> {
  return api(`/super-admin/digital/orders/${id}/fulfill`, { method: 'POST', body: { note } });
}
export function apiCancelDigitalOrder(id: string, note?: string): Promise<{ ok: boolean }> {
  return api(`/super-admin/digital/orders/${id}/cancel`, { method: 'POST', body: { note } });
}
