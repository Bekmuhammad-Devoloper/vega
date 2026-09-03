import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CryptoAsset, CryptoOrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';

/** Aktiv qaysi tarmoqlarda yuborilishi mumkin (sotuvchi shundan tanlaydi). */
export const ASSET_NETWORKS: Record<CryptoAsset, string[]> = {
  [CryptoAsset.TON]: ['TON'],
  [CryptoAsset.USDT]: ['TRC20', 'BEP20', 'ERC20', 'TON'],
};

/**
 * Manzil shakli tarmoqqa qarab tekshiriladi.
 *
 * Bu "chiroyli validatsiya" emas — noto'g'ri tarmoqqa yuborilgan kripto
 * QAYTMAYDI. Shuning uchun manzil buyurtma yaratilishidayoq rad etiladi,
 * sotuvchi qo'lida allaqachon puli yechilgan buzuq buyurtma qolmasin.
 */
const ADDRESS_RULES: Record<string, { re: RegExp; hint: string }> = {
  // TON: foydalanuvchi ko'radigan ko'rinish (EQ.../UQ...) — 48 belgi base64url.
  TON: {
    re: /^[EUkK0][QqfF][A-Za-z0-9_-]{46}$/,
    hint: 'TON manzili EQ yoki UQ bilan boshlanadi va 48 belgidan iborat',
  },
  // Tron
  TRC20: {
    re: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
    hint: 'TRC20 manzili T bilan boshlanadi va 34 belgidan iborat',
  },
  // EVM (BSC / Ethereum) — ikkalasi bir xil shaklda.
  BEP20: {
    re: /^0x[a-fA-F0-9]{40}$/,
    hint: 'BEP20 manzili 0x bilan boshlanadi va 42 belgidan iborat',
  },
  ERC20: {
    re: /^0x[a-fA-F0-9]{40}$/,
    hint: 'ERC20 manzili 0x bilan boshlanadi va 42 belgidan iborat',
  },
};

export interface UpsertCryptoOfferInput {
  asset: CryptoAsset;
  pricePerUnit: number;
  minAmount: number;
  maxAmount: number;
  networks: string[];
}

