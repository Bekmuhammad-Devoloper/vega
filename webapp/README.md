# Marketplace WebApp (Next.js 15 + Tailwind v4)

Telegram Mini App — foydalanuvchi tomoni.

## Quick start

```bash
cp .env.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:4000/api
# NEXT_PUBLIC_BOT_USERNAME=your_bot

npm install
npm run dev      # http://localhost:5174
```

## Lokal Telegram bilan tekshirish

WebApp HTTPS talab qiladi:

```bash
ngrok http 5174
# yoki: cloudflared tunnel --url http://localhost:5174
```

Olingan `https://...` URL ni BotFather'da:
- `/setdomain` → URL
- Bot Settings → Menu Button → URL

## Sahifalar

- `/` — Home (banner, kategoriya tabs, bestsellers, infinite newest)
- `/catalog`, `/search` — Search + filter + sort
- `/category/[slug]` — Kategoriya
- `/product/[id]` — Mahsulot detail (variantlar, savatga qo'shish, related)
- `/cart` — Korzina (promo kod, qty)
- `/cart/checkout` — Buyurtma berish
- `/favorites` — Sevimlilar
- `/profile` — Profil + til o'zgartirish
- `/orders`, `/orders/[id]` — Buyurtmalar
- `/support` — Yordam
- `/promo-codes` — Public promo'lar
- `/about` — Biz haqimizda

## Texnologiya

- Next.js 15 (App Router) + React 19 + TypeScript strict
- Tailwind CSS v4 + custom design tokens (oq + ko'k)
- TanStack Query + Zustand
- next-intl tarjima — uz/ru
- `@twa-dev/sdk` — Telegram WebApp SDK
- react-hook-form — checkout
- framer-motion — sheet animatsiyalari
- lucide-react — iconlar

## Event tracking

Har bir foydalanuvchi harakati batched POST `/events/batch` orqali backendga yuboriladi. Sahifa o'zgarganda yoki yopilganda `sendBeacon` ishlatiladi.
