import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { TenantScopeModule } from './common/tenant-scope/tenant-scope.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
// Raqam domeni (jismoniy Products/Cart/... o'rniga)
import { CatalogModule } from './modules/catalog/catalog.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { NumbersModule } from './modules/numbers/numbers.module';
import { DigitalModule } from './modules/digital/digital.module';
import { CryptoModule } from './modules/crypto/crypto.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { PromoCodesModule } from './modules/promo-codes/promo-codes.module';
import { SupportModule } from './modules/support/support.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { BannersModule } from './modules/banners/banners.module';
import { TelegramBotModule } from './modules/telegram-bot/telegram-bot.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AdminAuthModule } from './modules/admin-auth/admin-auth.module';
import { AdminNumbersModule } from './modules/admin/admin-numbers.module';
import { AdminUsersModule } from './modules/admin/admin-users.module';
import { AdminPromoModule } from './modules/admin/admin-promo.module';
import { AdminSupportModule } from './modules/admin/admin-support.module';
import { AdminBannersModule } from './modules/admin/admin-banners.module';
import { AdminSettingsModule } from './modules/admin/admin-settings.module';
import { AdminStoreModule } from './modules/admin/admin-store.module';
import { ChannelPostsModule } from './modules/channel-posts/channel-posts.module';
import { AdminAdminsModule } from './modules/admin/admin-admins.module';
import { AdminStatsModule } from './modules/admin/admin-stats.module';
import { AdminBroadcastModule } from './modules/admin/admin-broadcast.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { WebAppNotificationsModule } from './modules/webapp-notifications/webapp-notifications.module';
import { SuperAdminModule } from './modules/super-admin/super-admin.module';
import { PublicModule } from './modules/public/public.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AdminReferralModule } from './modules/referral/admin-referral.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: { singleLine: true, translateTime: 'HH:MM:ss' },
              }
            : undefined,
        autoLogging: true,
        redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-telegram-init-data"]'],
      },
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    TenantScopeModule,
    HealthModule,
    AuthModule,
    UsersModule,
    // Raqam domeni
    CatalogModule,
    ProvidersModule,
    NumbersModule,
    DigitalModule,
    CryptoModule,
    WalletModule,
    PromoCodesModule,
    SupportModule,
    AnalyticsModule,
    BannersModule,
    TelegramBotModule,
    NotificationsModule,
    WebAppNotificationsModule,
    SettingsModule,
    // Admin (reseller do'kon paneli)
    AdminAuthModule,
    UploadsModule,
    AdminNumbersModule,
    AdminUsersModule,
    AdminPromoModule,
    AdminSupportModule,
    AdminBannersModule,
    AdminSettingsModule,
    AdminStoreModule,
    ChannelPostsModule,
    AdminAdminsModule,
    AdminStatsModule,
    AdminBroadcastModule,
    // Super Admin (platform egasi = dev panel)
    SuperAdminModule,
    // Public (landing signup)
    PublicModule,
    PaymentsModule,
    AdminReferralModule,
  ],
  // Global rate-limit — barcha endpointlar (login/brute-force himoyasi).
  // Login endpointlarda qo'shimcha qattiqroq @Throttle bor.
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
