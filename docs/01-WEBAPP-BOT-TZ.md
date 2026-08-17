# WEBAPP BOT — TO'LIQ TEXNIK TOPSHIRIQ

> Loyihaning **foydalanuvchi tomoni**: Telegram WebApp Mini App orqali ishlaydigan marketplace. Backend (NestJS) + Frontend (Next.js).

---

## 1. UMUMIY KO'RINISH

### 1.1 Foydalanuvchi flow
1. Foydalanuvchi botga `/start` yozadi → bot **"🛍 Do'konni ochish"** WebApp tugmasini yuboradi.
2. WebApp ochiladi → backendga `initData` yuboradi → server tasdiqlaydi va user'ni DB ga yozadi/yangilaydi.
3. Foydalanuvchi 4 ta asosiy sahifa orasida harakatlanadi: **Katalog / Korzina / Sevimlilar / Profil**.
4. Buyurtma berganda — Telegram kanalga to'liq buyurtma kartochkasi boradi + foydalanuvchiga bot orqali tasdiq xabar.

### 1.2 Asosiy biznes-qoidalar
- **Mehmon rejim yo'q** — barcha foydalanuvchi Telegram orqali avtomatik tanish (`telegramId` unique).
- **Variantlar** — bir mahsulotning bir nechta varianti bo'lishi mumkin (rang, o'lcham). Variant tanlanmasa savatga qo'shib bo'lmaydi.
- **Stock** — har bir variant uchun alohida stock. Stock < 1 bo'lsa "Tugadi" deb ko'rsatiladi.
- **Narx valyutasi:** so'm (UZS). Format: `150 000 so'm` / `150 000 сум`.
- **Bepul yetkazib berish** — buyurtma summasi `FREE_DELIVERY_THRESHOLD` (default 500 000 UZS) dan oshsa, aks holda fixed `DELIVERY_FEE` (default 25 000 UZS).
- **Buyurtma minimal** — 30 000 UZS (`MIN_ORDER_AMOUNT`).
- **Promo kod** — bitta buyurtmaga faqat bitta.

---

## 2. SAHIFALAR (PAGES)

### 2.1 HOME (`/`)
**Komponentlar (yuqoridan pastga):**
1. **Header** — chap: info icon (`/about` ga ochadi yoki modal), markaz: "Store" logo, o'ng: qidiruv icon (`/search` ga).
2. **Banner carousel** — auto-slide har 5 sekundda, swipe ishlaydi, pastda dot indicators. Banner manbasi: `GET /banners?placement=home&active=true`. Banner click → `targetUrl` (mahsulot, kategoriya yoki tashqi link).
3. **Kategoriya tabs** (horizontal scroll, pill style):
   - Birinchi tab: "Hammasi" (default faol).
   - Qolganlari `GET /categories?onlyRoot=true&isVisible=true` dan.
   - Faol — ko'k fon + oq matn. Passiv — oq fon + kulrang border.
   - Tanlangan tab `searchParams.category` ga yoziladi (state URL'da saqlanadi).
4. **"Eng ko'p sotilgan" seksiyasi** (default ko'rinadi):
   - Sarlavha + "Hammasi" link → `/catalog?sort=bestsellers`.
   - Mahsulot kartochkalari 2 ustun grid. Pastga skroll qilganda **infinite scroll** yangi qo'shilganlarni qo'shib boradi (filtered sort: `sort=newest`).
5. **Bottom navigation** (sticky bottom):
   - 4 ta tab: Katalog (faol), Korzina, Sevimlilar, Profil.
   - Korzina va Sevimlilar tabida badge (son) ko'rinadi.

**API ishlatiladi:**
- `GET /banners?placement=home`
- `GET /categories?onlyRoot=true`
- `GET /products?sort=bestsellers&limit=10`
- `GET /products?sort=newest&cursor=...&limit=20` (infinite scroll)
- `GET /cart/summary` (badge uchun)
- `GET /favorites/summary` (badge uchun)

**Track event:** sahifa ochilganda — `view_home`, kategoriya tab bosilganda — `filter_category` (`categoryId` bilan).

---

### 2.2 KATALOG / SEARCH (`/catalog`, `/search`)
**Funksiyalar:**
- Yuqori: search input (debounce 300ms), filter icon (offcanvas drawer ochadi).
- Filter drawer ichida: kategoriya (multi-select), narx oralig'i (range slider min-max), brend (agar bo'lsa), tartiblash (newest / price asc / price desc / bestsellers / discount).
- Filter qo'llanganda URL parametrlarga yoziladi.
- Natijalar grid (2 ustun mobile). Mahsulot bo'lmasa empty state: rasm + "Mahsulot topilmadi" + filter tozalash tugmasi.

**API:**
- `GET /products?q=...&categoryId=...&minPrice=...&maxPrice=...&sort=...&cursor=...&limit=20`

**Track:** `view_catalog`, `search_query` (`q`), `apply_filter`.

---

### 2.3 CATEGORY (`/category/[slug]`)
- Header: kategoriya nomi + rasm banner (agar bor bo'lsa).
- Pastki kategoriyalar (sub-categories) — chip ko'rinishida.
- Mahsulotlar grid + sort/filter (xuddi `/catalog` kabi).

**API:** `GET /categories/by-slug/:slug` + `GET /products?categoryId=...`.

---

### 2.4 PRODUCT DETAIL (`/product/[id]`)
**Komponentlar:**
1. **Rasmlar galereyasi** — swipe carousel, pastda dot indicator, zoom on tap.
2. **Yuqori-o'ng** — heart icon (sevimliga qo'shish/olib tashlash).
3. **Mahsulot nomi** (H1) + reyting (yulduzlar — agar reviews bo'lsa).
4. **Narx bloki** — eski narx (chizilgan) + yangi narx (ko'k, katta) + discount badge.
5. **Variant tanlash**:
   - Rang — circle chips bilan tanlanadi.
   - O'lcham — pill chips.
   - Boshqa variantlar — dropdown.
   - Variantga qarab narx va stock yangilanadi.
6. **Tavsif (description)** — collapsible ("Batafsil ko'rish").
7. **Xususiyatlar (specifications)** — key-value jadval.
8. **Related products** — "Sizga yoqishi mumkin" yoki "Bu mahsulotga qo'shimcha" (related rule asosida — masalan telefon → chexol, qulflar, plyonkalar).
9. **Sticky bottom CTA**:
   - "Savatga qo'shish" (variant tanlanmagan bo'lsa disabled).
   - Bosilganda — savatga qo'shadi + Telegram haptic feedback + toast: "Savatga qo'shildi".
   - Agar mahsulot allaqachon savatda bo'lsa — "+/-" qty controller chiqadi.

**API:**
- `GET /products/:id` — to'liq ma'lumot variantlar bilan
- `GET /products/:id/related` — related products (qoidalar asosida)
- `POST /favorites` / `DELETE /favorites/:productId`
- `POST /cart/items` body: `{ productId, variantId, quantity }`

**Track:** `view_product` (`productId`, `categoryId`, `price`, `durationSec` — sahifada qancha vaqt o'tkazgani — `beforeunload`/`visibilitychange` event'ida hisoblanadi).

---

### 2.5 CART (`/cart`)
**Komponentlar:**
1. Sarlavha "Korzina".
2. Mahsulot itemlari ro'yxati (har biri):
   - Chap: rasm thumbnail.
   - O'rta: nom, variant ("Rang: ko'k, O'lcham: M"), bittasining narxi.
   - O'ng: qty controller (− / N / +).
   - Yuqori-o'ng swipe yoki ikona — o'chirish (`X`).
3. **Promo kod input**:
   - "Promo kod kiriting" placeholder.
   - "Qo'llash" tugmasi → `POST /promo-codes/apply`.
   - Muvaffaqiyatli — yashil chiroq + "Chegirma X% / X so'm qo'llandi" + "Bekor qilish" icon.
   - Xatolik — qizil tekst, sabab (expired/min order/invalid).
4. **Summary bloki**:
   - Mahsulotlar jami: `X so'm`
   - Promo chegirmasi: `−Y so'm` (agar bor)
   - Yetkazib berish: `Z so'm` yoki "Bepul"
   - **Jami:** `XX so'm` (ko'k, katta)
5. **"Buyurtma berish"** sticky bottom CTA → checkout sheet ochadi.

**Checkout sheet (modal yoki yangi route `/cart/checkout`):**
- Ism (auto-fill Telegram'dan)
- Telefon raqami (validation: O'zbek raqami `+998XXXXXXXXX`)
- Yetkazib berish manzili (textarea + ixtiyoriy "Lokatsiya yuborish" — Telegram WebApp `requestLocation` API)
- To'lov turi (radio): **Yetkazganda naqd**, **Yetkazganda karta** (kelajakda Click/Payme integratsiya — hozircha placeholder).
- Izoh (textarea, optional)
- "Tasdiqlash" tugmasi → `POST /orders`. Muvaffaqiyatli — `/orders/:id` success page.

**API:**
- `GET /cart` — barcha itemlar
- `PATCH /cart/items/:id` — qty o'zgartirish
- `DELETE /cart/items/:id`
- `POST /promo-codes/apply` body: `{ code }`
- `DELETE /promo-codes/applied`
- `POST /orders`

**Track:** `view_cart`, `cart_remove_item` (`productId`, `reason`), `promo_apply` (`code`, `success`), `checkout_start`, `order_placed`.

---

### 2.6 FAVORITES (`/favorites`)
- Sevimli mahsulotlar grid (xuddi katalog kabi).
- Empty state: rasm + "Sizda sevimlilar yo'q" + "Katalogga o'tish" tugmasi.
- Har bir kartochkadan heart toggle bilan o'chirish.

**API:** `GET /favorites`, `DELETE /favorites/:productId`.

**Track:** `view_favorites`, `favorite_add` / `favorite_remove`.

---

### 2.7 PROFILE (`/profile`)
**Layout — Uzum Market uslubida:**
- Yuqori: avatar + ism + Telegram username + edit ikona.
- Quyidagi qatorlar (har biri click qilinadigan):
  1. **🛒 Mening buyurtmalarim** → `/orders` (badge: faol buyurtmalar soni)
  2. **❤️ Sevimlilar** → `/favorites`
  3. **🏷 Promo kodlar** → `/promo-codes/my` (qo'llaganlari va mavjudlari)
  4. **🌐 Til** → `uz` / `ru` toggle (modal)
  5. **💬 Yordam (Support)** → `/support`
  6. **ℹ️ Biz haqimizda** → `/about`
  7. **📞 Bog'lanish** → telefon / Telegram link
- Pastda app version + "© 2026 Marketplace".

### 2.8 ORDERS (`/orders`)
- Tabs: "Faol" / "Yakunlangan" / "Bekor qilingan".
- Buyurtma kartochkasi:
  - `#order_number` + sana
  - Status badge (rangli)
  - Mahsulotlar mini-preview (3 ta rasm + "+N")
  - Jami summa
  - Click → `/orders/:id` detail.

**Order detail (`/orders/:id`):**
- Status timeline (vertical): Yangi → Tasdiqlangan → Yo'lda → Yetkazilgan.
- Mahsulotlar to'liq ro'yxati.
- Yetkazib berish ma'lumotlari.
- Promo kod (qo'llangan bo'lsa).
- Jami summa breakdown.
- "Qo'llab-quvvatlashga yozish" tugmasi.
- Agar `status = pending` bo'lsa — "Bekor qilish" tugma (1 soat ichida).

**API:**
- `GET /orders?status=...&cursor=...`
- `GET /orders/:id`
- `POST /orders/:id/cancel`

**Track:** `view_orders`, `view_order_detail`, `order_cancel`.

### 2.9 SUPPORT (`/support`)
- Chat interfeysi yoki tiket forma.
- Variant A (oddiyroq, MVP): forma — mavzu (select), xabar (textarea), "Yuborish" → admin Telegram support chatiga forward + DB ga saqlanadi.
- Variant B (kelajakda): real-time chat (Socket.IO) admin paneldagi support sahifasi bilan.

**MVP — Variant A:**
- `POST /support/tickets` body: `{ subject, message }`
- Yuborilganda toast: "Xabaringiz qabul qilindi, tez orada javob beramiz".
- Admin Telegram chatiga: foydalanuvchi info + xabar + "Javob berish" deeplink (bot deeplink → admin panel ticket detail).

### 2.10 ABOUT, PROMO CODES, LANGUAGE SETTINGS
- **About** — static markdown content (DB'da yoki MDX faylda).
- **Promo codes (`/promo-codes/my`)** — mavjud public promo'lar ro'yxati (`isPublic=true`).
- **Language** — modal: 🇺🇿 O'zbekcha / 🇷🇺 Русский. Tanlanganda `PATCH /users/me` `{ language: 'uz' | 'ru' }`.

---

## 3. BACKEND ARXITEKTURA

### 3.1 Asosiy modullar va vazifalari

| Modul | Vazifa |
|-------|--------|
| `AuthModule` | Telegram `initData` HMAC verify + `TelegramAuthGuard`. JWT yo'q WebApp uchun (har request da initData yuboriladi). |
| `UsersModule` | User CRUD, `users/me`, language o'zgartirish. |
| `CategoriesModule` | Kategoriya tree, slug, visibility. |
| `ProductsModule` | Mahsulot list/detail, variantlar, search, filter, sort. |
| `CartModule` | Savat — server-side (DB) saqlanadi `userId` bo'yicha. |
| `FavoritesModule` | User favorites. |
| `OrdersModule` | Buyurtma yaratish, status, history. Yaratilganda `TelegramBotService` ga event yuboradi. |
| `PromoCodesModule` | Apply, validate, history. |
| `SupportModule` | Tickets / chat. |
| `AnalyticsModule` | Event tracking, weekly aggregation. |
| `RelatedProductsModule` | Related rules CRUD + lookup. |
| `TelegramBotModule` | grammY bot, webhook handler, kanalga buyurtma xabar yuborish. |
| `NotificationsModule` | Socket.IO gateway (admin panel uchun real-time event'lar). |
| `UploadsModule` | Multer + sharp, fayl saqlash. |
| `BannersModule` | Banner CRUD + placement bo'yicha lookup. |

### 3.2 Telegram WebApp auth flow

**Frontend (har bir API call'da):**
```ts
// lib/api.ts
const initData = window.Telegram.WebApp.initData;
fetch(`${API_URL}/products`, {
  headers: {
    'X-Telegram-Init-Data': initData,
    'Accept-Language': locale, // 'uz' yoki 'ru'
  },
});
```

**Backend (`TelegramAuthGuard`):**
```ts
// pseudo
const initDataString = request.headers['x-telegram-init-data'];
const isValid = verifyTelegramInitData(initDataString, BOT_TOKEN); // HMAC SHA256
if (!isValid) throw UnauthorizedException;
const userInfo = parseInitData(initDataString); // { id, username, first_name, ... }
request.user = await usersService.findOrCreate(userInfo);
```

**Algoritm (verify):**
1. `initData` query string sifatida parse.
2. `hash` ni ajratib olish.
3. Qolgan kalitlarni alphabetic order'da `key=value` formatida, `\n` bilan ulash → `dataCheckString`.
4. `secretKey = HMAC_SHA256("WebAppData", BOT_TOKEN)`.
5. `computed = HMAC_SHA256(secretKey, dataCheckString)`.
6. `computed === hash` bo'lsa valid.
7. `auth_date` ni tekshirish — 24 soatdan eski bo'lsa rad et.

### 3.3 PRISMA SCHEMA (asosiy)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Language {
  uz
  ru
}

enum OrderStatus {
  PENDING
  CONFIRMED
  ON_THE_WAY
  DELIVERED
  CANCELLED
}

enum PaymentMethod {
  CASH_ON_DELIVERY
  CARD_ON_DELIVERY
}

enum PromoType {
  PERCENT
  FIXED
}

enum EventType {
  VIEW_HOME
  VIEW_CATALOG
  VIEW_CATEGORY
  VIEW_PRODUCT
  VIEW_CART
  VIEW_FAVORITES
  VIEW_ORDERS
  VIEW_ORDER_DETAIL
  SEARCH_QUERY
  APPLY_FILTER
  CART_ADD
  CART_UPDATE_QTY
  CART_REMOVE
  FAVORITE_ADD
  FAVORITE_REMOVE
  PROMO_APPLY
  PROMO_REMOVE
  CHECKOUT_START
  ORDER_PLACED
  ORDER_CANCEL
  PRODUCT_DURATION
}

model User {
  id            String   @id @default(cuid())
  telegramId    BigInt   @unique
  username      String?
  firstName     String?
  lastName      String?
  photoUrl      String?
  phone         String?
  language      Language @default(uz)
  isBlocked     Boolean  @default(false)
  lastSeenAt    DateTime @default(now())
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  cart          CartItem[]
  favorites     Favorite[]
  orders        Order[]
  events        UserEvent[]
  tickets       SupportTicket[]
  promoUsages   PromoCodeUsage[]
}

model Admin {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  fullName     String
  role         String   @default("admin") // admin | superadmin | manager
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  refreshTokens RefreshToken[]
}

model RefreshToken {
  id         String   @id @default(cuid())
  adminId    String
  tokenHash  String   @unique
  expiresAt  DateTime
  revokedAt  DateTime?
  admin      Admin    @relation(fields: [adminId], references: [id], onDelete: Cascade)
}

model Category {
  id          String     @id @default(cuid())
  slug        String     @unique
  titleUz     String
  titleRu     String
  iconUrl     String?
  bannerUrl   String?
  parentId    String?
  parent      Category?  @relation("Subcats", fields: [parentId], references: [id])
  children    Category[] @relation("Subcats")
  position    Int        @default(0)
  isVisible   Boolean    @default(true)
  products    Product[]
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
}

model Product {
  id            String         @id @default(cuid())
  slug          String         @unique
  sku           String?        @unique
  titleUz       String
  titleRu       String
  descriptionUz String?
  descriptionRu String?
  categoryId    String
  category      Category       @relation(fields: [categoryId], references: [id])
  brand         String?
  basePrice     Decimal        @db.Decimal(12,2)
  oldPrice      Decimal?       @db.Decimal(12,2)
  discountPct   Int?           // computed yoki manual
  isActive      Boolean        @default(true)
  isFeatured    Boolean        @default(false)
  soldCount     Int            @default(0)
  viewCount     Int            @default(0)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  images        ProductImage[]
  variants      ProductVariant[]
  specs         ProductSpec[]
  cartItems     CartItem[]
  favorites     Favorite[]
  orderItems    OrderItem[]
  events        UserEvent[]
  // Related rules
  relatedAsSource RelatedRule[] @relation("source")
  relatedAsTarget RelatedRule[] @relation("target")

  @@index([categoryId, isActive])
  @@index([createdAt])
}

model ProductImage {
  id        String  @id @default(cuid())
  productId String
  url       String
  position  Int     @default(0)
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
}

model ProductVariant {
  id          String  @id @default(cuid())
  productId   String
  product     Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  // optional attributes
  color       String?
  size        String?
  attributes  Json?   // boshqa atributlar uchun
  price       Decimal @db.Decimal(12,2)  // bu variant uchun yakuniy narx
  oldPrice    Decimal? @db.Decimal(12,2)
  stock       Int     @default(0)
  sku         String? @unique
  imageUrl    String?
  isActive    Boolean @default(true)

  cartItems   CartItem[]
  orderItems  OrderItem[]
}

model ProductSpec {
  id        String  @id @default(cuid())
  productId String
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  labelUz   String
  labelRu   String
  valueUz   String
  valueRu   String
  position  Int     @default(0)
}

model CartItem {
  id         String         @id @default(cuid())
  userId     String
  user       User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  productId  String
  product    Product        @relation(fields: [productId], references: [id])
  variantId  String?
  variant    ProductVariant? @relation(fields: [variantId], references: [id])
  quantity   Int            @default(1)
  createdAt  DateTime       @default(now())
  updatedAt  DateTime       @updatedAt

  @@unique([userId, productId, variantId])
}

model Favorite {
  id         String   @id @default(cuid())
  userId     String
  productId  String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  product    Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())

  @@unique([userId, productId])
}

model Order {
  id              String        @id @default(cuid())
  orderNumber     String        @unique // human-readable: M-000123
  userId          String
  user            User          @relation(fields: [userId], references: [id])
  status          OrderStatus   @default(PENDING)
  paymentMethod   PaymentMethod @default(CASH_ON_DELIVERY)

  receiverName    String
  receiverPhone   String
  address         String
  latitude        Float?
  longitude       Float?
  note            String?

  subtotal        Decimal       @db.Decimal(12,2)
  discountAmount  Decimal       @db.Decimal(12,2) @default(0)
  deliveryFee     Decimal       @db.Decimal(12,2) @default(0)
  total           Decimal       @db.Decimal(12,2)

  promoCodeId     String?
  promoCode       PromoCode?    @relation(fields: [promoCodeId], references: [id])
  promoSnapshot   String?       // applied code text

  channelMessageId Int?         // Telegram channel message id (re-edit uchun)

  items           OrderItem[]
  events          OrderEvent[]

  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
}

model OrderItem {
  id         String          @id @default(cuid())
  orderId    String
  order      Order           @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId  String
  product    Product         @relation(fields: [productId], references: [id])
  variantId  String?
  variant    ProductVariant? @relation(fields: [variantId], references: [id])
  // snapshot at moment of order
  titleUz    String
  titleRu    String
  variantLabel String?
  unitPrice  Decimal         @db.Decimal(12,2)
  quantity   Int
  lineTotal  Decimal         @db.Decimal(12,2)
}

model OrderEvent {
  id        String      @id @default(cuid())
  orderId   String
  order     Order       @relation(fields: [orderId], references: [id], onDelete: Cascade)
  status    OrderStatus
  comment   String?
  changedBy String?     // adminId
  createdAt DateTime    @default(now())
}

model PromoCode {
  id              String     @id @default(cuid())
  code            String     @unique
  type            PromoType
  value           Decimal    @db.Decimal(12,2)
  minOrderAmount  Decimal?   @db.Decimal(12,2)
  maxDiscount     Decimal?   @db.Decimal(12,2)
  startsAt        DateTime?
  expiresAt       DateTime?
  usageLimit      Int?       // total
  perUserLimit    Int        @default(1)
  usageCount      Int        @default(0)
  isPublic        Boolean    @default(false)
  isActive        Boolean    @default(true)
  createdAt       DateTime   @default(now())

  usages          PromoCodeUsage[]
  orders          Order[]
}

model PromoCodeUsage {
  id          String    @id @default(cuid())
  promoCodeId String
  userId      String
  orderId     String?
  promoCode   PromoCode @relation(fields: [promoCodeId], references: [id], onDelete: Cascade)
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt   DateTime  @default(now())

  @@unique([promoCodeId, orderId])
}

model SupportTicket {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  subject   String
  message   String
  status    String   @default("open") // open | answered | closed
  channelMessageId Int?
  createdAt DateTime @default(now())
  responses SupportResponse[]
}

model SupportResponse {
  id        String        @id @default(cuid())
  ticketId  String
  ticket    SupportTicket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  fromAdmin Boolean       @default(true)
  message   String
  createdAt DateTime      @default(now())
}

model RelatedRule {
  id              String   @id @default(cuid())
  sourceProductId String?
  sourceCategoryId String?
  targetProductId String?
  targetCategoryId String?
  position        Int      @default(0)
  isActive        Boolean  @default(true)

  sourceProduct   Product? @relation("source", fields: [sourceProductId], references: [id])
  targetProduct   Product? @relation("target", fields: [targetProductId], references: [id])
}

model Banner {
  id          String   @id @default(cuid())
  placement   String   // 'home', 'category', etc.
  imageUrlUz  String
  imageUrlRu  String?
  targetType  String   // 'product' | 'category' | 'url'
  targetValue String
  position    Int      @default(0)
  isActive    Boolean  @default(true)
  startsAt    DateTime?
  endsAt      DateTime?
  createdAt   DateTime @default(now())
}

model UserEvent {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  type        EventType
  productId   String?
  product     Product?  @relation(fields: [productId], references: [id])
  categoryId  String?
  payload     Json?     // qo'shimcha — q (search), filterDelta, durationSec, fromCart reason
  createdAt   DateTime  @default(now())

  @@index([userId, createdAt])
  @@index([type, createdAt])
  @@index([productId, type])
}

// Haftalik aggregated statistika
model WeeklyStat {
  id              String   @id @default(cuid())
  weekStart       DateTime // YYYY-MM-DD (dushanba 00:00 UTC)
  weekEnd         DateTime
  metric          String   // 'views_total', 'orders_total', 'revenue_total', 'top_products', 'conversion_rate', 'category_views'
  scope           String   // 'global' | 'category:<id>' | 'product:<id>'
  data            Json     // {value, breakdown, top10, ...}
  createdAt       DateTime @default(now())

  @@unique([weekStart, metric, scope])
}
```

### 3.4 API ENDPOINT'LAR (WebApp tomonidan ishlatiladigan)

> Hammasiga `X-Telegram-Init-Data` headeri majburiy (faqat `/health`, `/banners` istisno).

#### Auth / Users
- `POST /auth/telegram` — initData ni validate qiladi va user qaytaradi (lekin frontend har request da initData yuboradi, alohida login endpoint shart emas; lekin `/users/me` borligi yaxshi).
- `GET /users/me`
- `PATCH /users/me` body: `{ language?, phone?, firstName? }`

#### Catalog
- `GET /categories?onlyRoot=&isVisible=`
- `GET /categories/by-slug/:slug`
- `GET /products` query: `q, categoryId, minPrice, maxPrice, brand, sort, cursor, limit`
  - `sort`: `newest | price_asc | price_desc | bestsellers | discount`
- `GET /products/:id`
- `GET /products/:id/related`
- `GET /banners?placement=`

#### Cart
- `GET /cart`
- `POST /cart/items` body: `{ productId, variantId?, quantity }`
- `PATCH /cart/items/:id` body: `{ quantity }`
- `DELETE /cart/items/:id`
- `DELETE /cart` — tozalash
- `GET /cart/summary` — `{ count, total }`

#### Favorites
- `GET /favorites`
- `POST /favorites` body: `{ productId }`
- `DELETE /favorites/:productId`
- `GET /favorites/summary` — `{ count }`

#### Orders
- `POST /orders` body: checkout DTO
- `GET /orders?status=&cursor=`
- `GET /orders/:id`
- `POST /orders/:id/cancel`

#### Promo
- `POST /promo-codes/apply` body: `{ code }` (sessiya yo'q, faqat draft cart bilan validate qiladi; checkoutda ham qayta validate)
- `DELETE /promo-codes/applied`
- `GET /promo-codes/public` — public promo'lar ro'yxati

#### Support
- `POST /support/tickets` body: `{ subject, message }`
- `GET /support/tickets/my`

#### Analytics (track endpoint)
- `POST /events` body: `{ type, productId?, categoryId?, payload? }` — frontend track qiladi
  - Frontend batched yuboradi har 5 sekundda yoki sahifa o'zgarganda (sendBeacon).

### 3.5 TELEGRAM BOT (grammY)

**Bot funksiyalari:**
- `/start` — welcome + WebApp button + til tanlash inline keyboard.
- `/help` — kontaktlar.
- WebApp data callback (`web_app_data`) — agar kerak bo'lsa (asosan API ishlaydi, bu reserve).

**Channel posting service:**
```ts
// Order yaratilganda
@OnEvent('order.created')
async handleOrderCreated(order: OrderWithRelations) {
  const text = formatOrderForChannel(order); // structured: 🛒 #M-000123, items, total, customer, address, time
  const message = await this.bot.api.sendMessage(
    process.env.TELEGRAM_ORDERS_CHANNEL_ID,
    text,
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text('✅ Tasdiqlash', `confirm:${order.id}`)
        .text('🚚 Yo\'lda', `onway:${order.id}`)
        .row()
        .text('❌ Bekor qilish', `cancel:${order.id}`)
    }
  );
  await this.ordersService.attachChannelMessage(order.id, message.message_id);
}
```

Callback button bosilganda — status yangilanadi, kanaldagi xabar **edit** qilinadi (yangi status badge bilan).

**Webhook vs Polling:**
- **Dev:** polling (ngrok bilan webhook ham mumkin).
- **Prod:** webhook — `POST /telegram/webhook` (secret token bilan tekshirish).

### 3.6 ANALYTICS & BEHAVIOR TRACKING

**Xom event log (`UserEvent`):**
- Frontend har bir user actionni `POST /events` ga yuboradi (batched).
- DB ga insert qilinadi.
- `EVENTS_RETENTION_DAYS` (default 14) dan eski eventlar har kuni cron orqali tozalanadi.

**Real-time admin notification:**
- `UserEvent` create bo'lganda — `NotificationsGateway.emit('user-event', payload)` orqali admin Socket.IO room'ga yuboriladi.
- Admin panelda "Live activity" feed real vaqtda ko'rinadi.

**Haftalik aggregation (BullMQ cron job):**
- `WEEKLY_AGGREGATION_CRON` (default har dushanba 03:00).
- Oxirgi 7 kunlik eventlar va orderlar bo'yicha quyidagilar hisoblanadi:
  - `views_total`, `unique_users`
  - `orders_total`, `revenue_total`, `avg_order_value`
  - `conversion_rate` = orders / view_product (unique users)
  - `cart_abandonment_rate` = cart_add - order_placed / cart_add
  - `top_products` (top 10 ko'rilgan, top 10 sotilgan)
  - `top_categories`
  - `interest_by_category` — har bir kategoriyaga qiziqish (view + favorite + cart_add weighted)
- `WeeklyStat` jadvaliga yoziladi (`metric` + `scope` bo'yicha).
- **Eski haftalar:** so'nggi 12 hafta saqlanadi, qolganlari o'chiriladi (yoki S3 arxiv — ixtiyoriy).

**Per-user behavior view (admin uchun):**
- `GET /admin/users/:id/timeline?from=&to=` — user uchun barcha eventlar timeline.
- `GET /admin/users/:id/interests` — top kategoriya/brendlar (interest score).

### 3.7 RELATED PRODUCTS LOGIKASI

**Qoidalar 2 darajada:**
1. **Manual rules** — admin paneldan: "Telefon X → chexol Y, Z, W" yoki "Smartfonlar kategoriyasi → Aksessuarlar kategoriyasi".
2. **Auto fallback** — agar manual rule yo'q bo'lsa:
   - Bir xil kategoriyadagi `isFeatured=true` mahsulotlar
   - Yoki `co-purchase`: shu mahsulot bilan birga sotib olingan mahsulotlar (SQL: `OrderItem` jadvalidan groupby).

**Endpoint:**
```
GET /products/:id/related
→ 1) RelatedRule.product → product orqali qidir
→ 2) RelatedRule.product → category orqali (target kategoriya mahsulotlari)
→ 3) RelatedRule.category → category
→ 4) Fallback: co-purchase top 8
```

### 3.8 PROMO KOD LOGIKASI

**Validatsiya tekshiruvlari:**
1. `isActive=true`
2. `startsAt <= now <= expiresAt` (agar bor)
3. `usageCount < usageLimit` (agar bor)
4. User uchun `count(PromoCodeUsage where userId) < perUserLimit`
5. `subtotal >= minOrderAmount`
6. Hisoblash:
   - `PERCENT`: `discount = min(subtotal * value/100, maxDiscount ?? Infinity)`
   - `FIXED`: `discount = min(value, subtotal)`

**Atomic apply (race condition'ga qarshi):**
- Order yaratilganda — DB transaction ichida:
  1. Promo qayta validate.
  2. `usageCount` ni `UPDATE ... WHERE usageCount < usageLimit` (yoki advisory lock).
  3. `PromoCodeUsage` insert.
  4. `Order.promoCodeId, discountAmount` set.

---

## 4. FRONTEND TAFSILOTI (WebApp)

### 4.1 Loyiha sturkturasi
```
webapp/src/
├── app/
│   ├── layout.tsx              # html, body, providers
│   ├── globals.css             # tailwind + custom
│   ├── (shop)/
│   │   ├── layout.tsx          # header + bottomnav wrapper
│   │   ├── page.tsx            # home
│   │   ├── catalog/page.tsx
│   │   ├── category/[slug]/page.tsx
│   │   ├── product/[id]/page.tsx
│   │   ├── cart/page.tsx
│   │   ├── cart/checkout/page.tsx
│   │   ├── favorites/page.tsx
│   │   ├── profile/page.tsx
│   │   ├── orders/page.tsx
│   │   ├── orders/[id]/page.tsx
│   │   ├── promo-codes/my/page.tsx
│   │   ├── support/page.tsx
│   │   ├── about/page.tsx
│   │   └── search/page.tsx
│   └── error.tsx, not-found.tsx, loading.tsx
├── components/
│   ├── ui/                     # Button, Input, Sheet, Drawer, Modal, Chip, Badge, Toast, Spinner
│   ├── shop/
│   │   ├── BottomNav.tsx
│   │   ├── Header.tsx
│   │   ├── BannerCarousel.tsx
│   │   ├── CategoryTabs.tsx
│   │   ├── ProductCard.tsx
│   │   ├── ProductGrid.tsx
│   │   ├── PriceLabel.tsx
│   │   ├── QtyControl.tsx
│   │   ├── VariantPicker.tsx
│   │   ├── RelatedProducts.tsx
│   │   ├── PromoCodeInput.tsx
│   │   ├── EmptyState.tsx
│   │   └── ProductDetail/*
├── hooks/
│   ├── useTelegram.ts          # WebApp SDK wrapper
│   ├── useTrackEvent.ts        # batched event sender
│   ├── useCart.ts              # Zustand store hook
│   ├── useFavorites.ts
│   ├── useLocale.ts
│   └── useProductDuration.ts   # sahifada qancha vaqt — track qiladi
├── lib/
│   ├── api/                    # client (TanStack Query bilan), endpointlar
│   ├── format.ts               # narx, sana
│   ├── telegram.ts             # initData, haptic, BackButton, MainButton wrappers
│   └── env.ts
├── stores/
│   ├── cartStore.ts            # Zustand (server bilan sync)
│   ├── favoritesStore.ts
│   └── uiStore.ts              # filter drawer, toast
├── i18n/
│   ├── config.ts               # next-intl config
│   ├── messages/uz.json
│   └── messages/ru.json
└── types/
    └── api.ts                  # backend dtos mirror
```

### 4.2 Telegram WebApp SDK integratsiya

```ts
// hooks/useTelegram.ts
import { useEffect } from 'react';
import WebApp from '@twa-dev/sdk';

export const useTelegram = () => {
  useEffect(() => {
    WebApp.ready();
    WebApp.expand();
    WebApp.setHeaderColor('#FFFFFF');
    WebApp.setBackgroundColor('#F4F6FA');
    WebApp.enableClosingConfirmation();
  }, []);
  return {
    user: WebApp.initDataUnsafe.user,
    initData: WebApp.initData,
    haptic: WebApp.HapticFeedback,
    showAlert: WebApp.showAlert.bind(WebApp),
    showConfirm: WebApp.showConfirm.bind(WebApp),
    BackButton: WebApp.BackButton,
    MainButton: WebApp.MainButton,
    requestLocation: () => /* Telegram WebApp 7.x location API */,
  };
};
```

**BackButton avtomatik** — `usePathname()` watch qilib, root emas sahifalarda `BackButton.show()`.

**Haptic feedback** — savatga qo'shganda `impactOccurred('light')`, xatoda `notificationOccurred('error')`.

### 4.3 i18n (next-intl)

`messages/uz.json` namuna:
```json
{
  "nav": { "catalog": "Katalog", "cart": "Korzina", "favorites": "Sevimlilar", "profile": "Profil" },
  "home": { "bestsellers": "Eng ko'p sotilgan", "newArrivals": "Yangi qo'shilganlar" },
  "product": { "addToCart": "Savatga qo'shish", "inCart": "Savatda", "outOfStock": "Tugadi" },
  "cart": { "title": "Korzina", "empty": "Korzina bo'sh", "promoPlaceholder": "Promo kod kiriting", "applyPromo": "Qo'llash", "total": "Jami", "checkout": "Buyurtma berish" },
  "checkout": { "name": "Ism", "phone": "Telefon", "address": "Manzil", "submit": "Tasdiqlash" }
}
```

**Til faqat profil orqali almashtiriladi** — auto-detect Telegram `language_code` faqat birinchi marta.

### 4.4 Event tracking (frontend)

```ts
// hooks/useTrackEvent.ts
const queue: EventDto[] = [];
let flushTimer: NodeJS.Timeout;

