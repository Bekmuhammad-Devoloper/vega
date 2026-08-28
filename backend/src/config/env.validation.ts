import { plainToInstance } from 'class-transformer';
import { IsBooleanString, IsOptional, IsString, validateSync } from 'class-validator';

class EnvSchema {
  @IsString() NODE_ENV!: string;
  @IsString() PORT!: string;
  @IsString() DATABASE_URL!: string;
  @IsOptional() @IsString() REDIS_URL?: string;

  @IsString() JWT_ACCESS_SECRET!: string;
  @IsString() JWT_REFRESH_SECRET!: string;
  @IsString() JWT_ACCESS_TTL!: string;
  @IsString() JWT_REFRESH_TTL!: string;

  @IsString() TELEGRAM_BOT_TOKEN!: string;
  @IsString() TELEGRAM_BOT_USERNAME!: string;
  @IsString() TELEGRAM_ORDERS_CHANNEL_ID!: string;
  @IsOptional() @IsString() TELEGRAM_SUPPORT_CHAT_ID?: string;
  @IsString() TELEGRAM_WEBHOOK_SECRET!: string;
  @IsBooleanString() TELEGRAM_USE_WEBHOOK!: string;

  @IsString() UPLOAD_DIR!: string;
  @IsString() UPLOAD_MAX_SIZE_MB!: string;
  @IsString() PUBLIC_UPLOADS_URL!: string;

  @IsString() ADMIN_SEED_EMAIL!: string;
  @IsString() ADMIN_SEED_PASSWORD!: string;
  @IsOptional() @IsString() ADMIN_SEED_FULLNAME?: string;

  @IsString() WEBAPP_URL!: string;
  @IsString() ADMIN_URL!: string;
  @IsString() APP_URL!: string;

  @IsOptional() @IsString() MIN_ORDER_AMOUNT?: string;
  @IsOptional() @IsString() DELIVERY_FEE?: string;
  @IsOptional() @IsString() FREE_DELIVERY_THRESHOLD?: string;
  @IsOptional() @IsString() DEFAULT_CURRENCY?: string;

  @IsOptional() @IsString() EVENTS_RETENTION_DAYS?: string;
  @IsOptional() @IsString() WEEKLY_AGGREGATION_CRON?: string;

  // Raqam-SaaS provayderlari (markaziy — superadmin sozlaydi)
  @IsOptional() @IsString() SPIDER_API_KEY?: string;
  @IsOptional() @IsString() SPIDER_BASE_URL?: string;
  @IsOptional() @IsString() HEROSMS_API_KEY?: string;
  @IsOptional() @IsString() HEROSMS_BASE_URL?: string;
  @IsOptional() @IsString() FRAGMENT_API_KEY?: string;
  // iStar — Stars/Premium avto-yetkazish (Fragment ustidan, +5%)
  @IsOptional() @IsString() ISTAR_API_KEY?: string;
  @IsOptional() @IsString() ISTAR_BASE_URL?: string;
  @IsOptional() @IsString() ISTAR_WALLET?: string;
  // Telegram userbot — sovg'a yetkazish (my.telegram.org + login sessiyasi)
  @IsOptional() @IsString() TG_API_ID?: string;
  @IsOptional() @IsString() TG_API_HASH?: string;
  @IsOptional() @IsString() TG_SESSION?: string;
  @IsOptional() @IsString() USD_TO_UZS?: string;
  // ESKI nom — kod endi buni O'QIMAYDI (catalog MARKUP_FIXED_UZS ishlatadi).
  // Moslik uchun qoldirildi.
  @IsOptional() @IsString() MARKUP_PERCENT?: string;
  /** Platformaning har raqamdan qat'iy ustamasi (so'm). Default: 1000. */
  @IsOptional() @IsString() MARKUP_FIXED_UZS?: string;

  @IsOptional() @IsString() OPENAI_API_KEY?: string;
}

export function validateEnv(config: Record<string, unknown>): EnvSchema {
  const validated = plainToInstance(EnvSchema, config, { enableImplicitConversion: false });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const messages = errors.map((e) => Object.values(e.constraints ?? {}).join(', ')).join('\n');
    throw new Error(`Env validation failed:\n${messages}`);
  }
  return validated;
}

export interface AppEnv {
  isProd: boolean;
  port: number;
  appUrl: string;
  webappUrl: string;
  adminUrl: string;
  databaseUrl: string;
  redisUrl: string;
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: string;
    refreshTtl: string;
  };
  telegram: {
    botToken: string;
    botUsername: string;
    ordersChannelId: string;
    supportChatId?: string;
    webhookSecret: string;
    useWebhook: boolean;
  };
  uploads: {
    dir: string;
    maxSizeBytes: number;
    publicUrl: string;
  };
  business: {
    minOrderAmount: number;
    deliveryFee: number;
    freeDeliveryThreshold: number;
    currency: string;
  };
  analytics: {
    retentionDays: number;
    weeklyCron: string;
  };
}

export function loadAppEnv(): AppEnv {
  return {
    isProd: process.env.NODE_ENV === 'production',
    port: Number(process.env.PORT ?? 4000),
    appUrl: process.env.APP_URL ?? 'http://localhost:4000',
    webappUrl: process.env.WEBAPP_URL ?? 'http://localhost:5174',
    adminUrl: process.env.ADMIN_URL ?? 'http://localhost:5175',
    databaseUrl: process.env.DATABASE_URL!,
    redisUrl: process.env.REDIS_URL!,
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET!,
      refreshSecret: process.env.JWT_REFRESH_SECRET!,
      accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
      refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
    },
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN!,
      botUsername: process.env.TELEGRAM_BOT_USERNAME!,
      ordersChannelId: process.env.TELEGRAM_ORDERS_CHANNEL_ID!,
      supportChatId: process.env.TELEGRAM_SUPPORT_CHAT_ID,
      webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET!,
      useWebhook: process.env.TELEGRAM_USE_WEBHOOK === 'true',
    },
    uploads: {
      dir: process.env.UPLOAD_DIR ?? './uploads',
      maxSizeBytes: Number(process.env.UPLOAD_MAX_SIZE_MB ?? 5) * 1024 * 1024,
      publicUrl: process.env.PUBLIC_UPLOADS_URL ?? 'http://localhost:4000/uploads',
    },
    business: {
      minOrderAmount: Number(process.env.MIN_ORDER_AMOUNT ?? 30000),
      deliveryFee: Number(process.env.DELIVERY_FEE ?? 25000),
      freeDeliveryThreshold: Number(process.env.FREE_DELIVERY_THRESHOLD ?? 500000),
      currency: process.env.DEFAULT_CURRENCY ?? 'UZS',
    },
    analytics: {
      retentionDays: Number(process.env.EVENTS_RETENTION_DAYS ?? 14),
      weeklyCron: process.env.WEEKLY_AGGREGATION_CRON ?? '0 3 * * 1',
    },
  };
}
