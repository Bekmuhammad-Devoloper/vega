import { BadRequestException, Body, Controller, Delete, Get, Module, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { AdminRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '@/prisma/prisma.service';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { Roles, RolesGuard } from '../admin-auth/roles.guard';
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

  @Get()
  async list() {
    const rows = await this.prisma.admin.findMany({
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
    });
    return rows.map(serialize);
  }

  @Post()
  async create(@Body() dto: CreateAdminDto) {
    const existing = await this.prisma.admin.findUnique({ where: { email: dto.email.toLowerCase().trim() } });
    if (existing) throw new BadRequestException('Email already exists');
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const created = await this.prisma.admin.create({
      data: {
        email: dto.email.toLowerCase().trim(),
        passwordHash,
        fullName: dto.fullName,
        role: dto.role,
      },
    });
    return serialize(created);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateAdminDto) {
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
  async delete(@Param('id') id: string) {
    await this.prisma.admin.update({ where: { id }, data: { isActive: false } });
    return { ok: true };
  }
}

@Module({
  imports: [AdminAuthModule],
  controllers: [AdminAdminsController],
})
export class AdminAdminsModule {}
