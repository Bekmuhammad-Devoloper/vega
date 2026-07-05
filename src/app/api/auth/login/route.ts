import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, verifyPassword } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { limitOr429 } from "@/lib/ratelimit";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const limited = limitOr429(req, "login", 10, 60_000);
    if (limited) return limited;

    const { email, password } = schema.parse(await req.json());
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return Response.json(
        { error: "Email yoki parol noto'g'ri" },
        { status: 401 }
      );
    }
    await createSession(user.id);
    return ok({ id: user.id, email: user.email, role: user.role });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json({ error: "Ma'lumotlar noto'g'ri" }, { status: 400 });
    }
    return fail(e);
  }
}
