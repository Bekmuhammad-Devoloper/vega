import { PrismaClient } from "@prisma/client";

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
