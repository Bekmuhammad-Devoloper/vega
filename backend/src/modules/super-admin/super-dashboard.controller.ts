import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ProviderKind } from '@prisma/client';
import { SuperDashboardService } from './super-dashboard.service';
import { SuperJwtGuard } from './super-jwt.guard';
import { ProvidersService } from '../providers/providers.service';
import { WalletService } from '../wallet/wallet.service';

@Controller('super-admin/dashboard')
@UseGuards(SuperJwtGuard)
export class SuperDashboardController {
  constructor(
    private readonly service: SuperDashboardService,
    private readonly providers: ProvidersService,
    private readonly wallet: WalletService,
  ) {}

  @Get('kpi')
  kpi() {
    return this.service.getKpi();
  }

  /** Balanslar — platforma (tasdiqlash uchun) + xizmat provayderlari. */
  @Get('balances')
  async balances() {
    const platform = await this.wallet.platformBalance();
    const kinds: { kind: ProviderKind; label: string }[] = [
      { kind: ProviderKind.SPIDER, label: 'Telegram raqamlari' },
      { kind: ProviderKind.HEROSMS, label: 'Boshqa xizmatlar' },
    ];
    const providers = await Promise.all(
      kinds.map(async (k) => {
        const configured = this.providers.isConfigured(k.kind);
        let balanceUsd: number | null = null;
        if (configured) {
          try {
            balanceUsd = await this.providers.balanceUsd(k.kind);
          } catch {
            balanceUsd = null;
          }
        }
        return { kind: k.kind, label: k.label, configured, balanceUsd };
      }),
    );
    return { platform, providers };
  }

  @Get('revenue')
  revenue(@Query('days') days?: string) {
    return this.service.getRevenueChart(Number(days) || 30);
  }

  @Get('tariff-distribution')
  tariffDistribution() {
    return this.service.getTariffDistribution();
  }

  @Get('activity')
  activity(@Query('limit') limit?: string) {
    return this.service.getActivity(Number(limit) || 20);
  }
}
