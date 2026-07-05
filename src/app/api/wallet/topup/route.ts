import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createTopup } from "@/lib/payments";
import { ok, fail } from "@/lib/http";
import { limitOr429 } from "@/lib/ratelimit";

const schema = z.object({
  amount: z.number().int().positive(),
  method: z.string().min(1),
});

// POST /api/wallet/topup — balans to'ldirishni boshlash
export async function POST(req: Request) {
  try {
    const limited = limitOr429(req, "topup", 20, 60_000);
    if (limited) return limited;

    const user = await requireUser();
    const { amount, method } = schema.parse(await req.json());
    const result = await createTopup(user.id, amount, method);
    return ok(result);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json({ error: "Ma'lumotlar noto'g'ri" }, { status: 400 });
    }
    return fail(e);
  }
}
