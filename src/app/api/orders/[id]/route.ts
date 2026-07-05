import { requireUser } from "@/lib/auth";
import { pollOrder } from "@/lib/orders";
import { ok, fail } from "@/lib/http";

// GET /api/orders/:id — holatni tekshirish (SMS keldimi?)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const order = await pollOrder(id, user.id);
    return ok({ order });
  } catch (e) {
    return fail(e);
  }
}
