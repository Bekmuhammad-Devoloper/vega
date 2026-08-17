# MARKETPLACE LOYIHASI — UMUMIY TEXNIK TOPSHIRIQ (TZ)

> **Loyiha nomi:** Marketplace WebApp (Telegram Mini App)
> **Tip:** Ko'p kategoriyali onlayn do'kon (kiyim, telefon, aksessuarlar, elektronika, kosmetika va h.k.)
> **Til:** TypeScript (strict mode) — barcha qismda
> **Reposit struktura:** Monorepo (3 ta package — backend, webapp, admin)
> **Til (UI):** O'zbek va Rus

---

## 1. LOYIHANING MAQSADI

Telegram WebApp orqali ishlaydigan to'liq funksional marketplace. Foydalanuvchi botni ochib mahsulot tanlaydi, savatga qo'shadi, promo kod qo'llaydi, buyurtma beradi. Buyurtma avtomatik Telegram kanalga (admin chat) yuboriladi. Admin panel orqali boshqaruv olib boriladi: mahsulot, kategoriya, buyurtma, foydalanuvchi xulq-atvori, statistika va konversiyalar real vaqtda kuzatiladi.

### Asosiy farq (food bot bilan):
- Bu **marketplace** — ya'ni bir nechta kategoriyali umumiy do'kon (oziq-ovqat emas).
- Mahsulotlar **tasvir + variant** (rang, o'lcham, model) bilan kelishi kerak.
- **Related products** (bog'liq mahsulotlar) logikasi — telefon olganga chexol taklif qilinadi.
- **Behavior tracking** — foydalanuvchining har bir harakatini admin paneldan ko'rish (qaysi mahsulotni ochdi, savatga qo'shdi/chiqardi, qancha vaqt ko'rdi).
- **Haftalik analytics** — har hafta avtomatik yangilanadi, eski hafta ma'lumotlari arxivlanadi yoki o'chadi.

---

## 2. TEXNOLOGIYALAR STEKI

### Backend
| Komponent | Texnologiya | Versiya |
|-----------|-------------|---------|
| Runtime | Node.js | 20.x LTS |
| Framework | NestJS | ^10.x |
| Til | TypeScript | ^5.x (strict mode) |
| DB | PostgreSQL | 16+ |
| ORM | Prisma | ^5.x |
| Cache / Sessions | Redis | 7+ |
| Telegram bot | grammY | ^1.x |
| Realtime | Socket.IO | ^4.x |
| Validation | class-validator + class-transformer | latest |
| Auth | Telegram WebApp `initData` HMAC + JWT (admin uchun) | — |
| File upload | Multer + sharp (rasm optimizatsiyasi) | latest |
| Storage | Local FS (dev) / S3-compatible (prod, ixtiyoriy) | — |
| Logger | nestjs-pino | latest |
| Queue (statistika) | BullMQ | ^5.x |
| Test | Jest + Supertest | latest |

### Frontend (WebApp + Admin)
| Komponent | Texnologiya |
|-----------|-------------|
| Framework | Next.js 15+ (App Router) |
| Til | TypeScript strict |
| UI | React 19 |
| Styling | Tailwind CSS v4 |
| State | Zustand (savat, sevimlilar) + TanStack Query (server state) |
| Form | react-hook-form + zod |
| i18n | next-intl |
| Icons | lucide-react |
| Animatsiya | framer-motion |
| Telegram SDK | `@twa-dev/sdk` |
| Admin chart | Recharts |
| Admin table | TanStack Table |
| Date | dayjs |

### DevOps / Infra
- **Lokal dev:** Docker Compose (Postgres + Redis) + ngrok (Telegram WebApp uchun HTTPS tunnel)
- **Prod:** VPS (Ubuntu) + Nginx reverse-proxy + PM2 / Docker + Let's Encrypt
- **CI/CD:** GitHub Actions (lint, test, build)

---

## 3. MONOREPO STRUKTURASI

```
marketplace/
├── docs/                          # Bu TZ fayllar
│   ├── 00-OVERVIEW.md
│   ├── 01-WEBAPP-BOT-TZ.md
│   ├── 02-ADMIN-PANEL-TZ.md
│   └── 03-DEPLOYMENT-GUIDE.md
├── backend/                       # NestJS API + Telegram bot
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── common/                # Decorators, filters, guards, pipes, interceptors
│   │   ├── config/                # ConfigModule, validation
│   │   ├── prisma/                # PrismaService
│   │   ├── modules/
│   │   │   ├── auth/              # Telegram initData verify + admin JWT
│   │   │   ├── users/
│   │   │   ├── categories/
│   │   │   ├── products/
│   │   │   ├── cart/
│   │   │   ├── favorites/
│   │   │   ├── orders/
│   │   │   ├── promo-codes/
│   │   │   ├── support/           # Support tickets / chat
│   │   │   ├── analytics/         # Event tracking + weekly aggregation
│   │   │   ├── related-products/  # Related rules
│   │   │   ├── telegram-bot/      # grammY bot, channel notification
│   │   │   ├── notifications/     # Socket.IO gateway
│   │   │   └── uploads/
│   │   └── jobs/                  # BullMQ workers (weekly stats)
│   ├── test/
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── webapp/                        # Next.js — foydalanuvchi WebApp
│   ├── src/
│   │   ├── app/
│   │   │   ├── (shop)/
│   │   │   │   ├── page.tsx                  # Home
│   │   │   │   ├── catalog/
│   │   │   │   ├── category/[slug]/
│   │   │   │   ├── product/[id]/
│   │   │   │   ├── cart/
│   │   │   │   ├── favorites/
│   │   │   │   ├── profile/
│   │   │   │   ├── orders/
│   │   │   │   └── support/
│   │   │   ├── layout.tsx
│   │   │   └── globals.css
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── stores/
│   │   ├── i18n/
│   │   │   ├── uz.json
│   │   │   └── ru.json
│   │   └── types/
│   ├── public/
│   ├── next.config.ts
│   └── package.json
└── admin/                         # Next.js — Admin panel (mobile-first)
    ├── src/
    │   ├── app/
    │   │   ├── login/
    │   │   ├── (dashboard)/
    │   │   │   ├── page.tsx              # Overview
    │   │   │   ├── products/
    │   │   │   ├── categories/
    │   │   │   ├── orders/
    │   │   │   ├── users/
    │   │   │   ├── analytics/
    │   │   │   ├── promo-codes/
    │   │   │   ├── support/
    │   │   │   ├── related-rules/
    │   │   │   └── settings/
    │   │   └── layout.tsx
    │   └── ...
    └── package.json
```

---

## 4. BARCHA QISMLARGA OID UMUMIY TALABLAR

### 4.1 Clean Code prinsiplari
- **SOLID** — har bir service bitta vazifa bajaradi.
- **DRY** — kod takrori bo'lmasin. Umumiy logikalar `common/` da.
- **DTO + Validation** — har bir endpointga `class-validator` bilan DTO.
- **Repository pattern** — Prisma `PrismaService` orqali, lekin business logic service'da.
- **Modullarni bo'lib chiqish** — har bir resource alohida NestJS modul.
- **Hech qachon `any` ishlatmaslik** — `unknown` ishlatib type-guard yozish.
- **ESLint + Prettier** — strict config.
- **Husky pre-commit** — lint + format + type-check.

### 4.2 Dizayn tizimi (Design System)
**Asosiy ranglar (rasm asosida):**
- Primary: `#2F6BFF` (yorqin ko'k — CTA, faol kategoriya tab, narx matni)
- Background: `#F4F6FA` (deyarli oq, biroz kulrang)
- Surface (card): `#FFFFFF`
- Text primary: `#0F172A`
- Text secondary: `#64748B`
- Border: `#E5E7EB`
- Success: `#16A34A`
- Danger (discount badge): `#EF4444`
- Favorite icon active: `#EF4444`

**Typography:**
- Sans-serif (system / Inter / Manrope)
- H1: 24px bold, H2: 20px semibold, body: 14px, small: 12px

**Komponentlar:**
- Pill / chip uchun kategoriya tabs (faol — ko'k fon + oq matn; passiv — oq fon + kulrang border)
- Mahsulot kartochka: yuqori chap — discount badge, yuqori o'ng — heart icon, pastda nom + narx (ko'k rang)
- Bottom navigation 4 ta: Katalog, Korzina, Sevimlilar, Profil — faol icon ko'k, passiv kulrang
- Banner carousel: dots indicator pastda

### 4.3 Multilang (i18n)
- **Default:** uz
- **Foydalanuvchi tanlovi** profil → `users.language` ga saqlanadi
- **Admin panel** — alohida til tanlash yo'q (uz/ru aralash bo'lishi mumkin), lekin barcha tugmalar uz da
- **Server-side response** — tilga qarab `products.title_uz` yoki `products.title_ru` qaytariladi (`Accept-Language` header yoki `?lang=ru` query)

### 4.4 Xavfsizlik
- Telegram `initData` HMAC `BOT_TOKEN` bilan tekshirish (`AuthGuard` ichida) — bu **majburiy**, har bir WebApp request da.
- Admin login: email + password (bcrypt) → JWT (HTTP-only cookie, refresh token rotation).
- Rate limit: `@nestjs/throttler` — 60 req/min foydalanuvchi uchun.
- CORS: faqat ruxsat etilgan originlar (`WEBAPP_URL`, `ADMIN_URL`).
- Helmet.
- SQL injection — Prisma allaqachon parametrize qiladi, lekin RAW query'larda ehtiyot.
- File upload — MIME tekshirish, hajm cheklash (5 MB rasm).

### 4.5 Logging va xatoliklar
- `nestjs-pino` — har bir request log.
- Global exception filter — barcha xatoliklarni format qiladi: `{ statusCode, message, error, traceId }`.
- `traceId` har bir request ga UUID.
- Frontend: Sentry (ixtiyoriy, prod uchun).

### 4.6 Performance
- Pagination — har bir list endpoint (default 20 element, max 100).
- Cursor-based pagination tavsiya etiladi (mahsulotlar va analytics uchun).
- Image — sharp orqali avtomatik 3 ta size: thumb (200px), medium (600px), large (1200px). WebP format.
- Frontend rasmlar — `next/image` bilan lazy load.
- Tanstack Query cache — `staleTime: 60s` mahsulot list uchun.

---

## 5. ENV O'ZGARUVCHILAR

### Backend `.env.example`
```env
# Server
NODE_ENV=development
PORT=4000
APP_URL=https://your-domain.uz
WEBAPP_URL=https://webapp.your-domain.uz
ADMIN_URL=https://admin.your-domain.uz

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/marketplace
REDIS_URL=redis://localhost:6379

# JWT (admin)
JWT_ACCESS_SECRET=change-me-32-bytes-min
JWT_REFRESH_SECRET=change-me-different-32-bytes
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d

# Telegram
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_BOT_USERNAME=your_bot
TELEGRAM_ORDERS_CHANNEL_ID=-1001234567890
TELEGRAM_SUPPORT_CHAT_ID=-1001234567891
TELEGRAM_WEBHOOK_SECRET=random-string-here

# Upload
UPLOAD_DIR=./uploads
UPLOAD_MAX_SIZE_MB=5

# Admin seed
ADMIN_SEED_EMAIL=admin@example.com
ADMIN_SEED_PASSWORD=ChangeMe123!

# Analytics
WEEKLY_AGGREGATION_CRON=0 3 * * 1   # Har dushanba 03:00
EVENTS_RETENTION_DAYS=14            # 14 kundan keyin xom event log o'chadi (haftalik aggregated qoladi)
```

### WebApp `.env.example`
```env
NEXT_PUBLIC_API_URL=https://api.your-domain.uz
NEXT_PUBLIC_BOT_USERNAME=your_bot
```

### Admin `.env.example`
```env
NEXT_PUBLIC_API_URL=https://api.your-domain.uz
```

---

## 6. ISHGA TUSHIRISH (Quick Start)

```bash
# 1) Klonlash
cd marketplace

# 2) Backend
cd backend
cp .env.example .env   # qiymatlarni to'ldirish
npm install
docker compose up -d   # postgres + redis
npx prisma migrate dev
npx prisma db seed     # demo data + admin
npm run start:dev

# 3) WebApp
cd ../webapp
cp .env.example .env.local
npm install
npm run dev            # http://localhost:5174

# 4) Admin
cd ../admin
cp .env.example .env.local
npm install
npm run dev            # http://localhost:5175

# 5) Telegram uchun HTTPS tunnel
ngrok http 5174
# olingan https URL ni @BotFather → /setdomain ga qo'yish
# Webhook: ngrok https URL → backend `/telegram/webhook`
```

---

## 7. FAYL HUJJATLARI

Bu OVERVIEW dan keyin quyidagi 3 ta TZ faylni ketma-ket o'qing va bajaring:

1. **`01-WEBAPP-BOT-TZ.md`** — WebApp bot uchun to'liq TZ (foydalanuvchi tomoni)
2. **`02-ADMIN-PANEL-TZ.md`** — Admin panel uchun to'liq TZ
3. **`03-DEPLOYMENT-GUIDE.md`** — Server, ngrok, webhook va prod deployment

---

## 8. ACCEPTANCE CRITERIA (umumiy)

Loyiha **tayyor** deb hisoblanadi qachonki:

- [ ] Foydalanuvchi botni ochadi → WebApp ochiladi → mahsulot ko'rib, savatga qo'shib, buyurtma berishi mumkin.
- [ ] Buyurtma Telegram kanalga to'liq ma'lumot bilan boradi (mahsulotlar, miqdor, jami, foydalanuvchi, telefon, manzil, promo kod).
- [ ] Til almashtirilganda barcha matnlar tarjima qilinadi (uz/ru).
- [ ] Promo kod ishlaydi (foiz va fixed summa, minimal buyurtma summasi, expire date, usage limit).
- [ ] Foydalanuvchi ko'rgan/savatga qo'shgan/chiqargan har bir mahsulot admin paneldan ko'rinadi (real-time).
- [ ] Haftalik statistika cron orqali yig'iladi va admin paneldagi `/analytics` sahifasida grafiklarda chiqadi.
- [ ] Related products — mahsulot sahifasida tegishli aksessuarlar chiqadi (admin rules orqali sozlanadi).
- [ ] Admin panel telefonda ochilganda to'liq ishlaydi (responsive, touch-friendly).
- [ ] Support tiket yuborilganda admin javob bera oladi (yoki to'g'ridan-to'g'ri Telegram support chatga forward bo'ladi).
- [ ] `.env` da bot token va kanal ID o'zgartirilsa kayta build qilmasdan ishlaydi.
- [ ] Hech qaysi qismda `any` yo'q. ESLint sof. Type-check sof.
- [ ] README'da step-by-step ishga tushirish bor.
