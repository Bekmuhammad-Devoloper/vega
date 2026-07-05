import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { approvePayment, rejectPayment } from "@/lib/payments";
import { ok, fail } from "@/lib/http";

const schema = z.object({ action: z.enum(["approve", "reject"]) });

// POST /api/admin/payments/:id  { action: "approve" | "reject" }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const { action } = schema.parse(await req.json());
    const payment =
      action === "approve"
        ? await approvePayment(id)
        : await rejectPayment(id);
    return ok({ payment });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json({ error: "Noto'g'ri amal" }, { status: 400 });
    }
    return fail(e);
  }
}
