import "server-only";
import { prisma, txRetry } from "@/lib/prisma";
import { provider } from "@/lib/provider";
import { costToUzsPrice } from "@/lib/config";
import { isStarsProduct, starPackBySlug, USERNAME_RE } from "@/lib/catalog";

export class OrderError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Raqam sotib olish (butun oqim):
 *  1) narx/mavjudlikni tekshiramiz
 *  2) balans yetarli ekanini tekshiramiz
 *  3) provayderdan sotib olamiz
 *  4) bazada atomar: buyurtma yaratamiz + balansdan yechamiz
 */
export async function buyNumber(
  userId: string,
  product: string,
  country: string,
  username?: string
) {
  // Stars — oluvchi @username majburiy (provayderga borishdan oldin tekshiramiz).
  if (isStarsProduct(product)) {
    if (!starPackBySlug(country)) throw new OrderError("Paket noto'g'ri");
    if (!username || !USERNAME_RE.test(username.trim())) {
      throw new OrderError("Telegram username kiriting (masalan: @username)");
    }
  }

  const price = await provider.getPrice(product, country);
  if (!price || price.count <= 0) {
    throw new OrderError("Bu yo'nalishda hozircha raqam yo'q");
  }
  // Narx haqiqiy son ekanini TEKSHIRAMIZ. Provayder "-"/"n/a" qaytarsa
  // Number() -> NaN bo'ladi; NaN bilan hamma taqqoslash false bo'lgani uchun
  // balans tekshiruvi ham, quyidagi qo'riqchilar ham jimgina o'tib ketardi.
  if (!Number.isFinite(price.costRub) || price.costRub <= 0) {
    throw new OrderError("Bu yo'nalishda narx aniqlanmadi. Boshqasini tanlang.");
  }

  const estimate = costToUzsPrice(price.costRub, price.currency);
  if (!Number.isFinite(estimate) || estimate <= 0) {
    throw new OrderError("Bu yo'nalishda narx aniqlanmadi. Boshqasini tanlang.");
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new OrderError("Foydalanuvchi topilmadi", 401);
  if (user.balance < estimate) {
    throw new OrderError(
      `Balans yetarli emas. Kerak: ${estimate.toLocaleString("ru-RU")} so'm`
    );
  }

  // Provayderdan sotib olamiz (tashqi so'rov — tranzaksiyadan tashqarida).
  // getPrice tanlagan operatorni uzatamiz — 5sim aynan shu narxdagi raqamni
  // beradi (aks holda 'any' qimmatroq operator berib, ko'rsatilgandan ko'p
  // yechilishi mumkin edi).
  const bought = await provider.buy(product, country, price.operator, {
    username: username?.trim(),
  });

  // Provayder narx qaytarmasa (yo'q/0/NaN) — TEKIN raqam bermaymiz. Ko'rsatilgan
  // estimate bo'yicha hisoblaymiz (u yuqorida tekshirilgan: chekli va > 0).
  const providerPrice =
    Number.isFinite(bought.costRub) && bought.costRub > 0
      ? costToUzsPrice(bought.costRub, bought.currency ?? price.currency)
      : NaN;
  const finalPrice = Number.isFinite(providerPrice) ? providerPrice : estimate;
  if (!Number.isFinite(finalPrice) || finalPrice <= 0) {
    await provider.cancel(bought.providerId).catch(() => {});
    throw new OrderError("Narxni aniqlab bo'lmadi. Boshqa yo'nalishni tanlang.");
  }

  try {
    const order = await txRetry(async (tx) => {
      const fresh = await tx.user.findUnique({ where: { id: userId } });
      if (!fresh || fresh.balance < finalPrice) {
        throw new OrderError("Balans yetarli emas");
      }
      const updated = await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: finalPrice } },
      });
      const created = await tx.order.create({
        data: {
          userId,
          // Manba nomi (prefiks) — UI bekor qilish mumkinligini shundan biladi.
          provider: bought.providerId.split(":")[0] || provider.name,
          providerId: bought.providerId,
          country,
          operator: bought.operator,
          product,
          phone: bought.phone,
          costRub: bought.costRub,
          price: finalPrice,
          // Xariddayoq yetkazilgan (Premium havolasi) — darhol tayyor.
          status: bought.delivered ? "RECEIVED" : "PENDING",
          smsCode: bought.delivered?.code ?? null,
          smsText: bought.delivered?.text ?? null,
          expiresAt: bought.expiresAt,
        },
      });
      await tx.transaction.create({
        data: {
          userId,
          type: "PURCHASE",
          amount: -finalPrice,
          balanceAfter: updated.balance,
          orderId: created.id,
          note: `${product} / ${country}`,
        },
      });
      return created;
    });
    return order;
  } catch (e) {
    // Baza tomonida xato bo'lsa — provayderdagi buyurtmani bekor qilamiz.
    // (LZT'da bekor qilib bo'lmaydi — xarid ma'lumotini log'da saqlaymiz.)
    if (bought.refundable === false) {
      console.error("[orders] qaytarib bo'lmaydigan xarid bazaga yozilmadi:", {
        userId,
        product,
        country,
        providerId: bought.providerId,
        phone: bought.phone,
        delivered: bought.delivered,
      });
    }
    await provider.cancel(bought.providerId).catch(() => {});
    throw e;
  }
}

type OrderSource = { provider: string; providerId: string };

