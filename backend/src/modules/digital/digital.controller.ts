import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { type User } from '@prisma/client';
import { TelegramAuthGuard } from '../auth/telegram-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { CurrentTenantId } from '@/common/decorators/tenant.decorator';
import { DigitalService } from './digital.service';

class CreateDigitalOrderDto {
  @IsString() digitalProductId!: string;
  @IsString() @MinLength(4) @MaxLength(40) username!: string;
}

/// Mijoz (webapp/bot) — Stars/Premium. Do'kon x-tenant-slug orqali.
@Controller('digital')
@UseGuards(TelegramAuthGuard)
export class DigitalController {
  constructor(private readonly digital: DigitalService) {}

  @Get('storefront')
  storefront(@CurrentTenantId() tenantId: string | null) {
    if (!tenantId) throw new BadRequestException("Do'kon aniqlanmadi");
    return this.digital.storefront(tenantId);
  }

  @Get('orders')
  myOrders(
    @CurrentTenantId() tenantId: string | null,
    @CurrentUser() user: User,
  ) {
    if (!tenantId) throw new BadRequestException("Do'kon aniqlanmadi");
    return this.digital.myOrders(tenantId, user.id);
  }

  @Get('orders/:id')
  order(@Param('id') id: string, @CurrentUser() user: User) {
    return this.digital.getOrder(id, user.id);
  }

  @Post('orders')
  create(
    @Body() dto: CreateDigitalOrderDto,
    @CurrentTenantId() tenantId: string | null,
    @CurrentUser() user: User,
  ) {
    if (!tenantId) throw new BadRequestException("Do'kon aniqlanmadi");
    return this.digital.createOrder({
      tenantId,
      userId: user.id,
      digitalProductId: dto.digitalProductId,
      username: dto.username,
    });
  }
}
