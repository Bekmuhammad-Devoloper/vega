import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/http";

// GET /api/wallet — balans + oxirgi tranzaksiyalar
export async function GET() {
  try {
    const user = await requireUser();
    const transactions = await prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return ok({ balance: user.balance, transactions });
  } catch (e) {
    return fail(e);
  }
}
