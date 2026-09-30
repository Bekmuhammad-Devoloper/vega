import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { config } from "@/lib/config";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 kun

/**
 * Sessiya imzo kalitini qaytaradi. Ishlab chiqarishda zaif yoki standart
 * ("dev-only-...") kalit bilan ishlashga YO'L QO'YMAYDI — aks holda kimdir
 * manbadan ma'lum kalit bilan istalgan (jumladan admin) sessiyani soxtalashtira
 * oladi. Tekshiruv runtime'da (build paytida emas) bo'ladi, shu bois `next build`
 * buzilmaydi, lekin AUTH_SECRET to'g'ri berilmasa auth fail-closed bo'ladi.
 */
function getSecret(): Uint8Array {
  const s = config.authSecret;
  const weak = s === "" || s.startsWith("dev-only-secret") || s.length < 16;
  if (process.env.NODE_ENV === "production" && weak) {
    // Sabab faqat server loglariga — mijozga sozlama holatini oshkor qilmaymiz.
    console.error(
      "FATAL: AUTH_SECRET o'rnatilmagan yoki juda zaif. " +
        "Kamida 32 belgili tasodifiy qiymat bering (auth ishlamaydi)."
    );
    throw new AuthError("Server xatosi", 500);
  }
  return new TextEncoder().encode(s);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

async function signSession(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(getSecret());
}

/** Sessiya cookie'sini o'rnatadi (login/register'dan keyin). */
export async function createSession(userId: string): Promise<void> {
  const token = await signSession(userId);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Cookie'dan userId'ni oladi yoki null. */
export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}

export type SafeUser = {
  id: string;
  email: string;
  name: string | null;
  balance: number;
  role: string;
};

/** Joriy foydalanuvchi (parolsiz) yoki null. */
export async function getCurrentUser(): Promise<SafeUser | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, balance: true, role: true },
  });
  return user;
}

/** Auth talab qiladi — bo'lmasa xatolik tashlaydi (route handler'larda ushlanadi). */
export async function requireUser(): Promise<SafeUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Avval tizimga kiring");
  return user;
}

export async function requireAdmin(): Promise<SafeUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new AuthError("Ruxsat yo'q", 403);
  return user;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}
