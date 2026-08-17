import { BadRequestException, Body, Controller, Get, Module, Patch, UseGuards } from '@nestjs/common';
import { IsIn, IsObject, IsString } from 'class-validator';
import { AdminRole, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { Roles, RolesGuard } from '../admin-auth/roles.guard';
import { BOSS_ROLES } from '@/common/role-groups';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';

// Admin UI orqali tahrirlanishi mumkin bo'lgan kalitlar.
// Yangi sozlama qo'shilganda shu yerga ham qo'shing — boshqa kalit nomi
// bilan endpoint'ga so'rov tashlasangiz 400 qaytaradi.
const ALLOWED_KEYS = ['business', 'store'] as const;

class UpsertSettingDto {
  @IsString()
  @IsIn(ALLOWED_KEYS as unknown as string[])
  key!: string;

  @IsObject() value!: Record<string, unknown>;
}

@Controller('admin/settings')
@UseGuards(AdminJwtGuard, RolesGuard)
// Do'kon sozlamalari (o'qish + yozish) — faqat boss (egasi/ADMIN). CREATOR kira olmaydi.
@Roles(...BOSS_ROLES)
class AdminSettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    // Faqat oq ro'yxatdagi kalitlar — boshqa platforma-darajadagi sozlamalar
    // (masalan, super-admin kalitlari) bu yerda chiqmasin.
    return this.prisma.settings.findMany({
      where: { key: { in: ALLOWED_KEYS as unknown as string[] } },
    });
  }

  @Patch()
  @Roles(AdminRole.SUPERADMIN, AdminRole.ADMIN)
  async upsert(@Body() dto: UpsertSettingDto) {
    // DTO darajasida @IsIn tekshirgan, lekin sub'-payload xavfsiz bo'lishi
    // uchun JSON o'lchamiga ham cheklov qo'yamiz (~64KB).
    const serialized = JSON.stringify(dto.value);
    if (serialized.length > 64 * 1024) {
      throw new BadRequestException('Setting value too large (max 64KB)');
    }
    const value = dto.value as Prisma.InputJsonValue;
    return this.prisma.settings.upsert({
      where: { key: dto.key },
      update: { value },
      create: { key: dto.key, value },
    });
  }
}

@Module({
  imports: [AdminAuthModule],
  controllers: [AdminSettingsController],
})
export class AdminSettingsModule {}
