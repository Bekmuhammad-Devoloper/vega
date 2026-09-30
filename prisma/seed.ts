import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@vega.uz")
    .trim()
    .toLowerCase();

  // Parol .env'dan olinadi. Ishlab chiqarishda MAJBURIY — qat'iy yozilgan
  // zaif parol (masalan "admin123") bilan ADMIN yaratib qo'yish xavfli.
  const envPass = process.env.SEED_ADMIN_PASSWORD?.trim();
  if (process.env.NODE_ENV === "production" && !envPass) {
    console.error(
      "✗ Ishlab chiqarishda SEED_ADMIN_PASSWORD majburiy. Seed to'xtatildi."
    );
    process.exit(1);
  }
  // Dev uchun berilmasa — tasodifiy kuchli parol yaratamiz (bir marta ko'rsatiladi).
  const generated = !envPass;
  const password = envPass || randomBytes(12).toString("base64url");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Mavjud foydalanuvchi: kerak bo'lsa ADMIN qilamiz va (parol berilgan
    // bo'lsa) parolni tiklaymiz. Aks holda tasodifiy parol yo'qolgach adminga
    // kirishning iloji qolmasdi.
    const data: { role?: string; passwordHash?: string } = {};
    if (existing.role !== "ADMIN") data.role = "ADMIN";
    if (envPass) data.passwordHash = await bcrypt.hash(envPass, 10);

    if (Object.keys(data).length === 0) {
      console.log(`Admin allaqachon mavjud: ${email} (o'zgarish kerak emas)`);
      console.log(
        "  Parolni tiklash uchun SEED_ADMIN_PASSWORD berib qayta ishga tushiring."
      );
      return;
    }
    await prisma.user.update({ where: { email }, data });
    console.log(`✓ Yangilandi: ${email}`);
    if (data.role) console.log("  role -> ADMIN");
    if (data.passwordHash) console.log("  parol -> SEED_ADMIN_PASSWORD'dan tiklandi");
    return;
  }

  const admin = await prisma.user.create({
    data: {
      email,
      name: "Admin",
      passwordHash: await bcrypt.hash(password, 10),
      role: "ADMIN",
      balance: 0,
    },
  });

  console.log("✓ Admin yaratildi:");
  console.log(`  email:  ${admin.email}`);
  if (generated) {
    // Faqat biz yaratgan tasodifiy parolni ko'rsatamiz (env'dagi parolni emas).
    console.log(`  parol:  ${password}   (tasodifiy — saqlab qo'ying!)`);
  } else {
    console.log(`  parol:  (SEED_ADMIN_PASSWORD'dan olindi)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
