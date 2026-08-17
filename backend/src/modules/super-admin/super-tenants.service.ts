import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { TariffPlan, Tenant, TenantStatus, Prisma } from '@prisma/client';
import { ReferralService } from '../referral/referral.service';

export interface TenantListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  plan?: TariffPlan;
  status?: TenantStatus;
  sort?: 'created' | 'revenue' | 'activity' | 'products';
  order?: 'asc' | 'desc';
}

@Injectable()
export class SuperTenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly referral: ReferralService,
  ) {}

  private orderBy(sort?: string, order: 'asc' | 'desc' = 'desc'): Prisma.TenantOrderByWithRelationInput {
    switch (sort) {
      case 'revenue':
        return { totalRevenue: order };
      case 'activity':
        return { lastActivityAt: order };
      case 'products':
        return { totalOrders: order };
      case 'created':
      default:
        return { createdAt: order };
    }
  }

  async list(params: TenantListParams = {}) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, params.pageSize ?? 25);

    const where: Prisma.TenantWhereInput = {};
    if (params.plan) where.tariffPlan = params.plan;
    if (params.status) where.status = params.status;
    if (params.search?.trim()) {
      const q = params.search.trim();
      where.OR = [
        { shopName: { contains: q, mode: 'insensitive' } },
        { ownerName: { contains: q, mode: 'insensitive' } },
        { ownerEmail: { contains: q, mode: 'insensitive' } },
        { ownerPhone: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.tenant.count({ where }),
      this.prisma.tenant.findMany({
        where,
        orderBy: this.orderBy(params.sort, params.order),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const enriched = await this.enrichTenants(items);

    return {
      items: enriched,
      total,
      page,
      pageSize,
    };
  }

  private async enrichTenants(tenants: Tenant[]) {
    if (tenants.length === 0) return [];
    const ids = tenants.map((t) => t.id);

    // Har do'kon uchun raqam-buyurtmalar soni (eski Product soni o'rniga).
    const orderGroups = await this.prisma.numberOrder.groupBy({
      by: ['tenantId'],
      where: { tenantId: { in: ids } },
      _count: { _all: true },
    });

    const orderMap = new Map(
      orderGroups.map((g) => [g.tenantId, g._count._all]),
    );

    return tenants.map((t) => ({
      ...t,
      totalRevenue: t.totalRevenue.toString(),
      ordersCount: orderMap.get(t.id) ?? t.totalOrders,
    }));
  }

  async getById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const [enriched] = await this.enrichTenants([tenant]);
    return enriched;
  }

  /** Do'kon TAFSILOTI — detail sahifasi tab'lari uchun (buyurtma, to'lov, hamyon...). */
  async getDetail(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const svc = { select: { nameUz: true, slug: true, emoji: true } };
    const ctr = { select: { nameUz: true, iso2: true } };

    const [orders, invoices, walletTx, offers, events, subscription, admins, customerRows] =
      await Promise.all([
        this.prisma.numberOrder.findMany({
          where: { tenantId: id },
          include: { service: svc, country: ctr },
          orderBy: { createdAt: 'desc' },
          take: 30,
        }),
        this.prisma.invoice.findMany({
          where: { tenantId: id },
          orderBy: { createdAt: 'desc' },
          take: 30,
        }),
        this.prisma.walletTransaction.findMany({
          where: { tenantId: id },
          orderBy: { createdAt: 'desc' },
          take: 30,
        }),
        this.prisma.resellerOffer.findMany({
          where: { tenantId: id },
          include: { service: svc, country: ctr },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.userEvent.findMany({
          where: { tenantId: id },
          orderBy: { createdAt: 'desc' },
          take: 40,
        }),
        this.prisma.subscription.findFirst({
          where: { tenantId: id },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.admin.findMany({
          where: { tenantId: id },
          select: { id: true, fullName: true, email: true, role: true },
        }),
        this.prisma.userEvent.findMany({
          where: { tenantId: id },
          distinct: ['userId'],
          select: { userId: true },
        }),
      ]);

    return {
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        service: o.service.nameUz,
        serviceSlug: o.service.slug,
        country: o.country.nameUz,
        countryIso2: o.country.iso2,
        phone: o.phone,
        status: o.status,
        code: o.code,
        retailPrice: o.retailPrice,
        profit: o.profit,
        createdAt: o.createdAt,
      })),
      invoices: invoices.map((i) => {
        const meta =
          i.metadata && typeof i.metadata === 'object'
            ? (i.metadata as Record<string, unknown>)
            : {};
        return {
          id: i.id,
          invoiceNumber: i.invoiceNumber,
          amount: i.amount,
          status: i.status,
          kind: i.kind,
          description: i.description,
          paidAt: i.paidAt,
          createdAt: i.createdAt,
          receiptUrl: typeof meta.receiptUrl === 'string' ? meta.receiptUrl : null,
        };
      }),
      walletTransactions: walletTx.map((w) => ({
        id: w.id,
        type: w.type,
        amount: w.amount,
        balanceAfter: w.balanceAfter,
        note: w.note,
        createdAt: w.createdAt,
        receiptUrl: w.receiptUrl,
      })),
      offers: offers.map((o) => ({
        id: o.id,
        service: o.service.nameUz,
        serviceSlug: o.service.slug,
        country: o.country.nameUz,
        countryIso2: o.country.iso2,
        retailPrice: o.retailPrice,
        isActive: o.isActive,
      })),
      events: events.map((e) => ({
        id: e.id,
        type: e.type,
        createdAt: e.createdAt,
      })),
      subscription: subscription
        ? {
            plan: subscription.plan,
            amount: subscription.amount,
            status: subscription.status,
            startsAt: subscription.startsAt,
            endsAt: subscription.endsAt,
          }
        : null,
      admins,
      customersCount: customerRows.length,
      activation: {
        isActivated: tenant.isActivated,
        activationPaidAt: tenant.activationPaidAt,
        activationAmount: tenant.activationAmount,
        tariffPlan: tenant.tariffPlan,
        createdAt: tenant.createdAt,
      },
      settings: {
        cardNumber: tenant.manualCardNumber,
        cardHolder: tenant.manualCardHolder,
        paymentChannelId: tenant.manualPaymentChannelId,
        payme: !!tenant.paymeMerchantId,
        click: !!(tenant.clickServiceId && tenant.clickMerchantId),
        botUsername: tenant.botUsername,
        about: tenant.about,
        phone: tenant.ownerPhone,
        workingHours: tenant.workingHours,
        primaryColor: tenant.primaryColor,
        logoUrl: tenant.logoUrl,
      },
    };
  }

  async suspend(id: string, reason: string): Promise<Tenant> {
    return this.prisma.tenant.update({
      where: { id },
      data: {
        status: 'SUSPENDED',
        suspendedReason: reason,
        suspendedAt: new Date(),
      },
    });
  }

  async resume(id: string): Promise<Tenant> {
    return this.prisma.tenant.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        suspendedReason: null,
        suspendedAt: null,
      },
    });
  }

  async changeTariff(id: string, plan: TariffPlan): Promise<Tenant> {
    const updated = await this.prisma.tenant.update({
      where: { id },
      data: {
        tariffPlan: plan,
      },
    });
    // Pulli tarif qo'lda faollashtirilsa ham — referal komissiya hisoblanadi
    if (plan !== 'FREE') {
      try {
        const price = await this.referral.planPrice(plan);
        await this.referral.creditCommission(id, plan, price);
      } catch {
        // komissiya xatosi tarif o'zgartirishni buzmasligi kerak
      }
    }
    return updated;
  }

  async extendTrial(id: string, days: number): Promise<Tenant> {
    // Trial tizimi olib tashlandi (endi bir martalik faollashtirish modeli).
    // Endpoint muvofiqligini saqlash uchun no-op: tenant o'zgarmasdan qaytariladi.
    void days;
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async create(data: {
    slug: string;
    shopName: string;
    ownerName: string;
    ownerEmail?: string;
    ownerPhone?: string;
    ownerTelegramId?: string;
    tariffPlan?: TariffPlan;
  }): Promise<Tenant> {
    const slug = data.slug.toLowerCase().trim();
    const email = data.ownerEmail?.toLowerCase().trim() || null;
    const telegramId = data.ownerTelegramId?.trim()
      ? BigInt(data.ownerTelegramId.trim())
      : null;

    // Slug har doim, email/Telegram ID berilgan bo'lsa ular bo'yicha ham dublikat tekshiriladi.
    const dupOr: Prisma.TenantWhereInput[] = [{ slug }];
    if (email) dupOr.push({ ownerEmail: email });
    if (telegramId !== null) dupOr.push({ ownerTelegramId: telegramId });
    const exists = await this.prisma.tenant.findFirst({ where: { OR: dupOr } });
    if (exists) {
      throw new ConflictException(
        'Slug, email yoki Telegram ID allaqachon ishlatilgan',
      );
    }

    return this.prisma.tenant.create({
      data: {
        slug,
        shopName: data.shopName.trim(),
        ownerName: data.ownerName.trim(),
        ownerEmail: email,
        ownerPhone: data.ownerPhone?.trim() ?? null,
        ownerTelegramId: telegramId,
        tariffPlan: data.tariffPlan ?? 'FREE',
        status: 'ACTIVE',
      },
    });
  }

  /**
   * Do'kon va unга tegishli BARCHA ma'lumotni xavfsiz tartibda o'chiradi.
   * NumberOrder → Tenant FK = RESTRICT, shuning uchun tenant'dan oldin o'chiriladi
   * (NumberOrderEvent/PaymentTransaction cascade, WalletTransaction.orderId → null).
   * UserEvent/Banner/PromoCode'da Tenant'ga FK yo'q (faqat tenantId ustun).
   * Invoice FK = RESTRICT — tenant'dan oldin o'chirilishi shart.
   * DigitalOrder (Stars/Premium) FK = RESTRICT — tenant'dan oldin o'chiriladi.
   * Tenant o'chgach: Admin/ResellerOffer/Subscription/WalletTransaction/
   * ResourceStat/ChannelPost/TenantBlockedUser cascade orqali o'chadi.
   */
  private async purgeTenant(id: string): Promise<void> {
    await this.prisma.$transaction([
      // Raqam-buyurtmalar → NumberOrderEvent/PaymentTransaction cascade
      this.prisma.numberOrder.deleteMany({ where: { tenantId: id } }),
      // Foydalanuvchi hodisalari (tenantId ustuni — FK yo'q)
      this.prisma.userEvent.deleteMany({ where: { tenantId: id } }),
      this.prisma.banner.deleteMany({ where: { tenantId: id } }),
      this.prisma.promoCode.deleteMany({ where: { tenantId: id } }), // → PromoCodeUsage cascade
      this.prisma.paymentTransaction.deleteMany({ where: { tenantId: id } }),
      this.prisma.invoice.deleteMany({ where: { tenantId: id } }), // FK RESTRICT
      this.prisma.digitalOrder.deleteMany({ where: { tenantId: id } }), // FK RESTRICT (Stars/Premium)
      // Va nihoyat do'konning o'zi (qolgan relations cascade)
      this.prisma.tenant.delete({ where: { id } }),
    ]);
  }

  async delete(id: string): Promise<{ ok: true }> {
    const t = await this.prisma.tenant.findUnique({ where: { id }, select: { id: true } });
    if (!t) throw new NotFoundException('Tenant not found');
    await this.purgeTenant(id);
    return { ok: true };
  }

  async bulkUpdate(
    ids: string[],
    action: 'suspend' | 'resume' | 'delete',
    reason?: string,
  ): Promise<{ updated: number }> {
    if (action === 'delete') {
      let updated = 0;
      for (const id of ids) {
        try {
          await this.purgeTenant(id);
          updated += 1;
        } catch {
          // bittasi xato bo'lsa qolganlarini davom ettiramiz
        }
      }
      return { updated };
    }
    const result = await this.prisma.tenant.updateMany({
      where: { id: { in: ids } },
      data:
        action === 'suspend'
          ? { status: 'SUSPENDED', suspendedReason: reason ?? 'Bulk action', suspendedAt: new Date() }
          : { status: 'ACTIVE', suspendedReason: null, suspendedAt: null },
    });
    return { updated: result.count };
  }

  async exportAll(): Promise<Tenant[]> {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
}
