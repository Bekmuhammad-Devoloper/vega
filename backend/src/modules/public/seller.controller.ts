import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  ParseFilePipeBuilder,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { TariffPlan } from '@prisma/client';
import { SellerOnboardingService } from './seller.service';
import { UploadsService } from '../uploads/uploads.service';

class InitDataDto {
  @IsString()
  @MaxLength(4096)
  initData!: string;
}

class OnboardDto {
  @IsString()
  @MaxLength(4096)
  initData!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  shopName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  ownerName!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(30)
  ownerPhone!: string;

  @IsEnum(TariffPlan)
  tariffPlan!: TariffPlan;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  botToken?: string;

  // Referal kod (?ref=KOD) — kim taklif qilgani
  @IsOptional()
  @IsString()
  @MaxLength(40)
  ref?: string;

  // Qurilma ID (brauzer) — abuse himoyasi (bir qurilma = bitta free)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  deviceId?: string;
}

class BotTokenDto {
  @IsString()
  @MaxLength(100)
  botToken!: string;
}

@Controller('public/seller')
export class SellerController {
  constructor(
    private readonly service: SellerOnboardingService,
    private readonly uploads: UploadsService,
  ) {}

  /** Tariflar ro'yxati (4 ta). */
  @Get('tariffs')
  tariffs() {
    return this.service.tariffs();
  }

  /** To'lov ma'lumotlari (pulli tarif tanlanganda). */
  @Get('payment-info')
  paymentInfo() {
    return this.service.paymentInfo();
  }

  /** Bot tokenini tekshirish (onboarding 3-bosqichда). */
  @Post('validate-bot')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60 * 60 * 1000 } })
  validateBot(@Body() dto: BotTokenDto) {
    return this.service.validateBotToken(dto.botToken);
  }

  /** Ro'yxatdan o'tganmi tekshirish. */
  @Post('me')
  @HttpCode(200)
  me(@Body() dto: InitDataDto) {
    return this.service.me(dto.initData);
  }

  /** Yangi do'kon yaratish. */
  @Post('onboard')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60 * 60 * 1000 } }) // 10/soat/IP
  onboard(@Body() dto: OnboardDto) {
    return this.service.onboard(dto.initData, {
      shopName: dto.shopName,
      ownerName: dto.ownerName,
      ownerPhone: dto.ownerPhone,
      tariffPlan: dto.tariffPlan,
      logoUrl: dto.logoUrl,
      botToken: dto.botToken,
      ref: dto.ref,
      deviceId: dto.deviceId,
    });
  }

  /** To'lov chekini yuklash + admin chatiga tasdiqlash so'rovini yuborish. */
  @Post('payment-request')
  @HttpCode(200)
  @Throttle({ default: { limit: 15, ttl: 60 * 60 * 1000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  async paymentRequest(
    @Body() dto: InitDataDto,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /image\/(png|jpe?g|webp)/ })
        .addMaxSizeValidator({ maxSize: 8 * 1024 * 1024 })
        .build({ fileIsRequired: true }),
    )
    file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Chek rasmi kerak');
    return this.service.submitPaymentReceipt(dto.initData, file.buffer);
  }

  /** Logo yuklash (ixtiyoriy) — onboarding'dan oldin. URL qaytaradi. */
  @Post('logo')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60 * 60 * 1000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async logo(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /image\/(png|jpe?g|webp)/ })
        .addMaxSizeValidator({ maxSize: 5 * 1024 * 1024 })
        .build({ fileIsRequired: true }),
    )
    file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Rasm fayli kerak');
    const saved = await this.uploads.saveImage(file.buffer);
    return { url: saved.url, thumbUrl: saved.thumbUrl };
  }
}
