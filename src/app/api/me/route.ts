import { getCurrentUser } from "@/lib/auth";
import { ok, fail } from "@/lib/http";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return ok({ user });
  } catch (e) {
    return fail(e);
  }
}
