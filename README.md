# Marketplace (Telegram WebApp)

Ko'p kategoriyali marketplace — Telegram Mini App orqali ishlaydi. Monorepo: `backend` (NestJS + Prisma + grammY) + `webapp` (Next.js 15 + Tailwind v4). Admin panel keyingi bosqichda qo'shiladi.

## Hujjatlar

- **[docs/00-OVERVIEW.md](docs/00-OVERVIEW.md)** — umumiy texnik topshiriq
- **[docs/01-WEBAPP-BOT-TZ.md](docs/01-WEBAPP-BOT-TZ.md)** — WebApp TZ
- **[docs/02-ADMIN-PANEL-TZ.md](docs/02-ADMIN-PANEL-TZ.md)** — Admin TZ
- **[docs/03-DEPLOYMENT-GUIDE.md](docs/03-DEPLOYMENT-GUIDE.md)** — deployment

## Struktura

```
marketplace/
├── backend/      # NestJS + Prisma + grammY + Socket.IO
├── webapp/       # Next.js — foydalanuvchi WebApp
└── docs/         # TZ hujjatlari
```

## Quick start

### 1. Backend

```bash
cd backend
cp .env.example .env
# .env'ni to'ldiring: TELEGRAM_BOT_TOKEN, TELEGRAM_ORDERS_CHANNEL_ID, ...

docker compose up -d              # Postgres + Redis
npm install
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed                # demo admin + mahsulotlar
npm run db:seed:doors             # (ixtiyoriy) eshik rom kataloga aylantirish
npm run start:dev                 # http://localhost:4000
```

### 2. WebApp

```bash
cd ../webapp
cp .env.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:4000/api

npm install
npm run dev                       # http://localhost:5174
```

### 3. ngrok bilan Telegram

```bash
ngrok http 5174
```

Olingan HTTPS URL'ni BotFather → `/setdomain` va Menu Button URL ga qo'ying. Webhook ishlatish uchun `TELEGRAM_USE_WEBHOOK=true` qiling va `ngrok http 4000` ham oching.

## Telegram bot komandalari

- `/start` — WebApp tugmasi bilan welcome
- `/help` — yordam

## Channelga buyurtma

`TELEGRAM_ORDERS_CHANNEL_ID` da bot admin bo'lishi kerak. Buyurtma berilganda kanalga avtomatik xabar boradi (✅ Tasdiqlash / 🚚 Yo'lda / 📦 Yetkazildi / ❌ Bekor qilish tugmalari bilan). Status o'zgarganda kanaldagi xabar **edit** qilinadi.

## Endpoints

API root: `http://localhost:4000/api`. Hamma `/api/*` endpointlari `X-Telegram-Init-Data` headeri talab qiladi (auth/telegram, banners, settings/public istisno).

Batafsil — `backend/README.md`.

## Keyingi bosqich

- **Admin panel** (mobile-first, Socket.IO live feed, user behavior timeline, haftalik analytics, related rules CRUD)
- **Test** (e2e Telegram emulator + integration)
- **Prod deploy** (VPS + Nginx + PM2 + Let's Encrypt)
