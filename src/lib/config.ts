// Markaziy sozlamalar — barchasi .env dan o'qiladi.

export const config = {
  fivesimApiKey: process.env.FIVESIM_API_KEY?.trim() || "",
  // 5sim bloklangan bo'lsa — mirror/proxy manzilini shu yerdan bering.
  fivesimBaseUrl:
    process.env.FIVESIM_BASE_URL?.trim() || "https://5sim.net/v1",
  rubToUzs: Number(process.env.RUB_TO_UZS) || 150,
  markupPercent: Number(process.env.MARKUP_PERCENT) || 30,
  authSecret:
    process.env.AUTH_SECRET?.trim() || "dev-only-secret-change-me-please",

  // To'lov (balans to'ldirish)
  // DEMO to'ldirish — sinov uchun darhol balans qo'shadi.
  // Ishlab chiqarishda DEMO_TOPUP=false qiling!
  allowDemoTopup: process.env.DEMO_TOPUP !== "false",
  minTopup: Number(process.env.MIN_TOPUP) || 1000,
  maxTopup: Number(process.env.MAX_TOPUP) || 10_000_000,

  // Payme / Click — faqat merchant ma'lumotlari to'ldirilsa yoqiladi.
  payme: {
    merchantId: process.env.PAYME_MERCHANT_ID?.trim() || "",
    key: process.env.PAYME_KEY?.trim() || "",
  },
  click: {
    merchantId: process.env.CLICK_MERCHANT_ID?.trim() || "",
    serviceId: process.env.CLICK_SERVICE_ID?.trim() || "",
    secretKey: process.env.CLICK_SECRET_KEY?.trim() || "",
  },

  appUrl: process.env.APP_URL?.trim() || "http://localhost:3000",
};

// API kaliti yo'q bo'lsa demo (MOCK) rejimda ishlaymiz.
export const isMockMode = config.fivesimApiKey === "";

export const paymeEnabled =
  config.payme.merchantId !== "" && config.payme.key !== "";
export const clickEnabled =
  config.click.merchantId !== "" && config.click.serviceId !== "";

/**
 * Provayderning RUB narxidan foydalanuvchiga ko'rsatiladigan so'm narxini
 * hisoblaydi: kurs bo'yicha o'giramiz, ustama qo'shamiz va 100 so'mgacha
 * yaxlitlaymiz.
 */
export function rubToUzsPrice(costRub: number): number {
  const raw = costRub * config.rubToUzs * (1 + config.markupPercent / 100);
  return Math.ceil(raw / 100) * 100;
}
