import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { Locale } from '@/common/helpers/localize';

export interface BannerView {
  id: string;
  imageUrl: string;
  targetType: string;
  targetValue: string | null;
  position: number;
}

@Injectable()
export class BannersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(placement: string, lang: Locale, tenantId?: string | null): Promise<BannerView[]> {
    const now = new Date();
    const rows = await this.prisma.banner.findMany({
      where: {
        placement,
        isActive: true,
        tenantId: tenantId ?? null,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: { position: 'asc' },
    });
    return rows.map((b) => ({
      id: b.id,
      imageUrl: (lang === 'ru' && b.imageUrlRu) || b.imageUrlUz,
      targetType: b.targetType,
      targetValue: b.targetValue,
      position: b.position,
    }));
  }
}
