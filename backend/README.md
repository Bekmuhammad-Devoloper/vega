# Marketplace Backend (NestJS + Prisma + grammY)

## Quick start

```bash
cp .env.example .env
# .env ni to'ldiring (BOT_TOKEN, CHANNEL_ID, va h.k.)

docker compose up -d           # Postgres + Redis
npm install
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed             # demo admin + mahsulotlar + promo
npm run start:dev              # http://localhost:4000
```

## API tree (WebApp)

- `GET /health` — service health
- `POST /api/auth/telegram` — initData ni tasdiqlash
- `GET /api/users/me`, `PATCH /api/users/me`
- `GET /api/categories`, `GET /api/categories/by-slug/:slug`
- `GET /api/products`, `GET /api/products/:id`, `GET /api/products/:id/related`
- `GET /api/cart`, `POST /api/cart/items`, `PATCH /api/cart/items/:id`, `DELETE /api/cart/items/:id`, `GET /api/cart/summary`
- `GET /api/favorites`, `POST /api/favorites`, `POST /api/favorites/toggle`, `DELETE /api/favorites/:productId`, `GET /api/favorites/summary`
- `POST /api/orders`, `GET /api/orders`, `GET /api/orders/:id`, `POST /api/orders/:id/cancel`
- `POST /api/promo-codes/apply`, `GET /api/promo-codes/public`
- `POST /api/support/tickets`, `GET /api/support/tickets/my`
- `POST /api/events`, `POST /api/events/batch`
- `GET /api/banners`
- `GET /api/settings/public`
- `POST /telegram/webhook` (no /api prefix)

Barcha `/api/*` endpointlari `X-Telegram-Init-Data` headeri talab qiladi (auth/telegram, banners, settings/public, health istisno).

## Tunnel (Telegram WebApp HTTPS uchun)

```bash
ngrok http 5174       # webapp
ngrok http 4000       # backend (webhook ishlatilsa)
```

BotFather → /setdomain → ngrok URL.
