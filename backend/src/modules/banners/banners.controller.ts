import { Controller, Get, Headers, Query } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { CurrentLanguage } from '@/common/decorators/current-user.decorator';
import type { Locale } from '@/common/helpers/localize';
import { TenantScopeService } from '@/common/tenant-scope/tenant-scope.service';
import { BannersService } from './banners.service';

class ListBannersDto {
  @IsOptional() @IsString() placement?: string;
}

@Controller('banners')
export class BannersController {
  constructor(
    private readonly banners: BannersService,
    private readonly tenantScope: TenantScopeService,
  ) {}

  @Get()
  async list(
    @Query() q: ListBannersDto,
    @CurrentLanguage() lang: Locale,
    @Headers('x-tenant-slug') shop?: string,
  ) {
    const tenantId = await this.tenantScope.tenantId(shop);
    return this.banners.list(q.placement ?? 'home', lang, tenantId);
  }
}
