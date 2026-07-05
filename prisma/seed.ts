import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@vega.uz";
  const password = "admin123";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin allaqachon mavjud: ${email}`);
    return;
  }

  const admin = await prisma.user.create({
    data: {
      email,
      name: "Admin",
      passwordHash: await bcrypt.hash(password, 10),
      role: "ADMIN",
      balance: 100_000, // sinov uchun boshlang'ich balans
    },
  });

  console.log("✓ Admin yaratildi:");
  console.log(`  email:  ${admin.email}`);
  console.log(`  parol:  ${password}`);
  console.log(`  balans: ${admin.balance.toLocaleString("ru-RU")} so'm`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
