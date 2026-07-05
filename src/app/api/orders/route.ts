import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buyNumber } from "@/lib/orders";
import { ok, fail } from "@/lib/http";
import { limitOr429 } from "@/lib/ratelimit";

const schema = z.object({
  product: z.string().min(1),
  country: z.string().min(1),
});

// GET /api/orders — foydalanuvchi buyurtmalari (tarix)
export async function GET() {
  try {
    const user = await requireUser();
    const orders = await prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return ok({ orders });
  } catch (e) {
    return fail(e);
  }
}

// POST /api/orders — yangi raqam sotib olish
export async function POST(req: Request) {
  try {
    const limited = limitOr429(req, "buy", 30, 60_000);
    if (limited) return limited;

    const user = await requireUser();
    const { product, country } = schema.parse(await req.json());
    const order = await buyNumber(user.id, product, country);
    return ok({ order });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json({ error: "Ma'lumotlar noto'g'ri" }, { status: 400 });
    }
    return fail(e);
  }
}
