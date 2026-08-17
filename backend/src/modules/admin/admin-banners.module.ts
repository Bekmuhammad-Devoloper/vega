import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';
import { type Admin } from '@prisma/client';
import { BOSS_ROLES } from '@/common/role-groups';
import { PrismaService } from '@/prisma/prisma.service';
import { limitsFor } from '@/common/tariff';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { CurrentAdmin, Roles, RolesGuard } from '../admin-auth/roles.guard';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';

class UpsertBannerDto {
  @IsOptional() @IsString() placement?: string;
  @IsString() imageUrlUz!: string;
  @IsOptional() @IsString() imageUrlRu?: string;
  @IsOptional() @IsString() targetType?: string;
  @IsOptional() @IsString() targetValue?: string;
  @IsOptional() @IsInt() position?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() startsAt?: string;
  @IsOptional() @IsString() endsAt?: string;
}

@Controller('admin/banners')
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(...BOSS_ROLES)
class AdminBannersController {
  constructor(private readonly prisma: PrismaService, private readonly events: EventEmitter2) {}

  private invalidate() {
    this.events.emit('banners.invalidate');
  }

  @Get()
  list(@CurrentAdmin() admin: Admin, @Query('placement') placement?: string) {
    return this.prisma.banner.findMany({
      where: {
        ...(admin.tenantId ? { tenantId: admin.tenantId } : {}),
        ...(placement ? { placement } : {}),
      },
      orderBy: [{ placement: 'asc' }, { position: 'asc' }],
    });
  }

  @Post()
  async create(@Body() dto: UpsertBannerDto, @CurrentAdmin() admin: Admin) {
    if (admin.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: admin.tenantId },
        select: { tariffPlan: true },
      });
      const max = limitsFor(tenant?.tariffPlan ?? 'FREE').maxBanners;
      if (max >= 0) {
        const count = await this.prisma.banner.count({ where: { tenantId: admin.tenantId } });
        if (count >= max) {
          throw new ForbiddenException({
            message: `Banner limiti (${max}) tugadi. Tarifni yangilang.`,
            upgradeRequired: true,
          });
        }
      }
    }
    const res = await this.prisma.banner.create({
      data: {
        tenantId: admin.tenantId ?? null,
        placement: dto.placement ?? 'home',
        imageUrlUz: dto.imageUrlUz,
        imageUrlRu: dto.imageUrlRu ?? null,
        targetType: dto.targetType ?? 'none',
        targetValue: dto.targetValue ?? null,
        position: dto.position ?? 0,
        isActive: dto.isActive ?? true,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      },
    });
    this.invalidate();
    return res;
  }

  private async assertOwn(id: string, tenantId: string | null) {
    if (!tenantId) return;
    const b = await this.prisma.banner.findUnique({ where: { id }, select: { tenantId: true } });
    if (!b || b.tenantId !== tenantId) throw new NotFoundException('Banner not found');
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<UpsertBannerDto>,
    @CurrentAdmin() admin: Admin,
  ) {
    await this.assertOwn(id, admin.tenantId);
    const res = await this.prisma.banner.update({
      where: { id },
      data: {
        placement: dto.placement,
        imageUrlUz: dto.imageUrlUz,
        imageUrlRu: dto.imageUrlRu,
        targetType: dto.targetType,
        targetValue: dto.targetValue,
        position: dto.position,
        isActive: dto.isActive,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
      },
    });
    this.invalidate();
    return res;
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentAdmin() admin: Admin) {
    await this.assertOwn(id, admin.tenantId);
    await this.prisma.banner.delete({ where: { id } });
    this.invalidate();
    return { ok: true };
  }
}

@Module({
  imports: [AdminAuthModule],
  controllers: [AdminBannersController],
})
export class AdminBannersModule {}
