/**
 * To'lov ma'lumotlari — pulli tarif tanlanganda foydalanuvchiga ko'rsatiladi.
 *
 * Karta raqamlari, kartani egasi va kanal taklif linki — bularni
 * `.env` orqali sozlaymiz. Kod ichida hardcode qilmang: bu shaxsiy
 * moliyaviy ma'lumot, git'ga tushishi mumkin emas.
 *
 * Konfiguratsiya:
 *   PAYMENT_CARD_HUMO          — masalan "0000 0000 0000 0000"
 *   PAYMENT_CARD_VISA          — masalan "0000 0000 0000 0000"
 *   PAYMENT_CARD_HOLDER        — karta egasining ismi
 *   PAYMENT_CONFIRM_CHANNEL_URL — chek yuboriladigan kanal (https://t.me/+...)
 *   PAYMENT_CONFIRM_NOTE        — ko'rsatma matni (ixtiyoriy)
 */

export interface PaymentCard {
  type: string;
  number: string;
}

export interface PaymentInfo {
  cards: PaymentCard[];
  holder: string;
  channelUrl: string;
  confirmNote: string;
  enabled: boolean;
}

const DEFAULT_NOTE =
  "To'lovni amalga oshirib, chek (skrinshot)ni kanalga yuboring. " +
  'Tasdiqlash 2 daqiqadan 30 daqiqagacha davom etadi. ' +
  "Tasdiqlanguncha tekin (Free) versiyadan foydalanib turing.";

function readPaymentInfo(): PaymentInfo {
  const cards: PaymentCard[] = [];
  const humo = process.env.PAYMENT_CARD_HUMO?.trim();
  const visa = process.env.PAYMENT_CARD_VISA?.trim();
  if (humo) cards.push({ type: 'Humo/Uzcard', number: humo });
  if (visa) cards.push({ type: 'Visa', number: visa });

  const holder = process.env.PAYMENT_CARD_HOLDER?.trim() ?? '';
  const channelUrl = process.env.PAYMENT_CONFIRM_CHANNEL_URL?.trim() ?? '';
  const confirmNote = process.env.PAYMENT_CONFIRM_NOTE?.trim() || DEFAULT_NOTE;

  return {
    cards,
    holder,
    channelUrl,
    confirmNote,
    enabled: cards.length > 0 && !!holder && !!channelUrl,
  };
}

export const PAYMENT_INFO: PaymentInfo = readPaymentInfo();
