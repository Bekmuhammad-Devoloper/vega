import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';
import { ProvidersModule } from '../providers/providers.module';

@Module({
  imports: [ConfigModule, ProvidersModule],
  providers: [CatalogService],
  controllers: [CatalogController],
  exports: [CatalogService],
})
export class CatalogModule {}
