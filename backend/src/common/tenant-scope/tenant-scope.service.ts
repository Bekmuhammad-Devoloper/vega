import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export interface TenantScope {
  tenantId: string;
  slug: string;
  botToken: string | null;
}

/**
 * Do'kon (shop) slug'idan tenant'ni aniqlaydi — webapp/bot multi-tenant uchun.
 * Oddiy in-memory kesh (slug'lar barqaror).
 */
@Injectable()
export class TenantScopeService {
  private readonly cache = new Map<string, TenantScope | null>();

  constructor(private readonly prisma: PrismaService) {}

  async resolve(slug?: string | null): Promise<TenantScope | null> {
    if (!slug) return null;
    if (this.cache.has(slug)) return this.cache.get(slug) ?? null;
    const t = await this.prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, slug: true, botToken: true, status: true },
    });
    const scope: TenantScope | null =
      t && t.status === 'ACTIVE' ? { tenantId: t.id, slug: t.slug, botToken: t.botToken } : null;
    // Faqat topilgan (positive) natijani keshlaymiz — aks holda hali faollashmagan
    // do'kon abadiy null bo'lib qoladi.
    if (scope) this.cache.set(slug, scope);
    return scope;
  }

  async tenantId(slug?: string | null): Promise<string | null> {
    return (await this.resolve(slug))?.tenantId ?? null;
  }

  /** Kesh'ni tozalash (token o'zgarganda). */
  invalidate(slug: string): void {
    this.cache.delete(slug);
  }
}
