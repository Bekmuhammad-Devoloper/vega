// Client komponentlar uchun buyurtma tipi (JSON serializatsiyadan keyin).
export type OrderDTO = {
  id: string;
  product: string;
  country: string;
  operator: string;
  phone: string;
  price: number;
  status: string;
  smsCode: string | null;
  smsText: string | null;
  createdAt: string;
  expiresAt: string | null;
};
