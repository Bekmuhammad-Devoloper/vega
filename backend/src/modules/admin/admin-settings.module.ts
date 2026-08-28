import { BadRequestException, Body, Controller, Get, Module, Patch, UseGuards } from '@nestjs/common';
import { IsIn, IsObject, IsString } from 'class-validator';
import { AdminRole, Prisma, type Admin } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { Roles, RolesGuard, CurrentAdmin } from '../admin-auth/roles.guard';
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

/**
 * `Settings` jadvalining birlamchi kaliti — `key`, ya'ni qator GLOBAL. Ilgari
 * har bir do'kon egasi aynan shu qatorni o'qib-yozardi: bir do'kon
 * ikkinchisining sozlamasini ko'rar va USTIDAN YOZARDI (masalan "minimal
 * buyurtma summasi" hammada bir vaqtda o'zgarardi).
 *
 * Sxemani o'zgartirmasdan ajratamiz: har do'konning kaliti o'z nomlash
 * fazosida saqlanadi. Platforma darajasidagi qatorlar (tenantId'siz adminlar)
 * eski nomda qoladi, shu bois `settings.service` dagi zaxira qiymat ishlashda
 * davom etadi.
 */
const tenantKey = (tenantId: string | null | undefined, key: string): string =>
  tenantId ? `t:${tenantId}:${key}` : key;

@Controller('admin/settings')
@UseGuards(AdminJwtGuard, RolesGuard)
// Do'kon sozlamalari (o'qish + yozish) — faqat boss (egasi/ADMIN). CREATOR kira olmaydi.
@Roles(...BOSS_ROLES)
class AdminSettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentAdmin() admin: Admin) {
    // Faqat oq ro'yxatdagi kalitlar — boshqa platforma-darajadagi sozlamalar
    // (masalan, super-admin kalitlari) bu yerda chiqmasin.
    const prefix = admin.tenantId ? `t:${admin.tenantId}:` : '';
    const keys = ALLOWED_KEYS.map((k) => tenantKey(admin.tenantId, k));
    const rows = await this.prisma.settings.findMany({ where: { key: { in: keys } } });
    // Klientga QISQA kalit qaytaramiz — UI prefiks haqida bilmasligi kerak.
    return rows.map((r) => ({ ...r, key: prefix ? r.key.slice(prefix.length) : r.key }));
  }

  @Patch()
  @Roles(AdminRole.SUPERADMIN, AdminRole.ADMIN)
  async upsert(@CurrentAdmin() admin: Admin, @Body() dto: UpsertSettingDto) {
    // DTO darajasida @IsIn tekshirgan, lekin sub'-payload xavfsiz bo'lishi
    // uchun JSON o'lchamiga ham cheklov qo'yamiz (~64KB).
    const serialized = JSON.stringify(dto.value);
    if (serialized.length > 64 * 1024) {
      throw new BadRequestException('Setting value too large (max 64KB)');
    }
    const value = dto.value as Prisma.InputJsonValue;
    const key = tenantKey(admin.tenantId, dto.key);
    const row = await this.prisma.settings.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    return { ...row, key: dto.key };
  }
}

@Module({
  imports: [AdminAuthModule],
  controllers: [AdminSettingsController],
})
export class AdminSettingsModule {}
