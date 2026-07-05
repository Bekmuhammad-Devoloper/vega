import { AuthError } from "@/lib/auth";
import { OrderError } from "@/lib/orders";
import { PaymentError } from "@/lib/payments";

/** Muvaffaqiyatli JSON javob. */
export function ok(data: unknown, status = 200) {
  return Response.json(data, { status });
}

/** Xatolikni mos status bilan JSON qilib qaytaradi. */
export function fail(e: unknown) {
  if (
    e instanceof AuthError ||
    e instanceof OrderError ||
    e instanceof PaymentError
  ) {
    return Response.json({ error: e.message }, { status: e.status });
  }
  const message = e instanceof Error ? e.message : "Server xatosi";
  console.error("API error:", e);
  return Response.json({ error: message }, { status: 500 });
}
