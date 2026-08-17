/**
 * VEGA seed — platforma egasi + bir-martalik tariflar + xizmatlar + davlatlar.
 *
 * Ishga tushirish:
 *   cd backend && npx ts-node prisma/seed.ts
 * Override:
 *   SUPER_SEED_EMAIL=owner@vega.uz SUPER_SEED_PASSWORD=Str0ng! npx ts-node prisma/seed.ts
 */
import { PrismaClient, PlatformRole, TariffPlan, DigitalKind } from '@prisma/client';
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

// ── Xizmatlar (HeroSMS kodi; telegram = SPIDER real SIM) ──
const SERVICES = [
  { slug: 'telegram', nameUz: 'Telegram', nameRu: 'Telegram', emoji: '✈️', heroCode: 'tg', telegramOnly: true, position: 1 },
  { slug: 'whatsapp', nameUz: 'WhatsApp', nameRu: 'WhatsApp', emoji: '💬', heroCode: 'wa', telegramOnly: false, position: 2 },
  { slug: 'instagram', nameUz: 'Instagram', nameRu: 'Instagram', emoji: '📸', heroCode: 'ig', telegramOnly: false, position: 3 },
  { slug: 'google', nameUz: 'Google / Gmail', nameRu: 'Google / Gmail', emoji: '🔴', heroCode: 'go', telegramOnly: false, position: 4 },
  { slug: 'facebook', nameUz: 'Facebook', nameRu: 'Facebook', emoji: '👍', heroCode: 'fb', telegramOnly: false, position: 5 },
  { slug: 'tiktok', nameUz: 'TikTok', nameRu: 'TikTok', emoji: '🎵', heroCode: 'lf', telegramOnly: false, position: 6 },
  { slug: 'twitter', nameUz: 'Twitter / X', nameRu: 'Twitter / X', emoji: '🐦', heroCode: 'tw', telegramOnly: false, position: 7 },
  { slug: 'viber', nameUz: 'Viber', nameRu: 'Viber', emoji: '🟣', heroCode: 'vi', telegramOnly: false, position: 8 },
  { slug: 'uber', nameUz: 'Uber', nameRu: 'Uber', emoji: '🚗', heroCode: 'ub', telegramOnly: false, position: 9 },
];

