import { Controller, Get, Headers } from '@nestjs/common';
import { TenantScopeService } from '@/common/tenant-scope/tenant-scope.service';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly tenantScope: TenantScopeService,
  ) {}

  @Get('public')
  async getPublic(@Headers('x-tenant-slug') shop?: string) {
    const tenantId = await this.tenantScope.tenantId(shop);
    return this.settings.getPublic(tenantId);
  }
}
