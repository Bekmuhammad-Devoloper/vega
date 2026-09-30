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
  // Noto'g'ri JSON tanasi (req.json() SyntaxError tashlaydi) — bu mijoz xatosi.
  if (e instanceof SyntaxError) {
    return Response.json({ error: "Ma'lumotlar noto'g'ri" }, { status: 400 });
  }
  // Boshqa har qanday xato — ichki/provayder tafsilotlarini client'ga
  // OSHKOR QILMAYMIZ (5sim/HeroSMS javob tanasi, stack va h.k. sizib chiqmasin).
  console.error("API error:", e);
  return Response.json(
    { error: "Server xatosi. Birozdan keyin urinib ko'ring." },
    { status: 500 }
  );
}
