// Server ishga tushganda LZT narxlar taxtasini oldindan yig'ib qo'yamiz —
// birinchi mijoz narxlarni kutib qolmasin.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { config } = await import("@/lib/config");
  if (!config.lztApiKey) return;
  const { lztBoard } = await import("@/lib/provider/lzt");
  lztBoard("telegram")
    .then(() => lztBoard("tg_premium"))
    .catch((e) => console.warn("[lzt] warm-up:", e));
}
