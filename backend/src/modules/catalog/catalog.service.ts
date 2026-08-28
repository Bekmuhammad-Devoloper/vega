import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProviderKind, TariffPlan } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { ProvidersService } from '../providers/providers.service';

export interface UpsertPriceDto {
  serviceId: string;
  countryId: string;
  provider: ProviderKind;
  providerCostUsd: number;
  wholesaleUsd: number;
  isActive?: boolean;
}

/// Platforma katalogi — xizmatlar, davlatlar va ULGURJI narxlar.
/// Superadmin narxlarni belgilaydi; numbers moduli resolvePrice() bilan o'qiydi.
@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProvidersService,
    private readonly config: ConfigService,
  ) {}

  // ── Public (webapp/admin dropdownlari) ──
  listServices(activeOnly = true) {
    return this.prisma.service.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { position: 'asc' },
    });
  }

  listCountries(activeOnly = true) {
    return this.prisma.country.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { position: 'asc' },
    });
  }

  /**
   * Tanlangan xizmat provayderi qo'llaydigan davlatlar (offer pickeri uchun).
   * Telegram (SPIDER) -> faqat SPIDER'da bor davlatlar. Aks holda -> barcha.
   */
  async serviceCountries(serviceId: string) {
    const [service, countries] = await Promise.all([
      this.prisma.service.findUnique({ where: { id: serviceId } }),
      this.listCountries(true),
    ]);
    if (!service?.telegramOnly) return countries;
    const supported = await this.providers.spiderSupportedIso2();
    if (!supported.size) return countries; // SPIDER javob bermasa — hammasi
    return countries.filter((c) =>
      supported.has((c.iso2 ?? '').toUpperCase()),
    );
  }

  // ── Superadmin: ulgurji narxlar ──
  listPrices(serviceId?: string) {
    return this.prisma.platformPrice.findMany({
      where: serviceId ? { serviceId } : undefined,
      include: { service: true, country: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  upsertPrice(dto: UpsertPriceDto) {
    return this.prisma.platformPrice.upsert({
      where: {
        serviceId_countryId_provider: {
          serviceId: dto.serviceId,
          countryId: dto.countryId,
          provider: dto.provider,
        },
      },
      update: {
        providerCostUsd: dto.providerCostUsd,
        wholesaleUsd: dto.wholesaleUsd,
        isActive: dto.isActive ?? true,
      },
      create: {
        serviceId: dto.serviceId,
        countryId: dto.countryId,
        provider: dto.provider,
        providerCostUsd: dto.providerCostUsd,
        wholesaleUsd: dto.wholesaleUsd,
        isActive: dto.isActive ?? true,
      },
    });
  }

  /// (xizmat×davlat) uchun eng arzon faol ulgurji narx — order oqimi shuni ishlatadi.
  resolvePrice(serviceId: string, countryId: string) {
    return this.prisma.platformPrice.findFirst({
      where: { serviceId, countryId, isActive: true },
      orderBy: { wholesaleUsd: 'asc' },
    });
  }

  /// (xizmat×davlat) uchun JONLI ulgurji narx — provayderdan tannarx olib,
  /// markup + kurs qo'llaydi. Order oqimi va admin "tan narxi" shuni ishlatadi.
  /// Router: telegramOnly -> SPIDER, aks holda -> HEROSMS. Narx yo'q bo'lsa null.
  async wholesaleFor(
    serviceId: string,
    countryId: string,
  ): Promise<{
    provider: ProviderKind;
    costUsd: number;
    wholesaleUsd: number;
    wholesaleUzs: number;
  } | null> {
    const [service, country] = await Promise.all([
      this.prisma.service.findUnique({ where: { id: serviceId } }),
      this.prisma.country.findUnique({ where: { id: countryId } }),
    ]);
    if (!service || !country) return null;

    const provider = service.telegramOnly
      ? ProviderKind.SPIDER
      : ProviderKind.HEROSMS;

    const costUsd = await this.providers.getPriceUsd(provider, {
      serviceSlug: service.slug,
      serviceHeroCode: service.heroCode,
      countrySlug: country.slug,
      countryIso2: country.iso2,
      countryHeroCode: country.heroCode,
    });
    if (costUsd == null) return null;

    // Tan narx = provayder real narxi (so'mda, 100 gacha yaxlit) + belgilangan
    // ustama (default 1000 so'm). Ya'ni platforma har raqamdan shu farqni oladi.
    //
    // XAVFSIZ PARSE: `Number('')` = 0 va `Number('12 000')` = NaN! Kurs 0 bo'lsa
    // raqamlar deyarli TEKINGA sotilardi (costUzs=0 + 1000 so'm), NaN bo'lsa
    // xarid provayderdan raqam OLINGANDAN KEYIN yiqilardi. Faqat musbat chekli
    // qiymat qabul qilinadi, aks holda default.
    const rateRaw = Number(this.config.get('USD_TO_UZS'));
    const rate = Number.isFinite(rateRaw) && rateRaw > 0 ? rateRaw : 12000;
    const fixedRaw = Number(this.config.get('MARKUP_FIXED_UZS'));
    const fixed = Number.isFinite(fixedRaw) && fixedRaw >= 0 ? fixedRaw : 1000;
    const costUzs = Math.round((costUsd * rate) / 100) * 100;
    const wholesaleUzs = costUzs + fixed;

    return { provider, costUsd, wholesaleUsd: wholesaleUzs / rate, wholesaleUzs };
  }

  /// Free-tarif SINOV holati (default 10 kun). Abuse himoyasi: sinov boshlanish
  /// sanasi SHAXSGA bog'lanadi — bir xil Telegram ID yoki bot username'li ENG ERTA
  /// do'kon sanasidan hisoblanadi. Ya'ni yangi akkaunt/qayta bot bilan sinov qayta
  /// boshlanmaydi. Pullik tarifda sinov yo'q.
  async freeTrialStatus(tenant: {
    id: string;
    tariffPlan: TariffPlan;
    createdAt: Date;
    ownerTelegramId: bigint | null;
    botUsername: string | null;
    deviceId: string | null;
  }): Promise<{
    state: 'TRIAL' | 'EXPIRED' | 'PAID';
    phase: 'FREE' | 'SURCHARGE' | 'EXPIRED' | 'PAID';
    trialDaysLeft: number;
    freeDaysLeft: number;
    surchargeUzs: number;
    expired: boolean;
  }> {
    if (tenant.tariffPlan !== TariffPlan.FREE) {
      return {
        state: 'PAID',
        phase: 'PAID',
        trialDaysLeft: 0,
        freeDaysLeft: 0,
        surchargeUzs: 0,
        expired: false,
      };
    }
    const trialDays = Number(this.config.get('TRIAL_DAYS') ?? 10);
    const freeDays = Number(this.config.get('TRIAL_FREE_DAYS') ?? 7);
    const surcharge = Number(this.config.get('TRIAL_SURCHARGE_UZS') ?? 1200);
    // Shu shaxs/bot bilan bog'liq eng erta do'kon sanasi = sinov boshlanishi.
    const or: Array<Record<string, unknown>> = [{ id: tenant.id }];
    if (tenant.ownerTelegramId != null) {
      or.push({ ownerTelegramId: tenant.ownerTelegramId });
    }
    if (tenant.botUsername) or.push({ botUsername: tenant.botUsername });
    if (tenant.deviceId) or.push({ deviceId: tenant.deviceId });
    const agg = await this.prisma.tenant.aggregate({
      where: { OR: or },
      _min: { createdAt: true },
    });
    const trialStart = agg._min.createdAt ?? tenant.createdAt;
    // Toshkent (UTC+5) TAQVIM kuni bo'yicha: ro'yxatdan o'tgan kun 1-kun.
    //  • 1–7 kun  : tan narxida (qo'shimchasiz)
    //  • 8–10 kun : tan narxi + 1200 so'm/sotuv (platforma ustamasi)
    //  • 11-kun   : bloklanadi (tarif shart)
    const TZ = 5 * 60 * 60 * 1000;
    const dayOf = (ms: number) => Math.floor((ms + TZ) / 86_400_000);
    const daysPassed = dayOf(Date.now()) - dayOf(trialStart.getTime());
    const daysLeft = trialDays - daysPassed;
    if (daysLeft <= 0) {
      return {
        state: 'EXPIRED',
        phase: 'EXPIRED',
        trialDaysLeft: 0,
        freeDaysLeft: 0,
        surchargeUzs: 0,
        expired: true,
      };
    }
    const inSurcharge = daysPassed >= freeDays; // 8-kundan boshlab ustama
    return {
      state: 'TRIAL',
      phase: inSurcharge ? 'SURCHARGE' : 'FREE',
      trialDaysLeft: daysLeft,
      freeDaysLeft: Math.max(0, freeDays - daysPassed),
      surchargeUzs: inSurcharge ? surcharge : 0,
      expired: false,
    };
  }

  /// tenantId bo'yicha sinov holati (UI banner uchun qulay wrapper).
  async freeTrialByTenantId(tenantId: string): Promise<{
    state: 'TRIAL' | 'EXPIRED' | 'PAID';
    phase: 'FREE' | 'SURCHARGE' | 'EXPIRED' | 'PAID';
    trialDaysLeft: number;
    freeDaysLeft: number;
    surchargeUzs: number;
    expired: boolean;
  }> {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        tariffPlan: true,
        createdAt: true,
        ownerTelegramId: true,
        botUsername: true,
        deviceId: true,
      },
    });
    if (!t) {
      return {
        state: 'PAID',
        phase: 'PAID',
        trialDaysLeft: 0,
        freeDaysLeft: 0,
        surchargeUzs: 0,
        expired: false,
      };
    }
    return this.freeTrialStatus(t);
  }

  /// Do'kon hozir sota oladimi? FREE + sinov tugagan bo'lsa — YO'Q (tarif kerak).
  async assertCanSell(tenantId: string): Promise<void> {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        tariffPlan: true,
        createdAt: true,
        ownerTelegramId: true,
        botUsername: true,
        deviceId: true,
      },
    });
    if (!t) throw new NotFoundException("Do'kon topilmadi");
    if (t.tariffPlan !== TariffPlan.FREE) return;
    const s = await this.freeTrialStatus(t);
    if (s.expired) {
      throw new BadRequestException(
        "Do'kon sinov muddati (10 kun) tugadi. Sotuvni davom ettirish uchun do'kon egasi tarif sotib olishi kerak.",
      );
    }
  }

  /// Reseller uchun TO'LIQ narx (tenantga qarab): tan narxi (SPIDER + 1000 baza)
  /// + Free sinov 8–10 kunlarida +1200 so'm ustama. 1–7 kun: ustamasiz.
  /// Offer sheet displayi va order oqimi — ikkalasi ham shuni ishlatadi (bir manba).
  async quoteFor(tenantId: string, serviceId: string, countryId: string) {
    const base = await this.wholesaleFor(serviceId, countryId);
    if (!base) return null;
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        tariffPlan: true,
        createdAt: true,
        ownerTelegramId: true,
        botUsername: true,
        deviceId: true,
      },
    });
    const s = tenant
      ? await this.freeTrialStatus(tenant)
      : {
          state: 'PAID' as const,
          phase: 'PAID' as const,
          trialDaysLeft: 0,
          freeDaysLeft: 0,
          surchargeUzs: 0,
          expired: false,
        };
    return {
      ...base,
      baseUzs: base.wholesaleUzs,
      surchargeUzs: s.surchargeUzs, // 8–10 kunlarda +1200, aks holda 0
      totalUzs: base.wholesaleUzs + s.surchargeUzs, // reseller shu narxda to'laydi
      state: s.state, // TRIAL | EXPIRED | PAID
      phase: s.phase, // FREE | SURCHARGE | EXPIRED | PAID
      trialDaysLeft: s.trialDaysLeft,
      freeDaysLeft: s.freeDaysLeft,
    };
  }
}
