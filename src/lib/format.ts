// Client + server'da ishlatiladigan formatlash yordamchilari.

export function formatUzs(amount: number): string {
  return amount.toLocaleString("ru-RU") + " so'm";
}

/**
 * Status yorlig'i. `kind` — mahsulot turi: SMS raqam, LZT akkaunt (kod),
 * yoki yetkaziladigan mahsulot (Premium/Stars).
 */
export function statusLabel(
  status: string,
  kind: "sms" | "code" | "delivery" = "sms"
): { text: string; color: string } {
  if (kind === "delivery") {
    if (status === "PENDING") return { text: "Yuborilmoqda", color: "amber" };
    if (status === "RECEIVED") return { text: "Yetkazildi", color: "green" };
  }
  if (kind === "code") {
    if (status === "PENDING") return { text: "Kod kutilmoqda", color: "amber" };
    if (status === "RECEIVED") return { text: "Kod keldi", color: "green" };
  }
  switch (status) {
    case "PENDING":
      return { text: "SMS kutilmoqda", color: "amber" };
    case "RECEIVED":
      return { text: "SMS keldi", color: "green" };
    case "FINISHED":
      return { text: "Yakunlandi", color: "green" };
    case "CANCELED":
      return { text: "Bekor qilindi", color: "gray" };
    case "TIMEOUT":
      return { text: "Vaqt tugadi", color: "gray" };
    case "BANNED":
      return { text: "Bloklandi", color: "red" };
    default:
      return { text: status, color: "gray" };
  }
}

export function formatDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
