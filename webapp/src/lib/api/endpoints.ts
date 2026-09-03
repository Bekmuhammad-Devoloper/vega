import { api, apiPostForm } from '../api';
import type {
  CountryDto,
  CryptoAsset,
  CryptoOrder,
  CryptoStorefront,
  DigitalOrder,
  DigitalStorefront,
  MeDto,
  NumberOrder,
  PublicSettings,
  RecipientPreview,
  ServiceDto,
  StorefrontOffer,
} from './types';

// ───── Auth / Users ──────
export const apiAuthVerify = (initData: string) =>
  api<{ ok: true; user: MeDto }>('/auth/telegram', {
    method: 'POST',
    body: { initData },
    skipAuth: true,
  });

export const apiGetMe = () => api<MeDto>('/users/me');
export const apiUpdateMe = (data: Partial<Pick<MeDto, 'phone' | 'firstName' | 'language'>>) =>
  api<MeDto>('/users/me', { method: 'PATCH', body: data });

// ───── Katalog (platforma xizmatlari va davlatlari) ─────
export const apiListServices = () => api<ServiceDto[]>('/catalog/services', { skipAuth: true });
export const apiListCountries = () => api<CountryDto[]>('/catalog/countries', { skipAuth: true });

// ───── Storefront (do'kon takliflari) ─────
export const apiStorefront = () => api<StorefrontOffer[]>('/numbers/storefront');

// ───── Raqam buyurtmalari ─────
export const apiListNumberOrders = () => api<NumberOrder[]>('/numbers/orders');
export const apiGetNumberOrder = (id: string) => api<NumberOrder>(`/numbers/orders/${id}`);
export const apiBuyNumber = (body: { serviceId: string; countryId: string }) =>
  api<NumberOrder>('/numbers/orders', { method: 'POST', body });
/** SMS kodni tekshiradi (poll) — yangilangan buyurtmani qaytaradi. */
export const apiCheckNumberOrder = (id: string) =>
  api<NumberOrder>(`/numbers/orders/${id}/check`, { method: 'POST' });
export const apiCancelNumberOrder = (id: string) =>
  api<NumberOrder>(`/numbers/orders/${id}/cancel`, { method: 'POST' });

// ───── Digital (Telegram Stars / Premium) ─────
export const apiDigitalStorefront = () => api<DigitalStorefront>('/digital/storefront');
export const apiListDigitalOrders = () => api<DigitalOrder[]>('/digital/orders');
export const apiGetDigitalOrder = (id: string) => api<DigitalOrder>(`/digital/orders/${id}`);
export const apiBuyDigital = (body: { digitalProductId: string; username: string }) =>
  api<DigitalOrder>('/digital/orders', { method: 'POST', body });
/** @username kimga tegishli — avatar va ism (xato akkauntga yubormaslik uchun). */
export const apiRecipientPreview = (username: string) =>
  api<RecipientPreview>(`/digital/recipient?username=${encodeURIComponent(username)}`);

// ───── Kripto (TON / USDT) — qo'lda yetkaziladi ─────
export const apiCryptoStorefront = () => api<CryptoStorefront>('/crypto/storefront');
export const apiListCryptoOrders = () => api<CryptoOrder[]>('/crypto/orders');
export const apiBuyCrypto = (body: {
  asset: CryptoAsset;
  amount: number;
  network: string;
  address: string;
  memo?: string;
}) => api<CryptoOrder>('/crypto/orders', { method: 'POST', body });

// ───── Support ─────
export const apiCreateTicket = (body: { subject: string; message: string }) =>
  api('/support/tickets', { method: 'POST', body });
export const apiListMyTickets = () => api('/support/tickets/my');

// ───── Sozlamalar ─────
export const apiPublicSettings = () => api<PublicSettings>('/settings/public', { skipAuth: true });

// ───── Balans to'ldirish (karta + chek) ─────
export const apiTopupBalance = (amount: number, file: File) => {
  const form = new FormData();
  form.append('amount', String(amount));
  form.append('file', file);
  return apiPostForm<{ ok: boolean }>('/numbers/balance/topup', form);
};
