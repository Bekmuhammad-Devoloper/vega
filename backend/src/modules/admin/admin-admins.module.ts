import { BadRequestException, Body, Controller, Delete, Get, Module, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { AdminRole, type Admin } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '@/prisma/prisma.service';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { Roles, RolesGuard, CurrentAdmin } from '../admin-auth/roles.guard';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';

class CreateAdminDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(6) password!: string;
  @IsString() @MinLength(2) fullName!: string;
  @IsEnum(AdminRole) role!: AdminRole;
}

class UpdateAdminDto {
  @IsOptional() @IsString() @MinLength(2) fullName?: string;
  @IsOptional() @IsEnum(AdminRole) role?: AdminRole;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MinLength(6) password?: string;
}

function serialize(a: { id: string; email: string; fullName: string; role: AdminRole; isActive: boolean; createdAt: Date }) {
  return {
    id: a.id,
    email: a.email,
    fullName: a.fullName,
    role: a.role,
    isActive: a.isActive,
    createdAt: a.createdAt,
  };
}

@Controller('admin/admins')
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.SUPERADMIN)
class AdminAdminsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * DIQQAT — ko'p-ijarachi izolyatsiya: bu modul ilgari HECH QANDAY tenant
   * filtri ishlatmasdi, ya'ni chaqiruvchi butun platformadagi adminlarni
   * ko'rar, tahrirlar va o'chira olardi. Hozircha `@Roles(SUPERADMIN)` uni
   * amalda platforma egasi bilan cheklaydi (do'kon egalari ADMIN roli oladi),
   * lekin qulf bitta bo'lishi xavfli. Endi tenantli chaqiruvchi FAQAT o'z
   * do'koni adminlarini ko'radi; platforma egasi (tenantId yo'q) — hammasini.
   */
  private scope(admin: Admin) {
    return admin.tenantId ? { tenantId: admin.tenantId } : {};
  }

  /** Boshqa do'kon adminiga tegishга urinishda 404 (403 emas — mavjudligini oshkor qilmaymiz). */
  private async assertInScope(admin: Admin, id: string): Promise<void> {
    const target = await this.prisma.admin.findFirst({
      where: { id, ...this.scope(admin) },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('Admin topilmadi');
  }

  @Get()
  async list(@CurrentAdmin() admin: Admin) {
    const rows = await this.prisma.admin.findMany({
      where: this.scope(admin),
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
    });
    return rows.map(serialize);
  }

  @Post()
  async create(@CurrentAdmin() admin: Admin, @Body() dto: CreateAdminDto) {
    // Do'kon konteksti SUPERADMIN (platforma darajasi) yarata olmaydi —
    // aks holda o'zini platforma egasiga aylantirib olardi.
    if (admin.tenantId && dto.role === AdminRole.SUPERADMIN) {
      throw new BadRequestException('Bu rolni tayinlash mumkin emas');
    }
    const existing = await this.prisma.admin.findUnique({ where: { email: dto.email.toLowerCase().trim() } });
    if (existing) throw new BadRequestException('Email already exists');
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const created = await this.prisma.admin.create({
      data: {
        email: dto.email.toLowerCase().trim(),
        passwordHash,
        fullName: dto.fullName,
        role: dto.role,
        // Yangi admin chaqiruvchining do'koniga biriktiriladi.
        tenantId: admin.tenantId,
      },
    });
    return serialize(created);
  }

  @Patch(':id')
  async update(@CurrentAdmin() admin: Admin, @Param('id') id: string, @Body() dto: UpdateAdminDto) {
    await this.assertInScope(admin, id);
    if (admin.tenantId && dto.role === AdminRole.SUPERADMIN) {
      throw new BadRequestException('Bu rolni tayinlash mumkin emas');
    }
    const data: {
      fullName?: string;
      role?: AdminRole;
      isActive?: boolean;
      passwordHash?: string;
    } = {
      fullName: dto.fullName,
      role: dto.role,
      isActive: dto.isActive,
    };
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 12);
    }
    const updated = await this.prisma.admin.update({ where: { id }, data });
    return serialize(updated);
  }

  @Delete(':id')
  async delete(@CurrentAdmin() admin: Admin, @Param('id') id: string) {
    await this.assertInScope(admin, id);
    if (admin.id === id) throw new BadRequestException("O'zingizni o'chira olmaysiz");
    await this.prisma.admin.update({ where: { id }, data: { isActive: false } });
    return { ok: true };
  }
}

@Module({
  imports: [AdminAuthModule],
  controllers: [AdminAdminsController],
})
export class AdminAdminsModule {}
