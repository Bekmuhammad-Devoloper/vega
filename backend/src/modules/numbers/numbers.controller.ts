import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseFilePipeBuilder,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { IsString } from 'class-validator';
import { type User } from '@prisma/client';
import { TelegramAuthGuard } from '../auth/telegram-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { CurrentTenantId } from '@/common/decorators/tenant.decorator';
import { NumbersService } from './numbers.service';

class CreateOrderDto {
  @IsString() serviceId!: string;
  @IsString() countryId!: string;
}

/// Mijoz (webapp/bot) — do'kon slug'i x-tenant-slug header orqali.
@Controller('numbers')
@UseGuards(TelegramAuthGuard)
export class NumbersController {
  constructor(private readonly numbers: NumbersService) {}

  @Get('storefront')
  storefront(@CurrentTenantId() tenantId: string | null) {
    if (!tenantId) throw new BadRequestException("Do'kon aniqlanmadi");
    return this.numbers.storefront(tenantId);
  }

  @Get('orders')
  myOrders(
    @CurrentTenantId() tenantId: string | null,
    @CurrentUser() user: User,
  ) {
    if (!tenantId) throw new BadRequestException("Do'kon aniqlanmadi");
    return this.numbers.myOrders(tenantId, user.id);
  }

  @Get('orders/:id')
  order(@Param('id') id: string, @CurrentUser() user: User) {
    return this.numbers.getOrder(id, user.id);
  }

  @Post('orders')
  create(
    @Body() dto: CreateOrderDto,
    @CurrentTenantId() tenantId: string | null,
    @CurrentUser() user: User,
  ) {
    if (!tenantId) throw new BadRequestException("Do'kon aniqlanmadi");
    return this.numbers.createOrder({
      tenantId,
      userId: user.id,
      serviceId: dto.serviceId,
      countryId: dto.countryId,
    });
  }

  /** Mijoz balansini karta + chek bilan to'ldirish (sotuvchi kanaldan tasdiqlaydi). */
  @Post('balance/topup')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  async topupBalance(
    @CurrentTenantId() tenantId: string | null,
    @CurrentUser() user: User,
    @Body('amount') amountRaw: string,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /image\/(png|jpe?g|webp)/ })
        .addMaxSizeValidator({ maxSize: 8 * 1024 * 1024 })
        .build({ fileIsRequired: true }),
    )
    file: Express.Multer.File,
  ) {
    if (!tenantId) throw new BadRequestException("Do'kon aniqlanmadi");
    const amount = Number(String(amountRaw ?? '').replace(/[^0-9]/g, ''));
    return this.numbers.requestBalanceTopup({
      tenantId,
      userId: user.id,
      amount,
      receipt: file.buffer,
    });
  }

  @Post('orders/:id/check')
  check(@Param('id') id: string, @CurrentUser() user: User) {
    return this.numbers.check(id, user.id);
  }

  @Post('orders/:id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: User) {
    return this.numbers.cancel(id, user.id);
  }
}
