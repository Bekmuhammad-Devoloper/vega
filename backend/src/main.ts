import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { resolve, isAbsolute } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TraceIdInterceptor } from './common/interceptors/trace-id.interceptor';

// JSON.stringify BigInt'larni qanday serialize qilishni bilmaydi —
// Prisma'dagi BigInt maydonlar (masalan, Tenant.ownerTelegramId,
// User.telegramId) javob yuborilishda "Do not know how to serialize a
// BigInt" xatosi beradi. Global toJSON o'rnatib, ularni avtomatik
// string'ga aylantiramiz. Telegram ID lar 64-bit bo'lishi mumkin —
// JavaScript Number 2^53 dan oshganda aniqlikni yo'qotadi, shuning
// uchun string eng xavfsiz ko'rinish.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function (
  this: bigint,
): string {
  return this.toString();
};

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));

  // nginx orqasida ishlaydi — rate-limiter HAQIQIY mijoz IP'sini (X-Forwarded-For)
  // ko'rishi uchun. Aks holda hamma so'rov nginx IP'sidan deb hisoblanadi.
  app.set('trust proxy', 1);

  const webappUrl = process.env.WEBAPP_URL ?? 'http://localhost:5174';
  const adminUrl = process.env.ADMIN_URL ?? 'http://localhost:5175';
  const superAdminUrl = process.env.SUPERADMIN_URL ?? 'http://localhost:5180';
  const landingUrl = process.env.LANDING_URL ?? 'http://localhost:5173';

  app.enableCors({
    origin: [
      webappUrl,
      adminUrl,
      superAdminUrl,
      landingUrl,
      // Production: selliostore.uz va uning barcha subdomenlari
      /^https:\/\/(.+\.)?selliostore\.uz$/,
      // Dev tunnellar
      /\.ngrok-free\.app$/,
      /\.ngrok\.io$/,
      /\.trycloudflare\.com$/,
      /\.loca\.lt$/,
      /^http:\/\/localhost(:\d+)?$/,
      /^http:\/\/127\.0\.0\.1(:\d+)?$/,
    ],
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Accept-Language',
      'X-Telegram-Init-Data',
      'bypass-tunnel-reminder',
    ],
  });
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());

  app.setGlobalPrefix('api', {
    exclude: ['telegram/webhook', 'telegram/t/:tenantId/webhook'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TraceIdInterceptor());

  const uploadDirRaw = process.env.UPLOAD_DIR ?? './uploads';
  const uploadDir = isAbsolute(uploadDirRaw) ? uploadDirRaw : resolve(process.cwd(), uploadDirRaw);
  app.useStaticAssets(uploadDir, {
    prefix: '/uploads/',
  });

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`🚀 Marketplace API running on http://localhost:${port}`);
}

bootstrap();
