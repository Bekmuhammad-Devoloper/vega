import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Admin } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { hasFeature, type TariffFeature } from '@/common/tariff';

const FEATURE_KEY = 'tariff_feature';

/** Controller/handler uchun talab qilinadigan tarif funksiyasini belgilaydi. */
export const RequireFeature = (feature: TariffFeature) => SetMetadata(FEATURE_KEY, feature);

@Injectable()
export class TariffFeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<TariffFeature | undefined>(FEATURE_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!feature) return true;

    const admin = ctx.switchToHttp().getRequest<{ admin?: Admin }>().admin;
    // Tenant'siz admin (platforma egasi/superadmin) — to'liq ruxsat
    if (!admin?.tenantId) return true;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: admin.tenantId },
      select: { tariffPlan: true },
    });
    if (tenant && hasFeature(tenant.tariffPlan, feature)) return true;

    throw new ForbiddenException({
      message: 'Bu funksiya tarifingizда mavjud emas. Tarifni yangilang.',
      feature,
      upgradeRequired: true,
    });
  }
}
