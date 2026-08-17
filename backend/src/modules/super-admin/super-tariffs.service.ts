import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { TariffPlan, Prisma } from '@prisma/client';

@Injectable()
export class SuperTariffsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.tariffConfig.findMany({
      orderBy: { position: 'asc' },
    });
  }

  async getByPlan(plan: TariffPlan) {
    const config = await this.prisma.tariffConfig.findUnique({ where: { plan } });
    if (!config) throw new NotFoundException('Tariff config not found');
    return config;
  }

  async update(plan: TariffPlan, data: Prisma.TariffConfigUpdateInput) {
    return this.prisma.tariffConfig.update({
      where: { plan },
      data,
    });
  }
}
