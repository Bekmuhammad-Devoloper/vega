import "server-only";
import { prisma } from "@/lib/prisma";
import {
  config,
  paymeEnabled,
  clickEnabled,
} from "@/lib/config";
import type { Prisma } from "@prisma/client";

export class PaymentError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export interface PaymentMethod {
  id: string;
  name: string;
  description: string;
  instant: boolean; // darhol balansga tushadimi?
}

/** Foydalanuvchiga ko'rsatiladigan mavjud to'lov usullari. */
export function availableMethods(): PaymentMethod[] {
  const methods: PaymentMethod[] = [];
  if (config.allowDemoTopup) {
    methods.push({
      id: "demo",
      name: "Demo to'ldirish",
      description: "Sinov uchun — darhol balansga tushadi (pul olinmaydi)",
      instant: true,
    });
  }
  methods.push({
    id: "manual",
    name: "Karta orqali (qo'lda)",
    description: "So'rov yuboriladi, admin tasdiqlagach balansga tushadi",
    instant: false,
  });
  if (paymeEnabled) {
    methods.push({
      id: "payme",
      name: "Payme",
      description: "Payme orqali onlayn to'lov",
      instant: false,
    });
  }
  if (clickEnabled) {
    methods.push({
      id: "click",
      name: "Click",
      description: "Click orqali onlayn to'lov",
      instant: false,
    });
  }
  return methods;
}

/** Ichki: to'lovni PAID qiladi, balansni oshiradi, tranzaksiya yozadi. */
async function creditPaymentTx(
  tx: Prisma.TransactionClient,
  paymentId: string
) {
  const payment = await tx.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new PaymentError("To'lov topilmadi", 404);
  if (payment.status === "PAID") return payment; // idempotent
  if (payment.status === "REJECTED") {
    throw new PaymentError("Bu to'lov rad etilgan");
  }

  const user = await tx.user.update({
    where: { id: payment.userId },
    data: { balance: { increment: payment.amount } },
  });
  await tx.transaction.create({
    data: {
      userId: payment.userId,
      type: "TOPUP",
      amount: payment.amount,
      balanceAfter: user.balance,
      note: `To'lov (${payment.method})`,
    },
  });
  return tx.payment.update({
    where: { id: payment.id },
    data: { status: "PAID" },
  });
}

/** Payme checkout havolasini yasaydi (haqiqiy format). */
function paymeCheckoutUrl(paymentId: string, amountUzs: number): string {
  // m=MERCHANT;ac.order_id=ID;a=<tiyin>  -> base64
  const params = `m=${config.payme.merchantId};ac.order_id=${paymentId};a=${amountUzs * 100}`;
  const encoded = Buffer.from(params).toString("base64");
  return `https://checkout.paycom.uz/${encoded}`;
}

/** Click checkout havolasini yasaydi (haqiqiy format). */
function clickCheckoutUrl(paymentId: string, amountUzs: number): string {
  const p = config.click;
  return (
    `https://my.click.uz/services/pay?service_id=${p.serviceId}` +
    `&merchant_id=${p.merchantId}&amount=${amountUzs}&transaction_param=${paymentId}` +
    `&return_url=${encodeURIComponent(config.appUrl + "/wallet")}`
  );
}

export interface TopupResult {
  status: "PAID" | "PENDING";
  paymentId: string;
  redirectUrl?: string;
  message: string;
}

/** Balans to'ldirishni boshlaydi. */
export async function createTopup(
  userId: string,
  amount: number,
  method: string
): Promise<TopupResult> {
  if (!Number.isInteger(amount) || amount < config.minTopup) {
    throw new PaymentError(
      `Eng kam summa: ${config.minTopup.toLocaleString("ru-RU")} so'm`
    );
  }
  if (amount > config.maxTopup) {
    throw new PaymentError("Summa juda katta");
  }

  // DEMO — darhol tushadi.
  if (method === "demo") {
    if (!config.allowDemoTopup) throw new PaymentError("Demo o'chirilgan");
    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: { userId, amount, method: "demo", status: "PENDING" },
      });
      return creditPaymentTx(tx, p.id);
    });
    return {
      status: "PAID",
      paymentId: payment.id,
      message: "Balans to'ldirildi ✓",
    };
  }

  // MANUAL — admin tasdiqlaydi.
  if (method === "manual") {
    const payment = await prisma.payment.create({
      data: { userId, amount, method: "manual", status: "PENDING" },
    });
    return {
      status: "PENDING",
      paymentId: payment.id,
      message:
        "So'rov yuborildi. To'lovni amalga oshiring — admin tasdiqlagach balansingizga tushadi.",
    };
  }

  // PAYME
  if (method === "payme") {
    if (!paymeEnabled) throw new PaymentError("Payme sozlanmagan");
    const payment = await prisma.payment.create({
      data: { userId, amount, method: "payme", status: "PENDING" },
    });
    return {
      status: "PENDING",
      paymentId: payment.id,
      redirectUrl: paymeCheckoutUrl(payment.id, amount),
      message: "Payme sahifasiga yo'naltirilmoqda...",
    };
  }

  // CLICK
  if (method === "click") {
    if (!clickEnabled) throw new PaymentError("Click sozlanmagan");
    const payment = await prisma.payment.create({
      data: { userId, amount, method: "click", status: "PENDING" },
    });
    return {
      status: "PENDING",
      paymentId: payment.id,
      redirectUrl: clickCheckoutUrl(payment.id, amount),
      message: "Click sahifasiga yo'naltirilmoqda...",
    };
  }

  throw new PaymentError("Noma'lum to'lov usuli");
}

/** Admin: kutilayotgan to'lovni tasdiqlaydi. */
export async function approvePayment(paymentId: string) {
  return prisma.$transaction((tx) => creditPaymentTx(tx, paymentId));
}

/** Admin: to'lovni rad etadi. */
export async function rejectPayment(paymentId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new PaymentError("To'lov topilmadi", 404);
  if (payment.status !== "PENDING") {
    throw new PaymentError("Faqat kutilayotgan to'lovni rad etish mumkin");
  }
  return prisma.payment.update({
    where: { id: paymentId },
    data: { status: "REJECTED" },
  });
}
