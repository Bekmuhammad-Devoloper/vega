import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '@/prisma/prisma.service';
import type { PlatformAdmin, PlatformRole } from '@prisma/client';

@Injectable()
export class SuperTeamService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.platformAdmin.findMany({
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async getById(id: string) {
    const admin = await this.prisma.platformAdmin.findUnique({ where: { id } });
    if (!admin) throw new NotFoundException('Admin not found');
    return admin;
  }

  async create(data: {
    email: string;
    password: string;
    fullName: string;
    role: PlatformRole;
  }): Promise<PlatformAdmin> {
    const email = data.email.toLowerCase().trim();
    const exists = await this.prisma.platformAdmin.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Email already in use');
    if (data.password.length < 12) {
      throw new BadRequestException('Password must be at least 12 characters');
    }
    const passwordHash = await bcrypt.hash(data.password, 12);
    return this.prisma.platformAdmin.create({
      data: {
        email,
        passwordHash,
        fullName: data.fullName.trim(),
        role: data.role,
        isActive: true,
      },
    });
  }

  async update(
    id: string,
    data: { fullName?: string; role?: PlatformRole; isActive?: boolean },
  ): Promise<PlatformAdmin> {
    return this.prisma.platformAdmin.update({
      where: { id },
      data: {
        fullName: data.fullName?.trim(),
        role: data.role,
        isActive: data.isActive,
      },
    });
  }

  async resetPassword(id: string, newPassword: string): Promise<void> {
    if (newPassword.length < 12) {
      throw new BadRequestException('Password must be at least 12 characters');
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.platformAdmin.update({
      where: { id },
      data: { passwordHash },
    });
    // Revoke all refresh tokens — force re-login
    await this.prisma.platformRefreshToken.updateMany({
      where: { adminId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async deactivate(id: string): Promise<PlatformAdmin> {
    await this.prisma.platformRefreshToken.updateMany({
      where: { adminId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return this.prisma.platformAdmin.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async activate(id: string): Promise<PlatformAdmin> {
    return this.prisma.platformAdmin.update({
      where: { id },
      data: { isActive: true },
    });
  }
}