// ── Davlatlar (iso2 = SPIDER; heroCode = HeroSMS) ──
const COUNTRIES = [
  { slug: 'uzbekistan', nameUz: 'O’zbekiston', nameRu: 'Узбекистан', flag: '🇺🇿', iso2: 'UZ', heroCode: '40' },
  { slug: 'usa', nameUz: 'AQSH', nameRu: 'США', flag: '🇺🇸', iso2: 'US', heroCode: '187' },
  { slug: 'kazakhstan', nameUz: 'Qozog’iston', nameRu: 'Казахстан', flag: '🇰🇿', iso2: 'KZ', heroCode: '2' },
  { slug: 'ukraine', nameUz: 'Ukraina', nameRu: 'Украина', flag: '🇺🇦', iso2: 'UA', heroCode: '1' },
  { slug: 'uk', nameUz: 'Angliya', nameRu: 'Англия', flag: '🇬🇧', iso2: 'GB', heroCode: '16' },
  { slug: 'india', nameUz: 'Hindiston', nameRu: 'Индия', flag: '🇮🇳', iso2: 'IN', heroCode: '22' },
  { slug: 'indonesia', nameUz: 'Indoneziya', nameRu: 'Индонезия', flag: '🇮🇩', iso2: 'ID', heroCode: '6' },
  { slug: 'philippines', nameUz: 'Filippin', nameRu: 'Филиппины', flag: '🇵🇭', iso2: 'PH', heroCode: '4' },
  { slug: 'vietnam', nameUz: 'Vetnam', nameRu: 'Вьетнам', flag: '🇻🇳', iso2: 'VN', heroCode: '10' },
  { slug: 'pakistan', nameUz: 'Pokiston', nameRu: 'Пакистан', flag: '🇵🇰', iso2: 'PK', heroCode: '66' },
  { slug: 'bangladesh', nameUz: 'Bangladesh', nameRu: 'Бангладеш', flag: '🇧🇩', iso2: 'BD', heroCode: '60' },
  { slug: 'thailand', nameUz: 'Tailand', nameRu: 'Таиланд', flag: '🇹🇭', iso2: 'TH', heroCode: '52' },
  { slug: 'malaysia', nameUz: 'Malayziya', nameRu: 'Малайзия', flag: '🇲🇾', iso2: 'MY', heroCode: '7' },
  { slug: 'myanmar', nameUz: 'Myanma', nameRu: 'Мьянма', flag: '🇲🇲', iso2: 'MM', heroCode: '5' },
  { slug: 'china', nameUz: 'Xitoy', nameRu: 'Китай', flag: '🇨🇳', iso2: 'CN', heroCode: '3' },
  { slug: 'turkey', nameUz: 'Turkiya', nameRu: 'Турция', flag: '🇹🇷', iso2: 'TR', heroCode: '62' },
  { slug: 'saudi', nameUz: 'Saudiya', nameRu: 'Саудовская Аравия', flag: '🇸🇦', iso2: 'SA', heroCode: '53' },
  { slug: 'oman', nameUz: 'Ummon', nameRu: 'Оман', flag: '🇴🇲', iso2: 'OM', heroCode: '107' },
  { slug: 'egypt', nameUz: 'Misr', nameRu: 'Египет', flag: '🇪🇬', iso2: 'EG', heroCode: '21' },
  { slug: 'morocco', nameUz: 'Marokko', nameRu: 'Марокко', flag: '🇲🇦', iso2: 'MA', heroCode: '37' },
  { slug: 'nigeria', nameUz: 'Nigeriya', nameRu: 'Нигерия', flag: '🇳🇬', iso2: 'NG', heroCode: '19' },
  { slug: 'kenya', nameUz: 'Keniya', nameRu: 'Кения', flag: '🇰🇪', iso2: 'KE', heroCode: '8' },
  { slug: 'ghana', nameUz: 'Gana', nameRu: 'Гана', flag: '🇬🇭', iso2: 'GH', heroCode: '38' },
  { slug: 'south_africa', nameUz: 'Janubiy Afrika', nameRu: 'ЮАР', flag: '🇿🇦', iso2: 'ZA', heroCode: '31' },
  { slug: 'brazil', nameUz: 'Braziliya', nameRu: 'Бразилия', flag: '🇧🇷', iso2: 'BR', heroCode: '73' },
  { slug: 'argentina', nameUz: 'Argentina', nameRu: 'Аргентина', flag: '🇦🇷', iso2: 'AR', heroCode: '39' },
  { slug: 'chile', nameUz: 'Chili', nameRu: 'Чили', flag: '🇨🇱', iso2: 'CL', heroCode: '151' },
  { slug: 'colombia', nameUz: 'Kolumbiya', nameRu: 'Колумбия', flag: '🇨🇴', iso2: 'CO', heroCode: '33' },
  { slug: 'mexico', nameUz: 'Meksika', nameRu: 'Мексика', flag: '🇲🇽', iso2: 'MX', heroCode: '54' },
  { slug: 'canada', nameUz: 'Kanada', nameRu: 'Канада', flag: '🇨🇦', iso2: 'CA', heroCode: '36' },
  { slug: 'germany', nameUz: 'Germaniya', nameRu: 'Германия', flag: '🇩🇪', iso2: 'DE', heroCode: '43' },
  { slug: 'france', nameUz: 'Fransiya', nameRu: 'Франция', flag: '🇫🇷', iso2: 'FR', heroCode: '78' },
  { slug: 'spain', nameUz: 'Ispaniya', nameRu: 'Испания', flag: '🇪🇸', iso2: 'ES', heroCode: '56' },
  { slug: 'italy', nameUz: 'Italiya', nameRu: 'Италия', flag: '🇮🇹', iso2: 'IT', heroCode: '86' },
  { slug: 'netherlands', nameUz: 'Niderlandiya', nameRu: 'Нидерланды', flag: '🇳🇱', iso2: 'NL', heroCode: '48' },
  { slug: 'poland', nameUz: 'Polsha', nameRu: 'Польша', flag: '🇵🇱', iso2: 'PL', heroCode: '15' },
  { slug: 'romania', nameUz: 'Ruminiya', nameRu: 'Румыния', flag: '🇷🇴', iso2: 'RO', heroCode: '32' },
];

// ── Stars paketlari + Premium rejalari (dev panel narxlarni tahrirlaydi) ──
const DIGITAL = [
  { kind: DigitalKind.STARS, label: '50 Stars', amount: 50, wholesaleUsd: 0.85, position: 1 },
  { kind: DigitalKind.STARS, label: '100 Stars', amount: 100, wholesaleUsd: 1.6, position: 2 },
  { kind: DigitalKind.STARS, label: '250 Stars', amount: 250, wholesaleUsd: 3.9, position: 3 },
  { kind: DigitalKind.STARS, label: '500 Stars', amount: 500, wholesaleUsd: 7.6, position: 4 },
  { kind: DigitalKind.STARS, label: '1000 Stars', amount: 1000, wholesaleUsd: 15.0, position: 5 },
  { kind: DigitalKind.PREMIUM, label: 'Premium 3 oy', amount: 3, wholesaleUsd: 12.0, position: 6 },
  { kind: DigitalKind.PREMIUM, label: 'Premium 6 oy', amount: 6, wholesaleUsd: 18.0, position: 7 },
  { kind: DigitalKind.PREMIUM, label: 'Premium 12 oy', amount: 12, wholesaleUsd: 30.0, position: 8 },
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
