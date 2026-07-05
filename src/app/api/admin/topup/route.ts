import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/http";

const schema = z.object({
  email: z.string().email(),
  amount: z.number().int().positive("Summa musbat bo'lishi kerak"),
});

// POST /api/admin/topup — admin foydalanuvchi balansini to'ldiradi
export async function POST(req: Request) {
  try {
    await requireAdmin();
    const { email, amount } = schema.parse(await req.json());

    const target = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!target) {
      return Response.json(
        { error: "Bunday foydalanuvchi topilmadi" },
        { status: 404 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: target.id },
        data: { balance: { increment: amount } },
      });
      await tx.transaction.create({
        data: {
          userId: u.id,
          type: "TOPUP",
          amount,
          balanceAfter: u.balance,
          note: "Admin to'ldirdi",
        },
      });
      return u;
    });

    return ok({ email: updated.email, balance: updated.balance });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json({ error: e.issues[0].message }, { status: 400 });
    }
    return fail(e);
  }
}
