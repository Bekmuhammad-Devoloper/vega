import { PrismaClient, Prisma } from "@prisma/client";

// Next.js dev rejimida hot-reload har safar yangi klient yaratmasligi uchun
// global'da saqlaymiz.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Interaktiv tranzaksiyani "database is locked" (SQLite bir vaqtda bitta
 * yozuvchiga ruxsat beradi — P2034 / SQLITE_BUSY) holatida bir necha marta
 * qayta uradi. Aks holda parallel pul operatsiyalarining "yutqazgani" 500 xato
 * oladi. Guard'lar tranzaksiya ichida bo'lgani uchun qayta urinish xavfsiz.
 */
export async function txRetry<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  tries = 4
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(fn);
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? e);
      const code = (e as { code?: string })?.code;
      const locked =
        code === "P2034" ||
        msg.includes("database is locked") ||
        msg.includes("SQLITE_BUSY") ||
        msg.includes("write conflict") ||
        msg.includes("deadlock");
      if (locked && attempt < tries - 1) {
        await new Promise((r) => setTimeout(r, 25 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
}
