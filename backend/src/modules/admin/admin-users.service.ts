import { Injectable, NotFoundException } from "@nestjs/common";
import { EventType, Prisma } from "@prisma/client";
import { PrismaService } from "@/prisma/prisma.service";
import { buildCursorPage, type CursorPage } from "@/common/helpers/pagination";

export interface ListUsersParams {
  q?: string;
  isBlocked?: boolean;
  cursor?: string;
  limit?: number;
  /** Joriy admin do'koni — blok holatini shu do'kon bo'yicha hisoblaymiz. */
  tenantId?: string | null;
}

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: ListUsersParams): Promise<CursorPage<unknown>> {
    const limit = Math.min(Math.max(params.limit ?? 30, 1), 100);
    const take = limit + 1;
    const tenantId = params.tenantId ?? null;

    // Blok holati: tenant admin uchun per-do'kon (TenantBlockedUser),
    // platforma admini (tenantId yo'q) uchun global User.isBlocked.
    let blockFilter: Prisma.UserWhereInput = {};
    if (params.isBlocked !== undefined) {
      if (tenantId) {
        blockFilter = params.isBlocked
          ? { tenantBlocks: { some: { tenantId } } }
          : { tenantBlocks: { none: { tenantId } } };
      } else {
        blockFilter = { isBlocked: params.isBlocked };
      }
    }

    const where: Prisma.UserWhereInput = {
      ...blockFilter,
      // Sotuvchi faqat O'Z do'koniga buyurtma bergan mijozlarni ko'radi.
      // (User global model — tenant filtri orders orqali qo'yiladi.)
      ...(tenantId ? { orders: { some: { tenantId } } } : {}),
      ...(params.q
        ? {
            OR: [
              { username: { contains: params.q, mode: "insensitive" } },
              { firstName: { contains: params.q, mode: "insensitive" } },
              { lastName: { contains: params.q, mode: "insensitive" } },
              { phone: { contains: params.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const rows = await this.prisma.user.findMany({
      where,
      orderBy: [{ lastSeenAt: "desc" }, { id: "desc" }],
      take,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      include: {
        _count: { select: { orders: true } },
        ...(tenantId
          ? { tenantBlocks: { where: { tenantId }, select: { id: true } } }
          : {}),
      },
    });
    const items = rows.map((u) => ({
      id: u.id,
      telegramId: u.telegramId.toString(),
      username: u.username,
      firstName: u.firstName,
      lastName: u.lastName,
      photoUrl: u.photoUrl,
      phone: u.phone,
      language: u.language,
      // Tenant admin uchun shu do'kondagi blok holati
      isBlocked: tenantId
        ? ((u as { tenantBlocks?: unknown[] }).tenantBlocks?.length ?? 0) > 0
        : u.isBlocked,
      ordersCount: u._count.orders,
      lastSeenAt: u.lastSeenAt,
      createdAt: u.createdAt,
    }));
    return buildCursorPage(items, limit);
  }

  async getById(id: string, tenantId?: string | null) {
    // Sotuvchi faqat o'z mijozini ko'ra oladi — boshqa do'kon mijozi bo'lsa 404.
    if (tenantId) {
      const isCustomer = await this.prisma.numberOrder.findFirst({
        where: { userId: id, tenantId },
        select: { id: true },
      });
      if (!isCustomer) throw new NotFoundException("User not found");
    }

    const u = await this.prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: { orders: true, events: true },
        },
      },
    });
    if (!u) throw new NotFoundException("User not found");

    // Tenant admin uchun blok holati shu do'kon bo'yicha
    let isBlocked = u.isBlocked;
    if (tenantId) {
      const blk = await this.prisma.tenantBlockedUser.findUnique({
        where: { tenantId_userId: { tenantId, userId: id } },
        select: { id: true },
      });
      isBlocked = !!blk;
    }

    // Statistika faqat shu do'kon buyurtmalari bo'yicha (cross-tenant leak'ning oldini olish)
    const totals = await this.prisma.numberOrder.aggregate({
      where: { userId: id, status: { not: "CANCELLED" }, ...(tenantId ? { tenantId } : {}) },
      _sum: { retailPrice: true },
      _count: true,
      _avg: { retailPrice: true },
    });

    return {
      ...u,
      telegramId: u.telegramId.toString(),
      isBlocked,
      stats: {
        ordersCount: totals._count,
        revenue: totals._sum.retailPrice ? Number(totals._sum.retailPrice) : 0,
        avgOrderValue: totals._avg.retailPrice ? Number(totals._avg.retailPrice) : 0,
        eventsCount: u._count.events,
      },
    };
  }

  /**
   * Mijozni bloklash/blokdan chiqarish.
   * Tenant admin uchun — per-do'kon (TenantBlockedUser). Mijoz faqat
   * shu do'kondan chiqariladi, boshqa do'konlardan foydalana oladi.
   * Platforma admini (tenantId yo'q) uchun — global User.isBlocked.
   */
  async block(id: string, isBlocked: boolean, tenantId?: string | null) {
    if (!tenantId) {
      await this.prisma.user.update({ where: { id }, data: { isBlocked } });
      return { ok: true, isBlocked };
    }
    if (isBlocked) {
      await this.prisma.tenantBlockedUser.upsert({
        where: { tenantId_userId: { tenantId, userId: id } },
        update: {},
        create: { tenantId, userId: id },
      });
    } else {
      await this.prisma.tenantBlockedUser.deleteMany({
        where: { tenantId, userId: id },
      });
      // Eski (legacy) global blok bayrog'ini ham tozalaymiz — aks holda
      // o'tgan tizimda global bloklangan mijozni sotuvchi chiqara olmaydi.
      await this.prisma.user.updateMany({
        where: { id, isBlocked: true },
        data: { isBlocked: false },
      });
    }
    return { ok: true, isBlocked };
  }

  async timeline(
    userId: string,
    params: {
      type?: EventType;
      from?: string;
      to?: string;
      cursor?: string;
      limit?: number;
    },
    tenantId?: string | null,
  ): Promise<CursorPage<unknown>> {
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
    const take = limit + 1;
    // Sotuvchi faqat o'z mijozining shu do'konga oid faolligini ko'radi.
    // UserEvent'da endi tenantId bor — to'g'ridan-to'g'ri shu do'kon bo'yicha filtrlaymiz.
    if (tenantId) {
      const isCustomer = await this.prisma.numberOrder.findFirst({
        where: { userId, tenantId },
        select: { id: true },
      });
      if (!isCustomer) throw new NotFoundException("User not found");
    }
    const where: Prisma.UserEventWhereInput = {
      userId,
      ...(tenantId ? { tenantId } : {}),
      ...(params.type ? { type: params.type } : {}),
      ...(params.from || params.to
        ? {
            createdAt: {
              ...(params.from ? { gte: new Date(params.from) } : {}),
              ...(params.to ? { lte: new Date(params.to) } : {}),
            },
          }
        : {}),
    };
    const rows = await this.prisma.userEvent.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });
    const items = rows.map((e) => ({
      id: e.id,
      type: e.type,
      serviceId: e.serviceId,
      countryId: e.countryId,
      payload: e.payload,
      createdAt: e.createdAt,
    }));
    return buildCursorPage(items, limit);
  }

  async interests(userId: string, tenantId?: string | null) {
    // Sotuvchi faqat o'z mijozining qiziqishlarini ko'radi (shu do'kon buyurtmalari bo'yicha)
    if (tenantId) {
      const isCustomer = await this.prisma.numberOrder.findFirst({
        where: { userId, tenantId },
        select: { id: true },
      });
      if (!isCustomer) throw new NotFoundException("User not found");
    }
    const orderWhere: Prisma.NumberOrderWhereInput = { userId, ...(tenantId ? { tenantId } : {}) };

    // Mijoz eng ko'p buyurtma bergan xizmatlar va davlatlar (raqam-domeni "qiziqishlari")
    const [byService, byCountry] = await Promise.all([
      this.prisma.numberOrder.groupBy({
        by: ["serviceId"],
        where: orderWhere,
        _count: { _all: true },
        orderBy: { _count: { serviceId: "desc" } },
        take: 10,
      }),
      this.prisma.numberOrder.groupBy({
        by: ["countryId"],
        where: orderWhere,
        _count: { _all: true },
        orderBy: { _count: { countryId: "desc" } },
        take: 10,
      }),
    ]);

    const serviceIds = byService.map((s) => s.serviceId);
    const countryIds = byCountry.map((c) => c.countryId);
    const [services, countries] = await Promise.all([
      this.prisma.service.findMany({
        where: { id: { in: serviceIds } },
        select: { id: true, nameUz: true, nameRu: true, emoji: true },
      }),
      this.prisma.country.findMany({
        where: { id: { in: countryIds } },
        select: { id: true, nameUz: true, nameRu: true, flag: true },
      }),
    ]);
    const svcMap = new Map(services.map((s) => [s.id, s]));
    const cntMap = new Map(countries.map((c) => [c.id, c]));

    return {
      topServices: byService.map((s) => ({
        id: s.serviceId,
        nameUz: svcMap.get(s.serviceId)?.nameUz ?? "—",
        nameRu: svcMap.get(s.serviceId)?.nameRu ?? "—",
        emoji: svcMap.get(s.serviceId)?.emoji ?? null,
        orders: s._count._all,
      })),
      topCountries: byCountry.map((c) => ({
        id: c.countryId,
        nameUz: cntMap.get(c.countryId)?.nameUz ?? "—",
        nameRu: cntMap.get(c.countryId)?.nameRu ?? "—",
        flag: cntMap.get(c.countryId)?.flag ?? null,
        orders: c._count._all,
      })),
    };
  }

  async orders(
    userId: string,
    params: { cursor?: string; limit?: number },
    tenantId?: string | null,
  ): Promise<CursorPage<unknown>> {
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
    const take = limit + 1;
    const rows = await this.prisma.numberOrder.findMany({
      // Sotuvchi faqat o'z do'koniga berilgan buyurtmalarni ko'radi
      where: { userId, ...(tenantId ? { tenantId } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      include: {
        service: { select: { nameUz: true, emoji: true } },
        country: { select: { nameUz: true, flag: true } },
      },
    });
    const items = rows.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      total: Number(o.retailPrice),
      phone: o.phone,
      service: o.service ? { name: o.service.nameUz, emoji: o.service.emoji } : null,
      country: o.country ? { name: o.country.nameUz, flag: o.country.flag } : null,
      createdAt: o.createdAt,
    }));
    return buildCursorPage(items, limit);
  }
}
