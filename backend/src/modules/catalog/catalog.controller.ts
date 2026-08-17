import { Controller, Get, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';

/// Ochiq katalog — xizmat va davlatlar ro'yxati (webapp/admin dropdownlari uchun).
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('services')
  services() {
    return this.catalog.listServices(true);
  }

  @Get('countries')
  countries() {
    return this.catalog.listCountries(true);
  }
}