/** Provayder pulni qaytaradimi? LZT xaridlari umuman qaytmaydi. */
export function isRefundable(order: OrderSource) {
  return order.provider !== "lzt" && !order.providerId.startsWith("lzt:");
}

/**
 * Mijoz o'zi bekor qila oladimi? LZT (akkaunt sotib olingan) va iStar
 * (Stars darhol yuborilmoqda) — yo'q. iStar "failed" desa pul pollOrder'da
 * avtomatik qaytadi.
 */
export function canUserCancel(order: OrderSource) {
  return isRefundable(order) && order.provider !== "istar" && !order.providerId.startsWith("istar:");
}

/** Buyurtma holatini tekshirish — SMS kelgan bo'lsa saqlaymiz. */
export async function pollOrder(orderId: string, userId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
  });
  if (!order) throw new OrderError("Buyurtma topilmadi", 404);

  // Yakuniy holatlar — o'zgartirmaymiz (RECEIVED ham: SMS allaqachon yetkazilgan).
  if (
    ["RECEIVED", "CANCELED", "TIMEOUT", "FINISHED", "BANNED"].includes(
      order.status
    )
  ) {
    return order;
  }

  const state = await provider.check(order.providerId);
  const sms = state.sms.find((s) => s.code || s.text);

  if (sms && (sms.code || sms.text)) {
    // SHARTLI update: faqat hali PENDING bo'lsa. Aks holda (parallel cancel/timeout
    // refund status'ni allaqachon o'zgartirgan bo'lsa) RECEIVED bilan ustidan
    // yozib, foydalanuvchiga ham pul qaytishi ham kod tekin ketishining oldini
    // olamiz.
    const res = await prisma.order.updateMany({
      where: { id: order.id, status: "PENDING" },
      data: {
        status: "RECEIVED",
        smsCode: sms.code ?? null,
        smsText: sms.text ?? null,
      },
    });
    if (res.count === 1) {
      // Biz yozdik — provayderda yakunlaymiz.
      await provider.finish(order.providerId).catch(() => {});
    }
    return (await prisma.order.findUnique({ where: { id: order.id } }))!;
  }

  // Provayder raqamni bekor/muddati o'tgan deb bildirsa — SMS bo'lmasa qaytaramiz.
  // (expiresAt null bo'lsa ham to'silib qolmaydi.)
  // Qaytarib bo'lmaydigan manba (LZT) — kodni kutishda davom etamiz.
  if (!isRefundable(order)) return order;

  const st = (state.status || "").toUpperCase();
  if (["CANCEL", "EXPIRE", "BANNED", "TIMEOUT"].some((k) => st.includes(k))) {
    return refundOrder(order.id, userId, "CANCELED");
  }

  // Lokal soat bo'yicha muddati o'tgan bo'lsa — pulni qaytaramiz.
  if (order.expiresAt && order.expiresAt.getTime() < Date.now()) {
    return refundOrder(order.id, userId, "TIMEOUT");
  }

  return order;
}

/** Buyurtmani bekor qilish + pulni qaytarish. */
export async function cancelOrder(orderId: string, userId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, userId } });
  if (!order) throw new OrderError("Buyurtma topilmadi", 404);
  if (order.status !== "PENDING") {
    throw new OrderError("Bu buyurtmani bekor qilib bo'lmaydi");
  }
  if (!canUserCancel(order)) {
    // LZT akkaunti allaqachon sotib olingan / iStar Stars'ni yubormoqda.
    throw new OrderError(
      "Bu buyurtmani bekor qilib bo'lmaydi. Muammo bo'lsa admin bilan bog'laning."
    );
  }

  // Bekor qilishdan oldin SMS kelganini tekshiramiz. Agar kod allaqachon kelgan
  // bo'lsa — pulni qaytarmaymiz (aks holda foydalanuvchi ham kodni oladi, ham
  // pulni qaytarib oladi; sayt esa provayderga to'lagan puldan ayriladi).
  let state = null;
  try {
    state = await provider.check(order.providerId);
  } catch {
    state = null;
  }
  const sms = state?.sms.find((s) => s.code || s.text);
  if (sms && (sms.code || sms.text)) {
    const res = await prisma.order.updateMany({
      where: { id: order.id, status: "PENDING" },
      data: {
        status: "RECEIVED",
        smsCode: sms.code ?? null,
        smsText: sms.text ?? null,
      },
    });
    if (res.count === 1) {
      await provider.finish(order.providerId).catch(() => {});
    }
    return (await prisma.order.findUnique({ where: { id: order.id } }))!;
  }

  await provider.cancel(order.providerId).catch(() => {});
  return refundOrder(order.id, userId, "CANCELED");
}

/** Ichki: buyurtma pulini qaytaradi va statusni belgilaydi. */
async function refundOrder(
  orderId: string,
  userId: string,
  status: "CANCELED" | "TIMEOUT"
) {
  return txRetry(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order || order.status !== "PENDING") {
      return order!;
    }
    const user = await tx.user.update({
      where: { id: userId },
      data: { balance: { increment: order.price } },
    });
    await tx.transaction.create({
      data: {
        userId,
        type: "REFUND",
        amount: order.price,
        balanceAfter: user.balance,
        orderId: order.id,
        note: `Qaytarildi (${status})`,
      },
    });
    return tx.order.update({
      where: { id: order.id },
      data: { status },
    });
  });
}
