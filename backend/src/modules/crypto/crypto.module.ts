import { Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';
import { CryptoController } from './crypto.controller';
import { AdminCryptoController } from './admin-crypto.controller';
import { AuthModule } from '../auth/auth.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { CatalogModule } from '../catalog/catalog.module';

@Module({
  imports: [AuthModule, AdminAuthModule, CatalogModule],
  providers: [CryptoService],
  controllers: [CryptoController, AdminCryptoController],
  exports: [CryptoService],
})
export class CryptoModule {}
