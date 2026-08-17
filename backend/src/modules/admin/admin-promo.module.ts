import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { PromoType, type Admin } from '@prisma/client';
import { BOSS_ROLES } from '@/common/role-groups';
import { PrismaService } from '@/prisma/prisma.service';
import { buildCursorPage } from '@/common/helpers/pagination';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { CurrentAdmin, Roles, RolesGuard } from '../admin-auth/roles.guard';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';

class UpsertPromoDto {
  @IsString() @MinLength(2) @MaxLength(40) code!: string;
  @IsEnum(PromoType) type!: PromoType;
  @IsNumber() @Min(0) value!: number;
  @IsOptional() @IsNumber() @Min(0) minOrderAmount?: number;
  @IsOptional() @IsNumber() @Min(0) maxDiscount?: number;
  @IsOptional() @IsString() startsAt?: string;
  @IsOptional() @IsString() expiresAt?: string;
  @IsOptional() @IsInt() @Min(0) usageLimit?: number;
  @IsOptional() @IsInt() @Min(1) perUserLimit?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class ListPromoDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

@Controller('admin/promo-codes')
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(...BOSS_ROLES)
class AdminPromoController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query() q: ListPromoDto, @CurrentAdmin() admin: Admin) {
    const limit = Math.min(Math.max(q.limit ?? 30, 1), 100);
    const take = limit + 1;
    const rows = await this.prisma.promoCode.findMany({
      where: {
        ...(admin.tenantId ? { tenantId: admin.tenantId } : {}),
        ...(q.q ? { code: { contains: q.q.toUpperCase() } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    return buildCursorPage(
      rows.map((p) => ({
        ...p,
        value: Number(p.value),
        minOrderAmount: p.minOrderAmount ? Number(p.minOrderAmount) : null,
        maxDiscount: p.maxDiscount ? Number(p.maxDiscount) : null,
      })),
      limit,
    );
  }

  /** Promokod shu sotuvchiniki ekanini tekshiradi (owner uchun o'tkazib yuboriladi). */
  private async assertOwn(id: string, admin: Admin) {
    const p = await this.prisma.promoCode.findUnique({ where: { id }, select: { tenantId: true } });
    if (!p) throw new NotFoundException('Promo not found');
    if (admin.tenantId && p.tenantId !== admin.tenantId) throw new NotFoundException('Promo not found');
  }

  @Get(':id')
  async getById(@Param('id') id: string, @CurrentAdmin() admin: Admin) {
    await this.assertOwn(id, admin);
    return this.prisma.promoCode.findUnique({ where: { id } });
  }

  @Get(':id/usages')
  async usages(@Param('id') id: string, @CurrentAdmin() admin: Admin) {
    await this.assertOwn(id, admin);
    return this.prisma.promoCodeUsage.findMany({
      where: { promoCodeId: id },
      include: { user: true, promoCode: false },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Post()
  async create(@Body() dto: UpsertPromoDto, @CurrentAdmin() admin: Admin) {
    const code = dto.code.toUpperCase();
    const dup = await this.prisma.promoCode.findFirst({
      where: { code, tenantId: admin.tenantId ?? null },
    });
    if (dup) throw new ConflictException('Bu promokod allaqachon mavjud');
    return this.prisma.promoCode.create({
      data: {
        tenantId: admin.tenantId ?? null,
        code,
        type: dto.type,
        value: dto.value,
        minOrderAmount: dto.minOrderAmount,
        maxDiscount: dto.maxDiscount,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        usageLimit: dto.usageLimit,
        perUserLimit: dto.perUserLimit ?? 1,
        isActive: dto.isActive ?? true,
      },
    });
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<UpsertPromoDto>, @CurrentAdmin() admin: Admin) {
    await this.assertOwn(id, admin);
    return this.prisma.promoCode.update({
      where: { id },
      data: {
        code: dto.code?.toUpperCase(),
        type: dto.type,
        value: dto.value,
        minOrderAmount: dto.minOrderAmount,
        maxDiscount: dto.maxDiscount,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        usageLimit: dto.usageLimit,
        perUserLimit: dto.perUserLimit,
        isActive: dto.isActive,
      },
    });
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentAdmin() admin: Admin) {
    await this.assertOwn(id, admin);
    await this.prisma.promoCode.delete({ where: { id } });
    return { ok: true };
  }
}

@Module({
  imports: [AdminAuthModule],
  controllers: [AdminPromoController],
})
export class AdminPromoModule {}
