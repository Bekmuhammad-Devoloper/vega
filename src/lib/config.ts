// Markaziy sozlamalar — barchasi .env dan o'qiladi.

/**
 * Env'dan son o'qish. `Number(v) || def` naqshi 0 va NaN'ni jimgina default'ga
 * aylantirib yuboradi (MARKUP_PERCENT=0 -> 30 bug'i). Bu yerda faqat qiymat
 * berilmagan yoki haqiqatan noto'g'ri (NaN) bo'lsagina default qaytadi.
 */
function num(v: string | undefined, def: number): number {
  if (v == null || v.trim() === "") return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

const isProd = process.env.NODE_ENV === "production";

export const config = {
  fivesimApiKey: process.env.FIVESIM_API_KEY?.trim() || "",
  // 5sim bloklangan bo'lsa — mirror/proxy manzilini shu yerdan bering.
  fivesimBaseUrl:
    process.env.FIVESIM_BASE_URL?.trim() || "https://5sim.net/v1",

  // HeroSMS (SMS-Activate protokoli) — UZB uchun arzon provayder.
  herosmsApiKey: process.env.HEROSMS_API_KEY?.trim() || "",
  herosmsBaseUrl:
    process.env.HEROSMS_BASE_URL?.trim() ||
    "https://hero-sms.com/stubs/handler_api.php",

  // SPIDER TG API — real SIM, Telegram uchun ISHLAYDI (asosiy Telegram manbasi).
  spiderApiKey: process.env.SPIDER_API_KEY?.trim() || "",
  spiderBaseUrl:
    process.env.SPIDER_BASE_URL?.trim() || "https://api.spider-service.com",

  // LZT Market — Telegram akkauntlari (raqam + kirish kodi) va Premium gift.
  // Telegram va Premium uchun ASOSIY manba (kalit bo'lsa).
  lztApiKey: process.env.LZT_API_KEY?.trim() || "",
  lztBaseUrl:
    process.env.LZT_BASE_URL?.trim() || "https://prod-api.lzt.market",

  // iStar (istar.fragmentapi.com) — Telegram Stars (Fragment + ~5%).
  istarApiKey: process.env.ISTAR_API_KEY?.trim() || "",
  istarBaseUrl:
    process.env.ISTAR_BASE_URL?.trim() ||
    "https://v1.fragmentapi.com/api/v1/partner",
  istarWallet: process.env.ISTAR_WALLET?.trim().toUpperCase() === "USDT" ? "USDT" : "TON",
  // iStar Stars narxini API'da bermaydi: Fragment $0.015 + 5% komissiya.
  istarUsdPerStar: num(process.env.ISTAR_USD_PER_STAR, 0.0158),

  // Provayder narxni USD'da qaytaradi. 1 USD necha so'm (kurs).
  usdToUzs: num(process.env.USD_TO_UZS, 12000),
  // LZT narxlari RUB'da. 1 RUB necha so'm (kurs).
  rubToUzs: num(process.env.RUB_TO_UZS, 150),
  markupPercent: num(process.env.MARKUP_PERCENT, 30),
  authSecret:
    process.env.AUTH_SECRET?.trim() || "dev-only-secret-change-me-please",

  // Birinchi admin — ADMIN_EMAIL o'rnatilsa, aynan shu email bilan ro'yxatdan
  // o'tgan foydalanuvchi ADMIN bo'ladi (deterministik, poyga yo'q).
  adminEmail: process.env.ADMIN_EMAIL?.trim().toLowerCase() || "",

  // To'lov (balans to'ldirish)
  // DEMO to'ldirish — sinov uchun darhol balans qo'shadi.
  // Ishlab chiqarishda default O'CHIQ; yoqish uchun DEMO_TOPUP=true kerak.
  allowDemoTopup: process.env.DEMO_TOPUP
    ? process.env.DEMO_TOPUP === "true"
    : !isProd,
  minTopup: num(process.env.MIN_TOPUP, 1000),
  maxTopup: num(process.env.MAX_TOPUP, 10_000_000),

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

// Hech qanday provayder kaliti yo'q bo'lsa demo (MOCK) rejimda ishlaymiz.
export const isMockMode =
  config.lztApiKey === "" &&
  config.istarApiKey === "" &&
  config.spiderApiKey === "" &&
  config.herosmsApiKey === "" &&
  config.fivesimApiKey === "";

// DIQQAT: Payme/Click checkout havolasini ko'rsatish YETARLI EMAS — to'lov
// tasdig'ini qabul qiluvchi merchant callback endpointi (Payme JSON-RPC /
// Click prepare-complete) hali yozilmagan. Callback bo'lmasa foydalanuvchi
// pul to'laydi-yu, balansi hech qachon oshmaydi. Shuning uchun bu usullar
// faqat callback tayyor ekani ATAYLAB tasdiqlangandagina yoqiladi.
export const paymeEnabled =
  config.payme.merchantId !== "" &&
  config.payme.key !== "" &&
  process.env.PAYME_CALLBACKS_READY === "true";
export const clickEnabled =
  config.click.merchantId !== "" &&
  config.click.serviceId !== "" &&
  process.env.CLICK_CALLBACKS_READY === "true";

/**
 * Provayderning USD narxidan foydalanuvchiga ko'rsatiladigan so'm narxini
 * hisoblaydi: kurs bo'yicha o'giramiz, ustama qo'shamiz va 100 so'mgacha
 * yaxlitlaymiz.
 */
export function usdToUzsPrice(costUsd: number): number {
  const raw = costUsd * config.usdToUzs * (1 + config.markupPercent / 100);
  return Math.ceil(raw / 100) * 100;
}

/** Provayder narxini (valyutasiga qarab) sotuv narxiga (so'm) o'giradi. */
export function costToUzsPrice(cost: number, currency: "USD" | "RUB" = "USD"): number {
  if (currency === "USD") return usdToUzsPrice(cost);
  const raw = cost * config.rubToUzs * (1 + config.markupPercent / 100);
  return Math.ceil(raw / 100) * 100;
}
