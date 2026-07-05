import { requireUser } from "@/lib/auth";
import { cancelOrder } from "@/lib/orders";
import { ok, fail } from "@/lib/http";

// POST /api/orders/:id/cancel — bekor qilish + pulni qaytarish
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const order = await cancelOrder(id, user.id);
    return ok({ order });
  } catch (e) {
    return fail(e);
  }
}
