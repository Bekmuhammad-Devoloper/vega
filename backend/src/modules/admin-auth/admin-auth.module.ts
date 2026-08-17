import { Module } from '@nestjs/common';
import { AdminAuthService } from './admin-auth.service';
import { AdminAuthController } from './admin-auth.controller';
import { AdminJwtGuard } from './admin-jwt.guard';
import { RolesGuard } from './roles.guard';
import { TariffFeatureGuard } from './tariff-feature.guard';
import { JwtService } from './jwt.service';

@Module({
  controllers: [AdminAuthController],
  providers: [AdminAuthService, AdminJwtGuard, RolesGuard, TariffFeatureGuard, JwtService],
  exports: [AdminAuthService, AdminJwtGuard, RolesGuard, TariffFeatureGuard, JwtService],
})
export class AdminAuthModule {}
