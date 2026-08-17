import { Controller, Get, UseGuards } from '@nestjs/common';
import * as os from 'os';
import { PrismaService } from '@/prisma/prisma.service';
import { SuperJwtGuard, PlatformRoles, PlatformRolesGuard } from './super-jwt.guard';

@Controller('super-admin/infrastructure')
@UseGuards(SuperJwtGuard, PlatformRolesGuard)
@PlatformRoles('DEVOPS')
export class SuperInfraController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  async health() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    const cpus = os.cpus();
    const cpuUsage = process.cpuUsage();
    const procMem = process.memoryUsage();

    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      uptime: {
        os: os.uptime(),
        process: process.uptime(),
      },
      memory: {
        totalGb: totalMem / 1024 ** 3,
        freeGb: freeMem / 1024 ** 3,
        usedGb: usedMem / 1024 ** 3,
        usedPct: (usedMem / totalMem) * 100,
        processRssMb: procMem.rss / 1024 ** 2,
        processHeapMb: procMem.heapUsed / 1024 ** 2,
      },
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model ?? 'Unknown',
        speed: cpus[0]?.speed ?? 0,
        loadAvg: os.loadavg(),
        userMs: cpuUsage.user / 1000,
        systemMs: cpuUsage.system / 1000,
      },
    };
  }

  @Get('database')
  async database() {
    const tables = [
      'Tenant',
      'Subscription',
      'Invoice',
      'NumberOrder',
      'Service',
      'Country',
      'WalletTransaction',
      'User',
      'UserEvent',
      'PlatformAuditLog',
    ];

    const counts = await Promise.all(
      tables.map(async (t) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const model = (this.prisma as any)[t[0].toLowerCase() + t.slice(1)];
          const count = await model.count();
          return { table: t, count };
        } catch {
          return { table: t, count: 0 };
        }
      }),
    );

    type SizeRow = { total_size: string; total_bytes: number };
    let totalSize = '0 MB';
    let totalBytes = 0;
    try {
      const result = await this.prisma.$queryRaw<SizeRow[]>`
        SELECT
          pg_size_pretty(pg_database_size(current_database())) AS total_size,
          pg_database_size(current_database())::text AS total_bytes
      `;
      if (result[0]) {
        totalSize = result[0].total_size;
        totalBytes = Number(result[0].total_bytes);
      }
    } catch {
      // ignore
    }

    return {
      tables: counts.sort((a, b) => b.count - a.count),
      totalSize,
      totalBytes,
      sizeMb: totalBytes / 1024 ** 2,
    };
  }

  @Get('jobs')
  async jobs() {
    // Kanal postlari navbati (rejalashtirilgan → chop etilgan/xato)
    const [pending, sent, failed] = await Promise.all([
      this.prisma.channelPost.count({ where: { status: 'SCHEDULED' } }),
      this.prisma.channelPost.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.channelPost.count({ where: { status: 'FAILED' } }),
    ]);

    const broadcasts = await this.prisma.broadcast.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        status: true,
        totalCount: true,
        sentCount: true,
        failedCount: true,
        createdAt: true,
      },
    });

    return {
      channelPosts: { pending, sent, failed },
      broadcasts,
    };
  }
}