export const track = (event: EventDto) => {
  queue.push(event);
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 3000);
  if (queue.length >= 10) flush();
};

const flush = () => {
  if (queue.length === 0) return;
  const batch = queue.splice(0);
  navigator.sendBeacon(
    `${API_URL}/events/batch`,
    new Blob([JSON.stringify({ events: batch, initData })], { type: 'application/json' })
  );
};

window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flush();
});
```

**`useProductDuration` hook** — `view_product` paytida `Date.now()` saqlaydi, sahifa o'zgarganda yoki `visibilitychange` da `PRODUCT_DURATION` event yuboradi `payload: { productId, durationSec }`.

### 4.5 Savat state (Zustand + server sync)

```ts
// stores/cartStore.ts
type CartStore = {
  items: CartItem[];
  isLoading: boolean;
  fetch: () => Promise<void>;
  add: (input: AddCartInput) => Promise<void>;
  updateQty: (itemId: string, qty: number) => Promise<void>;
  remove: (itemId: string) => Promise<void>;
};

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  isLoading: false,
  fetch: async () => { ... },
  add: async (input) => {
    // optimistic update + invalidate
  },
  ...
}));
```

App boot da `cartStore.fetch()` chaqiriladi.

---

## 5. NON-FUNCTIONAL TALABLAR

- **Sahifa yuklanish vaqti:** Home — < 1.5s (FCP), product detail — < 1.2s.
- **Lighthouse mobile:** Performance > 90, A11y > 90.
- **Bundle:** initial chunk < 200KB gzip.
- **Offline behavior:** Telegram WebApp ichida internet uzilsa — toast: "Internet aloqasi uzildi", retry.
- **Iconlar:** lucide-react (tree-shake).
- **Animatsiya:** framer-motion bilan sheet/drawer slide-up, page transition (subtle).
- **Accessibility:** tugmalarda `aria-label`, kontrast WCAG AA.

---

## 6. ACCEPTANCE CRITERIA (WebApp)

- [ ] `/start` → WebApp ochilib bosh sahifa muvaffaqiyatli ko'rinadi.
- [ ] Til o'zgartirish ishlaydi va barcha matnlar tarjima qilinadi.
- [ ] Banner carousel auto-slide qiladi va banner click target'ga olib boradi.
- [ ] Kategoriya tabs orasida o'tganda mahsulotlar filtrlanadi.
- [ ] Mahsulot detail sahifasida variant tanlanmasa "Savatga qo'shish" disabled.
- [ ] Savatda qty `+/−` ishlaydi va summary real-time yangilanadi.
- [ ] Promo kod qo'llanganda chegirma to'g'ri hisoblanadi, expired/min order da xatolik ko'rinadi.
- [ ] Buyurtma yaratilganda Telegram kanalga formatted xabar boradi, inline tugmalar status'ni o'zgartiradi.
- [ ] Foydalanuvchi ko'rgan har bir mahsulot va savat amali admin paneldagi "Live activity" da real vaqtda ko'rinadi.
- [ ] Sevimlilar Saqlanib qoladi (server-side).
- [ ] Profil sahifasidan barcha sublink'lar ishlaydi.
- [ ] Mahsulot detailida related products chiqadi (qoida bo'yicha yoki fallback).
- [ ] Yetkazib berish bepulligi va minimal buyurtma tekshiruvi ishlaydi.
- [ ] Mobile da iOS Safari (Telegram WebView) va Android Chrome (Telegram WebView) da bug'siz ishlaydi.
- [ ] `npm run build` xatosiz, `npm run lint` sof, TypeScript strict sof.
