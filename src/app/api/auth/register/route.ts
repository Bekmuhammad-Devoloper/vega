import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, hashPassword } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { limitOr429 } from "@/lib/ratelimit";

const schema = z.object({
  email: z.string().email("Email noto'g'ri"),
  password: z.string().min(6, "Parol kamida 6 belgi"),
  name: z.string().trim().max(60).optional(),
});

export async function POST(req: Request) {
  try {
    const limited = limitOr429(req, "register", 5, 60_000);
    if (limited) return limited;

    const body = await req.json();
    const { email, password, name } = schema.parse(body);
    const normEmail = email.toLowerCase();

    const exists = await prisma.user.findUnique({ where: { email: normEmail } });
    if (exists) {
      return Response.json(
        { error: "Bu email allaqachon ro'yxatdan o'tgan" },
        { status: 409 }
      );
    }

    // Birinchi foydalanuvchi — admin.
    const count = await prisma.user.count();
    const user = await prisma.user.create({
      data: {
        email: normEmail,
        name: name || null,
        passwordHash: await hashPassword(password),
        role: count === 0 ? "ADMIN" : "USER",
      },
    });

    await createSession(user.id);
    return ok({ id: user.id, email: user.email, role: user.role });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json({ error: e.issues[0].message }, { status: 400 });
    }
    return fail(e);
  }
}
