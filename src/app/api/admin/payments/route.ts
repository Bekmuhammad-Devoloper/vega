import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/http";

// GET /api/admin/payments — kutilayotgan to'lovlar
export async function GET() {
  try {
    await requireAdmin();
    const payments = await prisma.payment.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { email: true } } },
      take: 100,
    });
    return ok({ payments });
  } catch (e) {
    return fail(e);
  }
}
