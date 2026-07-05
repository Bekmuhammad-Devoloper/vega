import "server-only";
import { prisma } from "@/lib/prisma";
import { provider } from "@/lib/provider";
import { rubToUzsPrice } from "@/lib/config";

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
  country: string
) {
  const price = await provider.getPrice(product, country);
  if (!price || price.count <= 0) {
    throw new OrderError("Bu yo'nalishda hozircha raqam yo'q");
  }

  const estimate = rubToUzsPrice(price.costRub);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new OrderError("Foydalanuvchi topilmadi", 401);
  if (user.balance < estimate) {
    throw new OrderError(
      `Balans yetarli emas. Kerak: ${estimate.toLocaleString("ru-RU")} so'm`
    );
  }

  // Provayderdan sotib olamiz (tashqi so'rov — tranzaksiyadan tashqarida).
  const bought = await provider.buy(product, country);
  const finalPrice = rubToUzsPrice(bought.costRub);

  try {
    const order = await prisma.$transaction(async (tx) => {
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
          provider: provider.name,
          providerId: bought.providerId,
          country,
          operator: bought.operator,
          product,
          phone: bought.phone,
          costRub: bought.costRub,
          price: finalPrice,
          status: "PENDING",
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
    await provider.cancel(bought.providerId).catch(() => {});
    throw e;
  }
}

/** Buyurtma holatini tekshirish — SMS kelgan bo'lsa saqlaymiz. */
export async function pollOrder(orderId: string, userId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
  });
  if (!order) throw new OrderError("Buyurtma topilmadi", 404);

  // Yakuniy holatlar — o'zgartirmaymiz.
  if (["CANCELED", "TIMEOUT", "FINISHED", "BANNED"].includes(order.status)) {
    return order;
  }

  const state = await provider.check(order.providerId);
  const sms = state.sms.find((s) => s.code || s.text);

  if (sms && (sms.code || sms.text)) {
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "RECEIVED",
        smsCode: sms.code ?? null,
        smsText: sms.text ?? null,
      },
    });
    // SMS olindi — provayderda yakunlaymiz.
    await provider.finish(order.providerId).catch(() => {});
    return updated;
  }

  // Muddati o'tgan bo'lsa — pulni qaytaramiz.
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
  await provider.cancel(order.providerId).catch(() => {});
  return refundOrder(order.id, userId, "CANCELED");
}

/** Ichki: buyurtma pulini qaytaradi va statusni belgilaydi. */
async function refundOrder(
  orderId: string,
  userId: string,
  status: "CANCELED" | "TIMEOUT"
) {
  return prisma.$transaction(async (tx) => {
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
