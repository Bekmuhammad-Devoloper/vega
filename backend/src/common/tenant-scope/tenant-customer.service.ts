import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

/**
 * Do'kon <-> mijoz bog'lanishini yozib boradi (`TenantCustomer`).
 *
 * NEGA KERAK: `User` global model — bitta Telegram akkaunt butun platformada
 * bitta yozuv. Mijoz qaysi do'konga tegishli ekani ilgari faqat BUYURTMA
 * orqali bilvosita chiqarilardi, shuning uchun botga /start bosgan yoki
 * do'konni ochib chiqqan, ammo hali xarid qilmagan mijoz sotuvchi panelida
 * umuman ko'rinmasdi.
 *
 * `touch()` har so'rovda chaqiriladi, shuning uchun bazaga urilishni
 * kamaytiramiz: xotiradagi kesh orqali bir juftlik uchun har TTL da bir marta
 * yoziladi. Kesh yo'qolsa (qayta ishga tushirish) — eng yomoni bitta ortiqcha
 * upsert bo'ladi, ma'lumot yo'qolmaydi.
 */
@Injectable()
export class TenantCustomerService {
  private readonly logger = new Logger(TenantCustomerService.name);
  private readonly seen = new Map<string, number>();
  private static readonly TTL_MS = 5 * 60 * 1000;
  private static readonly MAX_KEYS = 10_000;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Mijozni do'kon mijozi sifatida belgilaydi (bor bo'lsa `lastSeenAt`ni
   * yangilaydi). Xato bo'lsa YUTILADI — bu yordamchi yozuv hech qachon
   * asosiy so'rovni (xarid, kirish) buzmasligi kerak.
   */
  async touch(
    tenantId: string | null | undefined,
    userId: string | null | undefined,
    source: 'BOT' | 'WEBAPP' = 'WEBAPP',
  ): Promise<void> {
    if (!tenantId || !userId) return;
    const key = `${tenantId}:${userId}`;
    const now = Date.now();
    const last = this.seen.get(key);
    if (last && now - last < TenantCustomerService.TTL_MS) return;

    // Keshni cheklaymiz — uzoq ishlaganda xotira o'sib ketmasin.
    if (this.seen.size >= TenantCustomerService.MAX_KEYS) this.seen.clear();
    this.seen.set(key, now);

    try {
      await this.prisma.tenantCustomer.upsert({
        where: { tenantId_userId: { tenantId, userId } },
        update: { lastSeenAt: new Date() },
        create: { tenantId, userId, source },
      });
    } catch (err) {
      // Keshdan o'chiramiz, keyingi so'rovda qayta urinilsin.
      this.seen.delete(key);
      this.logger.warn(`TenantCustomer yozilmadi: ${(err as Error).message}`);
    }
  }
}
