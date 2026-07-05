import { availableMethods } from "@/lib/payments";
import { config } from "@/lib/config";
import { ok, fail } from "@/lib/http";

// GET /api/payments/methods — mavjud to'lov usullari + limitlar
export async function GET() {
  try {
    return ok({
      methods: availableMethods(),
      minTopup: config.minTopup,
      maxTopup: config.maxTopup,
    });
  } catch (e) {
    return fail(e);
  }
}