/// Kripto (TON / USDT) sotuvi — mijoz istagan miqdorni kiritadi, buyurtma
/// sotuvchi tomonidan QO'LDA yetkaziladi (avto-yuborish yo'q).
@Injectable()
export class CryptoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  /** So'm summasini 100 gacha yaxlitlaydi — narxlar butun ko'rinsin. */
  private roundUzs(n: number): number {
    return Math.round(n / 100) * 100;
  }

  // ── MIJOZ ───────────────────────────────────────────────────────

  async storefront(tenantId: string) {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { cryptoEnabled: true },
    });
    if (!t?.cryptoEnabled) return { cryptoEnabled: false, offers: [] };

    const offers = await this.prisma.cryptoOffer.findMany({
      where: { tenantId, isActive: true },
      orderBy: { asset: 'asc' },
    });
    return {
      cryptoEnabled: true,
      offers: offers.map((o) => ({
        asset: o.asset,
        pricePerUnit: Number(o.pricePerUnit),
        minAmount: Number(o.minAmount),
        maxAmount: Number(o.maxAmount),
        networks: this.readNetworks(o.networks),
      })),
    };
  }

  myOrders(tenantId: string, userId: string, take = 30) {
    return this.prisma.cryptoOrder.findMany({
      where: { tenantId, userId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async getOrder(id: string, userId?: string) {
    const o = await this.prisma.cryptoOrder.findUnique({ where: { id } });
    if (!o || (userId && o.userId !== userId)) {
      throw new NotFoundException('Buyurtma topilmadi');
    }
    return o;
  }

  async createOrder(params: {
    tenantId: string;
    userId: string;
    asset: CryptoAsset;
    amount: number;
    network: string;
    address: string;
    memo?: string;
  }) {
    const { tenantId, userId, asset } = params;

    // Free sinov tugagan bo'lsa do'kon sotolmaydi (raqamlar bilan bir xil qoida).
    await this.catalog.assertCanSell(tenantId);

    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { cryptoEnabled: true },
    });
    if (!t?.cryptoEnabled) {
      throw new BadRequestException("Kripto sotuvi hozircha o'chirilgan");
    }

    const offer = await this.prisma.cryptoOffer.findUnique({
      where: { tenantId_asset: { tenantId, asset } },
    });
    if (!offer || !offer.isActive) {
      throw new NotFoundException("Bu aktiv do'konda sotilmaydi");
    }

    const amount = Number(params.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException("Miqdor noto'g'ri");
    }
    const min = Number(offer.minAmount);
    const max = Number(offer.maxAmount);
    if (amount < min || amount > max) {
      throw new BadRequestException(
        `Miqdor ${min} dan ${max} gacha bo'lishi kerak (${asset})`,
      );
    }

    const networks = this.readNetworks(offer.networks);
    const network = params.network.trim().toUpperCase();
    if (!networks.includes(network)) {
      throw new BadRequestException(
        `Bu tarmoq qo'llab-quvvatlanmaydi. Mavjud: ${networks.join(', ')}`,
      );
    }

    const address = params.address.trim();
    const rule = ADDRESS_RULES[network];
    if (rule && !rule.re.test(address)) {
      throw new BadRequestException(`Manzil noto'g'ri — ${rule.hint}`);
    }

    const pricePerUnit = Number(offer.pricePerUnit);
    const totalPrice = this.roundUzs(amount * pricePerUnit);
    if (totalPrice <= 0) throw new BadRequestException("Narx noto'g'ri");

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    if (Number(user.balance) < totalPrice) {
      throw new BadRequestException(
        "Balansingizda mablag' yetarli emas. Balansni to'ldiring.",
      );
    }

    const orderNumber = 'C' + Date.now().toString(36).toUpperCase();
    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: totalPrice } },
      });
      const created = await tx.cryptoOrder.create({
        data: {
          orderNumber,
          tenantId,
          userId,
          asset,
          amount,
          network,
          address,
          memo: params.memo?.trim() || null,
          pricePerUnit,
          totalPrice,
          status: CryptoOrderStatus.PENDING,
          paidAt: new Date(),
        },
      });
      await tx.tenant.update({
        where: { id: tenantId },
        data: { totalOrders: { increment: 1 } },
      });
      return created;
    });
  }

  // ── SOTUVCHI (admin panel) ──────────────────────────────────────

  offers(tenantId: string) {
    return this.prisma.cryptoOffer.findMany({
      where: { tenantId },
      orderBy: { asset: 'asc' },
    });
  }

  async upsertOffer(tenantId: string, dto: UpsertCryptoOfferInput) {
    if (dto.pricePerUnit <= 0) {
      throw new BadRequestException('Narx 0 dan katta bo\'lishi kerak');
    }
    if (dto.minAmount <= 0 || dto.maxAmount <= 0) {
      throw new BadRequestException("Chegaralar 0 dan katta bo'lishi kerak");
    }
    if (dto.minAmount > dto.maxAmount) {
      throw new BadRequestException(
        "Eng kam miqdor eng ko'pdan katta bo'lmasligi kerak",
      );
    }
    const allowed = ASSET_NETWORKS[dto.asset];
    const networks = [...new Set(dto.networks.map((n) => n.trim().toUpperCase()))];
    if (!networks.length) {
      throw new BadRequestException('Kamida bitta tarmoq tanlang');
    }
    const bad = networks.filter((n) => !allowed.includes(n));
    if (bad.length) {
      throw new BadRequestException(
        `${dto.asset} uchun mos kelmaydigan tarmoq: ${bad.join(', ')}`,
      );
    }

    return this.prisma.cryptoOffer.upsert({
      where: { tenantId_asset: { tenantId, asset: dto.asset } },
      update: {
        pricePerUnit: dto.pricePerUnit,
        minAmount: dto.minAmount,
        maxAmount: dto.maxAmount,
        networks: networks as unknown as Prisma.InputJsonValue,
        isActive: true,
      },
      create: {
        tenantId,
        asset: dto.asset,
        pricePerUnit: dto.pricePerUnit,
        minAmount: dto.minAmount,
        maxAmount: dto.maxAmount,
        networks: networks as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async deleteOffer(tenantId: string, id: string) {
    const o = await this.prisma.cryptoOffer.findUnique({ where: { id } });
    if (!o || o.tenantId !== tenantId) throw new NotFoundException('Topilmadi');
    await this.prisma.cryptoOffer.delete({ where: { id } });
    return { ok: true };
  }

  setSettings(tenantId: string, dto: { cryptoEnabled?: boolean }) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(dto.cryptoEnabled !== undefined
          ? { cryptoEnabled: dto.cryptoEnabled }
          : {}),
      },
      select: { cryptoEnabled: true },
    });
  }

  adminOrders(tenantId: string, take = 50) {
    return this.prisma.cryptoOrder.findMany({
      where: { tenantId },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  /** Sotuvchi kriptoni yubordi — buyurtmani yopamiz va tx hash'ni saqlaymiz. */
  async fulfill(
    tenantId: string,
    id: string,
    adminId: string,
    txHash?: string,
    note?: string,
  ) {
    const o = await this.prisma.cryptoOrder.findUnique({ where: { id } });
    if (!o || o.tenantId !== tenantId) {
      throw new NotFoundException('Buyurtma topilmadi');
    }
    if (o.status !== CryptoOrderStatus.PENDING) {
      throw new BadRequestException('Bu buyurtma allaqachon ' + o.status);
    }
    return this.prisma.cryptoOrder.update({
      where: { id },
      data: {
        status: CryptoOrderStatus.FULFILLED,
        fulfilledAt: new Date(),
        fulfilledBy: adminId,
        txHash: txHash?.trim() || null,
        note: note?.trim() || null,
      },
    });
  }

  /** Bekor qilish — mijozga puli to'liq qaytadi. */
  async cancelOrder(tenantId: string, id: string, note?: string) {
    const o = await this.prisma.cryptoOrder.findUnique({ where: { id } });
    if (!o || o.tenantId !== tenantId) {
      throw new NotFoundException('Buyurtma topilmadi');
    }
    if (o.status === CryptoOrderStatus.CANCELLED) return o;
    if (o.status === CryptoOrderStatus.FULFILLED) {
      throw new BadRequestException("Bajarilgan — bekor qilib bo'lmaydi");
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: o.userId },
        data: { balance: { increment: Number(o.totalPrice) } },
      });
      return tx.cryptoOrder.update({
        where: { id },
        data: {
          status: CryptoOrderStatus.CANCELLED,
          note: note?.trim() || null,
        },
      });
    });
  }

  /** `networks` JSON maydonini xavfsiz o'qish. */
  private readNetworks(value: Prisma.JsonValue): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((v): v is string => typeof v === 'string');
  }
}
