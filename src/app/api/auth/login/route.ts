import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, verifyPassword } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import {
  limitOr429,
  checkKeyOr429,
  recordFailure,
  clearFailures,
} from "@/lib/ratelimit";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const limited = limitOr429(req, "login", 10, 60_000);
    if (limited) return limited;

    const { email, password } = schema.parse(await req.json());
    const normEmail = email.toLowerCase();

    // Akkaunt bo'yicha MUVAFFAQIYATSIZ urinishlar cheklanadi (IP/X-Forwarded-For
    // soxtalashtirilsa ham bitta email'ga parol tanlash sekinlashadi).
    //
    // TARTIB MUHIM: avval parolni tekshiramiz, keyin limitni qo'llaymiz. Agar
    // limit tekshiruvi oldin bo'lsa, begona odam qurbonning emailiga noto'g'ri
    // parol yog'dirib uni TIZIMDAN BUTUNLAY BLOKLAB qo'ya olardi (lockout DoS).
    // Hozirgi tartibda to'g'ri parol egasi har doim kira oladi, noto'g'ri
    // taxminlar esa 10 tadan keyin 429 oladi.
    const user = await prisma.user.findUnique({
      where: { email: normEmail },
    });
    const valid =
      !!user && (await verifyPassword(password, user.passwordHash));

    if (!valid) {
      recordFailure("login-email", normEmail, 60_000);
      const emailLimited = checkKeyOr429("login-email", normEmail, 10);
      if (emailLimited) return emailLimited;
      return Response.json(
        { error: "Email yoki parol noto'g'ri" },
        { status: 401 }
      );
    }

    clearFailures("login-email", normEmail);
    await createSession(user!.id);
    return ok({ id: user!.id, email: user!.email, role: user!.role });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json({ error: "Ma'lumotlar noto'g'ri" }, { status: 400 });
    }
    return fail(e);
  }
}
