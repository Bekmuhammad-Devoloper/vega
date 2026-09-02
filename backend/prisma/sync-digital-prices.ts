/**
 * Stars/Premium ULGURJI narxlarini iStar'dagi JONLI tannarxga moslaydi.
 *
 * Nega kerak: `DigitalProduct.wholesaleUsd` — platforma resellerdan
 * oladigan narx. iStar narxi TON kursiga bog'liq va o'zgarib turadi;
 * qo'lda yozilgan narx eskirsa, platforma tannarxdan ARZONGA sotib
 * har buyurtmada zarar ko'radi.
 *
 * Ishga tushirish:
 *   cd backend
 *   npx ts-node prisma/sync-digital-prices.ts --dry   # faqat ko'rsatadi
 *   npx ts-node prisma/sync-digital-prices.ts         # yozadi
 *
 * Sozlash (.env):
 *   PLATFORM_DIGITAL_MARGIN_PERCENT   platforma ustamasi, default 10
 *   STARS_USD_PER_1000                1000 Stars tannarxi (USD). Berilsa,
 *                                     Stars paketlari ham qayta hisoblanadi.
 *
 * DIQQAT: iStar'da Stars uchun narx endpointi YO'Q (faqat Premium bor),
 * shuning uchun Stars tannarxini iStar kabinetidan qarab qo'lda beriladi.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient, DigitalKind } from '@prisma/client';

const prisma = new PrismaClient();

interface PremiumPackage {
  months: number;
  usd_value: number;
  ton_value: number;
}

/** `.env` ni qo'lda o'qiymiz — skript uchun yangi paket qo'shmaymiz. */
function loadEnv(): Record<string, string> {
  const path = join(__dirname, '..', '.env');
  const out: Record<string, string> = {};
  let raw = '';
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return process.env as Record<string, string>;
  }
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return { ...out, ...(process.env as Record<string, string>) };
}

const money = (n: number) => '$' + n.toFixed(2);
const round2 = (n: number) => Math.round(n * 100) / 100;

async function fetchPremiumPackages(
  base: string,
  key: string,
): Promise<PremiumPackage[]> {
  const res = await fetch(`${base.replace(/\/$/, '')}/premium/packages`, {
    headers: { 'API-Key': key, Accept: 'application/json' },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`iStar ${res.status}: ${text.slice(0, 150)}`);
  const data: unknown = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error(`iStar javobi kutilmagan: ${text.slice(0, 150)}`);
  return data as PremiumPackage[];
}

async function main(): Promise<void> {
  const dry = process.argv.includes('--dry');
  const env = loadEnv();

  const key = (env.ISTAR_API_KEY ?? '').trim();
  if (!key) throw new Error('ISTAR_API_KEY .env da yo‘q');
  const base = (env.ISTAR_BASE_URL ?? 'https://v1.fragmentapi.com/api/v1/partner').trim();
  const margin = Number(env.PLATFORM_DIGITAL_MARGIN_PERCENT ?? 10);
  if (!Number.isFinite(margin) || margin < 0) {
    throw new Error('PLATFORM_DIGITAL_MARGIN_PERCENT noto‘g‘ri');
  }
  const mult = 1 + margin / 100;

  console.log(`iStar: ${base}`);
  console.log(`Platforma ustamasi: ${margin}%${dry ? '   [DRY RUN — yozilmaydi]' : ''}\n`);

  // ── PREMIUM: jonli tannarx ──
  const packages = await fetchPremiumPackages(base, key);
  console.log('── PREMIUM ──');
  console.log('paket'.padEnd(16), 'eski'.padEnd(9), 'iStar'.padEnd(9), 'yangi'.padEnd(9), 'holat');

  for (const p of packages) {
    const product = await prisma.digitalProduct.findUnique({
      where: { kind_amount: { kind: DigitalKind.PREMIUM, amount: p.months } },
    });
    if (!product) {
      console.log(`${p.months} oy`.padEnd(16), '—'.padEnd(9), money(p.usd_value).padEnd(9), '—'.padEnd(9), 'katalogda YO‘Q');
      continue;
    }
    const old = Number(product.wholesaleUsd);
    const next = round2(p.usd_value * mult);
    // Tannarxdan past sotilayotgan bo'lsa — alohida belgilaymiz.
    const flag = old < p.usd_value ? 'ZARAR EDI → tuzatildi' : next === old ? "o'zgarmadi" : 'yangilandi';
    if (!dry && next !== old) {
      await prisma.digitalProduct.update({
        where: { id: product.id },
        data: { wholesaleUsd: next },
      });
    }
    console.log(
      product.label.padEnd(16),
      money(old).padEnd(9),
      money(p.usd_value).padEnd(9),
      money(next).padEnd(9),
      flag,
    );
  }

  // ── STARS: iStar narx bermaydi, faqat qo'lda kurs bilan ──
  const starsPer1000 = env.STARS_USD_PER_1000 ? Number(env.STARS_USD_PER_1000) : null;
  const stars = await prisma.digitalProduct.findMany({
    where: { kind: DigitalKind.STARS },
    orderBy: { amount: 'asc' },
  });

  console.log('\n── STARS ──');
  if (starsPer1000 == null || !Number.isFinite(starsPer1000)) {
    console.log('STARS_USD_PER_1000 berilmagan — Stars tegilmadi.');
    console.log('Hozirgi narxlar (1 Stars uchun necha $ chiqayotgani):');
    for (const s of stars) {
      const per = Number(s.wholesaleUsd) / s.amount;
      console.log('  ', s.label.padEnd(16), money(Number(s.wholesaleUsd)).padEnd(9), `→ $${per.toFixed(5)}/Stars`);
    }
    console.log('   iStar kabinetidagi 1000 Stars tannarxini .env ga yozing:');
    console.log('   STARS_USD_PER_1000=16.5');
  } else {
    console.log('paket'.padEnd(16), 'eski'.padEnd(9), 'tannarx'.padEnd(9), 'yangi'.padEnd(9), 'holat');
    for (const s of stars) {
      const cost = (starsPer1000 / 1000) * s.amount;
      const old = Number(s.wholesaleUsd);
      const next = round2(cost * mult);
      const flag = old < cost ? 'ZARAR EDI → tuzatildi' : next === old ? "o'zgarmadi" : 'yangilandi';
      if (!dry && next !== old) {
        await prisma.digitalProduct.update({ where: { id: s.id }, data: { wholesaleUsd: next } });
      }
      console.log(s.label.padEnd(16), money(old).padEnd(9), money(cost).padEnd(9), money(next).padEnd(9), flag);
    }
  }

  console.log(dry ? '\nDRY RUN — hech narsa yozilmadi.' : '\n✓ Narxlar yangilandi.');
  console.log('Eslatma: reseller RETAIL narxlari (DigitalOffer) avtomatik o‘zgarmaydi —');
  console.log('tannarx ko‘tarilgan bo‘lsa, sotuvchilarga xabar bering.');
}

main()
  .catch((e: unknown) => {
    console.error('XATO:', e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
