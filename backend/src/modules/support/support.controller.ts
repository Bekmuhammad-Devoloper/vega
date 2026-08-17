import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import type { User } from '@prisma/client';
import { TelegramAuthGuard } from '../auth/telegram-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { CurrentTenantId } from '@/common/decorators/tenant.decorator';
import { SupportService } from './support.service';

class CreateTicketDto {
  @IsString() @MinLength(2) @MaxLength(120) subject!: string;
  @IsString() @MinLength(2) @MaxLength(2000) message!: string;
}

@Controller('support/tickets')
@UseGuards(TelegramAuthGuard)
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post()
  create(
    @CurrentUser() user: User,
    @Body() dto: CreateTicketDto,
    @CurrentTenantId() tenantId: string | null,
  ) {
    return this.support.create(user.id, dto, tenantId);
  }

  @Get('my')
  listMy(@CurrentUser() user: User) {
    return this.support.listMy(user.id);
  }

  @Get('my/:id')
  getMy(@CurrentUser() user: User, @Param('id') id: string) {
    return this.support.getMy(user.id, id);
  }
}
