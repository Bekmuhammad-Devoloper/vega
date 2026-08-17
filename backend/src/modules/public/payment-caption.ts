import type { Tenant } from '@prisma/client';

const PLAN_LABEL: Record<string, string> = {
  FREE: 'Free',
  STANDARD: 'Standart',
  PRO: 'Pro',
  PREMIUM: 'Premium',
};

/** To'lov (bir martalik faollashtirish) tasdiqlash xabari — admin chatiga. */
export function buildPaymentCaption(t: Tenant, title: string): string {
  const username = t.ownerUsername ? `@${t.ownerUsername}` : '—';
  const date = t.createdAt.toLocaleDateString('ru-RU');
  const amount = t.activationAmount != null ? Number(t.activationAmount) : 0;
  const priceStr = amount > 0 ? ` (${amount.toLocaleString('ru-RU')} so'm)` : '';

  return (
    `💳 <b>${title}</b>\n\n` +
    `👤 Ism: ${t.ownerName}\n` +
    `🔗 Username: ${username}\n` +
    `📞 Telefon: ${t.ownerPhone ?? '—'}\n` +
    `🆔 TG ID: <code>${t.ownerTelegramId ?? '—'}</code>\n` +
    `🏪 Do'kon: ${t.shopName}\n` +
    `🤖 Bot: ${t.botUsername ? '@' + t.botUsername : '—'}\n` +
    `💎 Tarif: <b>${PLAN_LABEL[t.tariffPlan] ?? t.tariffPlan}</b>${priceStr}\n` +
    `📅 Ro'yxatdan: ${date}`
  );
}
