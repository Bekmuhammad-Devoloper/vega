import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NumberOrderStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';

export interface BulkMarkupInput {
  serviceId: string;
  /** Tanlangan davlatlar; `all` true bo'lsa e'tiborsiz. */
  countryIds?: string[];
  /** Xizmatning BARCHA davlatlariga qo'llash. */
  all?: boolean;
  /** Tan narxi ustiga qo'shiladigan summa (so'm). */
  markupUzs: number;
}

export interface BulkMarkupStatus {
  running: boolean;
  total: number;
  done: number;
  priced: number;
  /** Hozir provayderda narx/zaxira yo'q — taklif yaratilmadi. */
  skipped: number;
  markupUzs: number;
  serviceId: string;
  finishedAt: string | null;
}

export interface UpsertOfferInput {
  serviceId: string;
  countryId: string;
  retailPrice: number;
  isActive?: boolean;
}

/** Bir martada narxlanadigan davlatlar chegarasi (LZT limiti + server yuki). */
const BULK_MAX = 300;

/// Reseller admin paneli — buyurtmalar ko'rinishi + taklif (retail narx) boshqaruvi.
@Injectable()
export class AdminNumbersService {
  private readonly logger = new Logger(AdminNumbersService.name);
  /** Do'kon bo'yicha ommaviy ustama jarayoni holati (bitta API instansiya). */
  private readonly bulkJobs = new Map<string, BulkMarkupStatus>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  listOrders(tenantId: string, take = 50) {
    return this.prisma.numberOrder.findMany({
      where: { tenantId },
      include: { service: true, country: true, user: true },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async stats(tenantId: string) {
    const [total, received, profitAgg] = await Promise.all([
      this.prisma.numberOrder.count({ where: { tenantId } }),
      this.prisma.numberOrder.count({
        where: { tenantId, status: NumberOrderStatus.RECEIVED },
      }),
      this.prisma.numberOrder.aggregate({
        where: { tenantId, status: NumberOrderStatus.RECEIVED },
        _sum: { profit: true },
      }),
    ]);
    return { total, received, profit: Number(profitAgg._sum.profit ?? 0) };
  }

  // ── Takliflar (reseller retail narxlari) ──
  listOffers(tenantId: string) {
    return this.prisma.resellerOffer.findMany({
      where: { tenantId },
      include: { service: true, country: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  upsertOffer(tenantId: string, dto: UpsertOfferInput) {
    return this.prisma.resellerOffer.upsert({
      where: {
        tenantId_serviceId_countryId: {
          tenantId,
          serviceId: dto.serviceId,
          countryId: dto.countryId,
        },
      },
      // Qo'lda narx kiritildi -> QAT'IY rejim (markupUzs = null). Aks holda
      // avto-narx cron'i sotuvchi qo'ygan narxni 10 daqiqada qayta yozardi.
      update: { retailPrice: dto.retailPrice, isActive: dto.isActive ?? true, markupUzs: null },
      create: {
        tenantId,
        serviceId: dto.serviceId,
        countryId: dto.countryId,
        retailPrice: dto.retailPrice,
        isActive: dto.isActive ?? true,
      },
    });
  }

  // ── Ommaviy ustama (avto-narx) ──

  bulkMarkupStatus(tenantId: string): BulkMarkupStatus {
    // Har doim obyekt — `null` javobi bo'sh tana bo'lib, klientda JSON xatosi berardi.
    return (
      this.bulkJobs.get(tenantId) ?? {
        running: false,
        total: 0,
        done: 0,
        priced: 0,
        skipped: 0,
        markupUzs: 0,
        serviceId: '',
        finishedAt: null,
      }
    );
  }

  /**
   * Tanlangan (yoki barcha) davlatlarga bir xil ustama qo'yadi:
   * sotuv narxi = JORIY tan narxi + markupUzs. Taklif avto-narx rejimiga
   * o'tadi — tan narxi o'zgarsa narx o'zi yangilanadi.
   *
   * FONDA ishlaydi: 200+ davlatni narxlash LZT limiti tufayli bir necha
   * daqiqa oladi, HTTP so'rovi esa kutib turmaydi (nginx timeout).
   * Taklif FAQAT narxi topilgandagina yaratiladi — narxsiz taklif
   * vitrinaga chiqmaydi.
   */
  async startBulkMarkup(tenantId: string, dto: BulkMarkupInput): Promise<BulkMarkupStatus> {
    const current = this.bulkJobs.get(tenantId);
    if (current?.running) {
      throw new BadRequestException("Oldingi ommaviy narxlash hali tugamadi. Biroz kuting.");
    }
    if (!Number.isInteger(dto.markupUzs) || dto.markupUzs < 0 || dto.markupUzs > 10_000_000) {
      throw new BadRequestException("Ustama 0 dan 10 000 000 so'mgacha butun son bo'lsin");
    }

    const allowed = await this.catalog.serviceCountries(dto.serviceId);
    const allowedIds = new Set(allowed.map((c) => c.id));
    const countryIds = dto.all
      ? allowed.map((c) => c.id)
      : [...new Set(dto.countryIds ?? [])].filter((id) => allowedIds.has(id));
    if (!countryIds.length) {
      throw new BadRequestException('Kamida bitta davlatni tanlang');
    }
    if (countryIds.length > BULK_MAX) {
      throw new BadRequestException(`Bir martada ko'pi bilan ${BULK_MAX} ta davlat`);
    }

    const status: BulkMarkupStatus = {
      running: true,
      total: countryIds.length,
      done: 0,
      priced: 0,
      skipped: 0,
      markupUzs: dto.markupUzs,
      serviceId: dto.serviceId,
      finishedAt: null,
    };
    this.bulkJobs.set(tenantId, status);

    void (async () => {
      try {
        for (const countryId of countryIds) {
          try {
            const q = await this.catalog.quoteFor(tenantId, dto.serviceId, countryId);
            if (!q) {
              status.skipped++;
            } else {
              const retail = CatalogService.autoRetail(q.totalUzs, dto.markupUzs);
              await this.prisma.resellerOffer.upsert({
                where: {
                  tenantId_serviceId_countryId: { tenantId, serviceId: dto.serviceId, countryId },
                },
                update: { retailPrice: retail, markupUzs: dto.markupUzs, isActive: true },
                create: {
                  tenantId,
                  serviceId: dto.serviceId,
                  countryId,
                  retailPrice: retail,
                  markupUzs: dto.markupUzs,
                  isActive: true,
                },
              });
              status.priced++;
            }
          } catch (e) {
            status.skipped++;
            this.logger.warn(`ommaviy ustama ${countryId}: ${String(e)}`);
          } finally {
            status.done++;
          }
        }
      } finally {
        status.running = false;
        status.finishedAt = new Date().toISOString();
        this.logger.log(
          `Ommaviy ustama (tenant ${tenantId}): ${status.priced} narxlandi, ${status.skipped} o'tkazildi`,
        );
      }
    })();

    return status;
  }

  async deleteOffer(tenantId: string, id: string) {
    const offer = await this.prisma.resellerOffer.findUnique({ where: { id } });
    if (!offer || offer.tenantId !== tenantId) {
      throw new NotFoundException('Taklif topilmadi');
    }
    await this.prisma.resellerOffer.delete({ where: { id } });
    return { ok: true };
  }
}
