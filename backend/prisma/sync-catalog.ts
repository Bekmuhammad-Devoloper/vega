/**
 * KATALOGNI XAVFSIZ SINXRONLASH — faqat xizmatlar va davlatlar.
 *
 * Nega alohida skript: to'liq `seed.ts` platforma egasining (superadmin)
 * parolini ham upsert qiladi — SUPER_SEED_PASSWORD berilmagan bo'lsa uni
 * DEFAULT parolga QAYTARIB QO'YADI. Ishlab chiqarishda katalog yangilash
 * uchun bu juda xavfli. Bu skript esa FAQAT Service/Country jadvallarini
 * yangilaydi — boshqa hech narsaga tegmaydi.
 *
 * Ishga tushirish (serverda):
 *   cd backend && npx ts-node prisma/sync-catalog.ts
 *
 * Idempotent: slug bo'yicha upsert, xohlagancha qayta ishga tushirsa bo'ladi.
 */
import { PrismaClient } from '@prisma/client';
import { SERVICES, COUNTRIES } from './catalog-data';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  for (const s of SERVICES) {
    await prisma.service.upsert({ where: { slug: s.slug }, update: s, create: s });
  }
  console.log(`✓ ${SERVICES.length} xizmat sinxronlandi`);

  let pos = 0;
  for (const c of COUNTRIES) {
    pos += 1;
    await prisma.country.upsert({
      where: { slug: c.slug },
      update: { ...c, position: pos },
      create: { ...c, position: pos },
    });
  }
  console.log(`✓ ${COUNTRIES.length} davlat sinxronlandi`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
