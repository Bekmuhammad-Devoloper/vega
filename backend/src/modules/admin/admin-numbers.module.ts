import { Module } from '@nestjs/common';
import { AdminNumbersService } from './admin-numbers.service';
import { AdminNumbersController } from './admin-numbers.controller';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { CatalogModule } from '../catalog/catalog.module';

@Module({
  imports: [AdminAuthModule, CatalogModule],
  providers: [AdminNumbersService],
  controllers: [AdminNumbersController],
})
export class AdminNumbersModule {}
