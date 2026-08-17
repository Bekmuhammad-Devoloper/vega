import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DigitalService } from './digital.service';
import { DigitalController } from './digital.controller';
import { AdminDigitalController } from './admin-digital.controller';
import { WalletModule } from '../wallet/wallet.module';
import { AuthModule } from '../auth/auth.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { ProvidersModule } from '../providers/providers.module';

@Module({
  imports: [
    ConfigModule,
    WalletModule,
    AuthModule,
    AdminAuthModule,
    CatalogModule,
    ProvidersModule,
  ],
  providers: [DigitalService],
  controllers: [DigitalController, AdminDigitalController],
  exports: [DigitalService],
})
export class DigitalModule {}
