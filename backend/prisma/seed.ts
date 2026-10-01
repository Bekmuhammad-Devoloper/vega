/**
 * VEGA seed — platforma egasi + bir-martalik tariflar + xizmatlar + davlatlar.
 *
 * Ishga tushirish:
 *   cd backend && npx ts-node prisma/seed.ts
 * Override:
 *   SUPER_SEED_EMAIL=owner@vega.uz SUPER_SEED_PASSWORD=Str0ng! npx ts-node prisma/seed.ts
 */
import { PrismaClient, PlatformRole, TariffPlan, DigitalKind } from '@prisma/client';
import { SERVICES, COUNTRIES } from './catalog-data';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ── Bir-martalik faollashtirish tariflari (superadmin panelda tahrirlanadi) ──
const TARIFFS = [
  {
    plan: TariffPlan.FREE,
    oneTimePrice: 0,
    maxServices: 3,
    maxCountries: 5,
    maxAdmins: 1,
    customBot: false,
    customDomain: false,
    whiteLabel: false,
    features: { referral: true, broadcast: false, analytics: 'basic', support: false },
    description: 'Sinab ko’rish uchun',
    position: 1,
  },
  {
    plan: TariffPlan.STANDARD,
    oneTimePrice: 490_000,
    maxServices: 20,
    maxCountries: 20,
    maxAdmins: 2,
    customBot: true,
    customDomain: false,
    whiteLabel: false,
    features: { referral: true, broadcast: true, analytics: 'basic', support: '24/7' },
    description: 'Boshlovchi reseller uchun',
    position: 2,
  },
  {
    plan: TariffPlan.PRO,
    oneTimePrice: 990_000,
    maxServices: 999,
    maxCountries: 999,
    maxAdmins: 5,
    customBot: true,
    customDomain: false,
    whiteLabel: false,
    features: { referral: true, broadcast: true, analytics: 'pro', support: 'priority' },
    badge: 'ENG MASHHUR',
    description: 'Faol reseller uchun',
    position: 3,
  },
  {
    plan: TariffPlan.PREMIUM,
    oneTimePrice: 1_990_000,
    maxServices: 999,
    maxCountries: 999,
    maxAdmins: 999,
    customBot: true,
    customDomain: true,
    whiteLabel: true,
    features: { referral: true, broadcast: true, analytics: 'pro+', support: 'dedicated' },
    description: 'O’z brendi bilan ishlaydiganlar uchun',
    position: 4,
  },
];



// ── Stars paketlari + Premium rejalari (dev panel narxlarni tahrirlaydi) ──
const DIGITAL = [
  { kind: DigitalKind.STARS, label: '50 Stars', amount: 50, wholesaleUsd: 0.85, position: 1 },
  { kind: DigitalKind.STARS, label: '100 Stars', amount: 100, wholesaleUsd: 1.6, position: 2 },
  { kind: DigitalKind.STARS, label: '250 Stars', amount: 250, wholesaleUsd: 3.9, position: 3 },
  { kind: DigitalKind.STARS, label: '500 Stars', amount: 500, wholesaleUsd: 7.6, position: 4 },
  { kind: DigitalKind.STARS, label: '1000 Stars', amount: 1000, wholesaleUsd: 15.0, position: 5 },
  // Premium tannarxi iStar'da TON kursiga qarab O'ZGARADI. Quyidagilar —
  // 2026-08 dagi jonli narx + 10% platforma ustamasi. Eskirmasligi uchun
  // vaqti-vaqti bilan: `npm run digital:sync` (iStar'dan jonli oladi).
  { kind: DigitalKind.PREMIUM, label: 'Premium 3 oy', amount: 3, wholesaleUsd: 13.85, position: 6 },
  { kind: DigitalKind.PREMIUM, label: 'Premium 6 oy', amount: 6, wholesaleUsd: 18.47, position: 7 },
  { kind: DigitalKind.PREMIUM, label: 'Premium 12 oy', amount: 12, wholesaleUsd: 33.48, position: 8 },
];

async function main(): Promise<void> {
  // 1) Platforma egasi (superadmin)
  const ownerEmail = (process.env.SUPER_SEED_EMAIL ?? 'owner@vega.uz').toLowerCase().trim();
  const ownerPassword = process.env.SUPER_SEED_PASSWORD ?? 'SuperOwner123!';
  const ownerName = process.env.SUPER_SEED_FULLNAME ?? 'Vega Owner';
  const passwordHash = await bcrypt.hash(ownerPassword, 12);
  await prisma.platformAdmin.upsert({
    where: { email: ownerEmail },
    update: { passwordHash, fullName: ownerName },
    create: { email: ownerEmail, passwordHash, fullName: ownerName, role: PlatformRole.OWNER, isActive: true },
  });
  console.log(`✓ Platform OWNER: ${ownerEmail} / ${ownerPassword}`);

  // 2) Bir-martalik tariflar
  for (const t of TARIFFS) {
    await prisma.tariffConfig.upsert({
      where: { plan: t.plan },
      update: { ...t },
      create: { ...t },
    });
  }
  console.log(`✓ ${TARIFFS.length} tarif`);

  // 3) Xizmatlar
  for (const s of SERVICES) {
    await prisma.service.upsert({ where: { slug: s.slug }, update: s, create: s });
  }
  console.log(`✓ ${SERVICES.length} xizmat`);

  // 4) Davlatlar
  let pos = 0;
  for (const c of COUNTRIES) {
    pos += 1;
    await prisma.country.upsert({
      where: { slug: c.slug },
      update: { ...c, position: pos },
      create: { ...c, position: pos },
    });
  }
  console.log(`✓ ${COUNTRIES.length} davlat`);

  // 5) Stars / Premium mahsulotlari
  for (const d of DIGITAL) {
    await prisma.digitalProduct.upsert({
      where: { kind_amount: { kind: d.kind, amount: d.amount } },
      update: { label: d.label, wholesaleUsd: d.wholesaleUsd, position: d.position },
      create: d,
    });
  }
  console.log(`✓ ${DIGITAL.length} raqamli mahsulot (Stars/Premium)`);

  console.log('\n🎉 Vega seed complete!');
  console.log('   Superadmin: ' + ownerEmail + ' / ' + ownerPassword);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
