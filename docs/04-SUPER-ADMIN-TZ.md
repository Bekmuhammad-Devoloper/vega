# 🔐 SUPER ADMIN PANEL — Texnik Vazifa (TZ)

> **Platform Owner Dashboard** — siz va devops jamoangiz uchun butun SaaS platformani boshqarish paneli.
> Mijoz uchun emas — bu platforma egasi uchun "control tower".

---

## 📑 Mundarija

1. [Maqsad va Kontekst](#1-maqsad-va-kontekst)
2. [Arxitektura](#2-arxitektura)
3. [Database O'zgartirishlari](#3-database-ozgartirishlari)
4. [Sahifalar va Funksionallik](#4-sahifalar-va-funksionallik)
5. [Rollar va Ruxsatlar](#5-rollar-va-ruxsatlar)
6. [Texnik Stack](#6-texnik-stack)
7. [Bosqichma-bosqich Reja](#7-bosqichma-bosqich-reja)
8. [Xavfsizlik](#8-xavfsizlik)

---

## 1. Maqsad va Kontekst

### Vaziyat
- Hozirgi `admin/` panel — **mijoz panel** (har bir do'kon egasi o'z do'konini boshqaradi)
- Bizga **platforma egasi paneli** kerak — siz hamma do'konlarni nazorat qilasiz

### Asosiy maqsadlar
1. **Mijozlarni (tenants) boshqarish** — kim qaysi tarifda, faolligi, to'lovlari
2. **Real-time platforma sog'ligi** — server, AI, payment health
3. **Daromad va analitika** — MRR, ARR, churn, LTV
4. **Avtomatik billing** — tarif obunalari, AI kreditlar, invoice
5. **Operativ boshqaruv** — support, broadcast, debugging
6. **Komanda boshqaruvi** — kim nima qila oladi

---

## 2. Arxitektura

### Loyiha strukturasi
```
marketplace/
├── admin/              # MAVJUD — mijoz panel (client/tenant admin)
├── superadmin/         # YANGI — platform owner panel
├── webapp/             # MAVJUD — mijoz Telegram WebApp
├── backend/
│   └── src/modules/
│       ├── admin/             # mavjud klient admin API
│       ├── super-admin/       # YANGI — platform admin API
│       ├── tenants/           # YANGI — tenant boshqaruvi
│       ├── billing/           # YANGI — tarif, to'lov, invoice
│       ├── ai-credits/        # YANGI — AI sarf monitoring
│       └── platform-stats/    # YANGI — platforma analitikasi
```

### Multi-tenant strategiya

**Variantlar:**
| Variant | Plus | Minus | Tavsiya |
|---|---|---|---|
| **A. Shared DB + tenantId** | Tezkor migratsiya, arzon | Data isolation kuchsiz | ⭐ Boshlang'ich uchun |
| **B. Schema per tenant** | Yaxshi isolation | Migratsiyalar qiyin | O'rta o'lchamlar uchun |
| **C. Database per tenant** | Maks isolation | Qimmat, murakkab | Premium mijozlar uchun |

**Tavsiya:** Variant A — har modelga `tenantId` qo'shamiz, Postgres RLS bilan himoya.

### Auth ajratish
- **Mijoz admin** → `Admin` model (mavjud), JWT, scope: `tenant:<id>`
- **Super admin** → `PlatformAdmin` model (yangi), alohida JWT, scope: `platform:*`
- **Mutlaq alohida** subdomain: `superadmin.platform.uz`
- IP allowlist + 2FA majburiy

---

## 3. Database O'zgartirishlari

### Yangi modellar

```prisma
// Mijoz do'koni (tenant)
model Tenant {
  id            String   @id @default(cuid())
  slug          String   @unique           // shop-name.platform.uz
  shopName      String
  ownerName     String
  ownerEmail    String   @unique
  ownerPhone    String?
  ownerTelegramId BigInt?

  // Tarif
  tariffPlan    TariffPlan @default(FREE)
  tariffStartedAt DateTime @default(now())
  tariffExpiresAt DateTime?
  isOnTrial     Boolean  @default(false)
  trialEndsAt   DateTime?

  // Status
  status        TenantStatus @default(ACTIVE)
  suspendedReason String?
  suspendedAt   DateTime?

  // Brendlash
  logoUrl       String?
  primaryColor  String?
  customDomain  String?  @unique
  isWhiteLabel  Boolean  @default(false)

  // Telegram bot
  botToken      String?  @unique
  botUsername   String?
  channelId     String?

  // Limitlar (tariff'dan override)
  customLimits  Json?    // { maxProducts: 500, ... }

  // Statistika (cache)
  lastActivityAt DateTime @default(now())
  totalRevenue  Decimal  @default(0) @db.Decimal(15, 2)
  totalOrders   Int      @default(0)

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Relations
  subscriptions Subscription[]
  invoices      Invoice[]
  aiUsage       AICreditUsage[]
  resourceStats TenantResourceStat[]

  @@index([status, tariffPlan])
  @@index([ownerEmail])
}

enum TariffPlan {
  FREE
  STANDARD
  PRO
  PREMIUM
}

enum TenantStatus {
  ACTIVE
  SUSPENDED
  CANCELLED
  PENDING_PAYMENT
}

// Obunalar tarixi
model Subscription {
  id           String   @id @default(cuid())
  tenantId     String
  tenant       Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  plan         TariffPlan
  amount       Decimal  @db.Decimal(12, 2)
  currency     String   @default("UZS")

  startsAt     DateTime
  endsAt       DateTime
  status       SubscriptionStatus @default(ACTIVE)
  paymentMethod String?           // payme, click, manual

  cancelledAt  DateTime?
  cancelReason String?
  autoRenew    Boolean  @default(true)

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  invoices     Invoice[]

  @@index([tenantId, status])
  @@index([endsAt])
}

enum SubscriptionStatus {
  ACTIVE
  EXPIRED
  CANCELLED
  PAST_DUE
}

// Invoyslar / to'lovlar
model Invoice {
  id              String   @id @default(cuid())
  invoiceNumber   String   @unique
  tenantId        String
  tenant          Tenant   @relation(fields: [tenantId], references: [id])
  subscriptionId  String?
  subscription    Subscription? @relation(fields: [subscriptionId], references: [id])

  amount          Decimal  @db.Decimal(12, 2)
  currency        String   @default("UZS")
  status          InvoiceStatus @default(PENDING)

  paymentProvider String?  // payme, click, manual
  providerTxId    String?
  paidAt          DateTime?

  dueDate         DateTime
  description     String?
  metadata        Json?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId, status])
  @@index([status, dueDate])
}

enum InvoiceStatus {
  PENDING
  PAID
  FAILED
  REFUNDED
  CANCELLED
}

// AI kredit sarflari (har bir operatsiya)
model AICreditUsage {
  id            String   @id @default(cuid())
  tenantId      String
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  operation     AIOperation
  model         String              // gpt-4o-mini, gpt-image-1
  inputTokens   Int?
  outputTokens  Int?
  imagesCount   Int?

  costUsd       Decimal  @db.Decimal(10, 6)
  costUzs       Decimal  @db.Decimal(12, 2)

  productId     String?            // qaysi mahsulot uchun (agar bog'liq)
  status        String   @default("success")  // success, failed, retry
  errorMessage  String?

  createdAt     DateTime @default(now())

  @@index([tenantId, createdAt])
  @@index([operation, createdAt])
  @@index([createdAt])
}

enum AIOperation {
  AUTO_FILL_TEXT
  IMAGE_GENERATE
  IMAGE_ENHANCE
  IMAGE_BG_REMOVE
  TRANSLATE
  CHAT
}

// Tenant resurs sarfi (kunlik snapshot)
model TenantResourceStat {
  id            String   @id @default(cuid())
  tenantId      String
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  date          DateTime @db.Date
  storageMb     Float    @default(0)        // SSD
  dbSizeMb      Float    @default(0)        // database size
  imagesCount   Int      @default(0)
  productsCount Int      @default(0)
  ordersCount   Int      @default(0)
  activeUsersCount Int   @default(0)

  apiCallsCount Int      @default(0)
  bandwidthMb   Float    @default(0)

  createdAt     DateTime @default(now())

  @@unique([tenantId, date])
  @@index([date])
}

// Platforma admin (siz va jamoangiz)
model PlatformAdmin {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String
  fullName      String
  role          PlatformRole @default(SUPPORT)

  isActive      Boolean  @default(true)
  twoFactorSecret String?
  twoFactorEnabled Boolean @default(false)

  lastLoginAt   DateTime?
  lastLoginIp   String?

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  auditLogs     PlatformAuditLog[]
  refreshTokens PlatformRefreshToken[]
}

enum PlatformRole {
  OWNER        // siz — hammasi
  DEVOPS       // server, deploy, monitoring
  FINANCE      // billing, payments, invoices
  SALES        // tenants, subscriptions, upgrade
  SUPPORT      // tickets, broadcasts
}

model PlatformRefreshToken {
  id        String   @id @default(cuid())
  adminId   String
  admin     PlatformAdmin @relation(fields: [adminId], references: [id], onDelete: Cascade)
  tokenHash String   @unique
  expiresAt DateTime
  revokedAt DateTime?
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())

  @@index([adminId])
}

// Audit log — kim nima qildi
model PlatformAuditLog {
  id        String   @id @default(cuid())
  adminId   String
  admin     PlatformAdmin @relation(fields: [adminId], references: [id])

  action    String           // "tenant.suspend", "tariff.change", ...
  targetType String?         // "tenant", "subscription", ...
  targetId  String?
  changes   Json?            // before/after diff
  ipAddress String?
  userAgent String?

  createdAt DateTime @default(now())

  @@index([adminId, createdAt])
  @@index([action, createdAt])
  @@index([targetType, targetId])
}

// Tarif konfiguratsiyasi (admin tahrirlashi mumkin)
model TariffConfig {
  id            String   @id @default(cuid())
  plan          TariffPlan @unique

  // Narxlar
  monthlyPrice  Decimal  @db.Decimal(12, 2)
  yearlyPrice   Decimal  @db.Decimal(12, 2)
  yearlyDiscount Int     @default(20)        // %

  // Limitlar
  maxCategories Int
  maxProducts   Int
  maxBanners    Int
  maxImagesPerProduct Int
  maxOptionsPerProduct Int

  // AI limitlar (oylik)
  aiImagesPerMonth Int
  aiAutoFillPerMonth Int

  // Features (boolean flags)
  features      Json     // { paymeIntegration: true, ... }

  // Display
  badge         String?  // "ENG MASHHUR"
  description   String?
  isActive      Boolean  @default(true)
  position      Int      @default(0)

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

// Promo offer'lar (boshlang'ich chegirma)
model PromoOffer {
  id            String   @id @default(cuid())
  code          String   @unique
  name          String

  discountType  String   // "percent" | "fixed" | "trial_days"
  discountValue Decimal  @db.Decimal(12, 2)
  applicablePlans TariffPlan[]

  validFrom     DateTime
  validUntil    DateTime
  usageLimit    Int?
  usedCount     Int      @default(0)

  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
}

// Platforma sozlamalari
model PlatformSettings {
  key       String   @id
  value     Json
  category  String   @default("general")
  updatedBy String?
  updatedAt DateTime @updatedAt
}
```

### Mavjud modellarga `tenantId` qo'shish

Quyidagi modellarga `tenantId String` va relation qo'shiladi:
- `Category`, `Product`, `Banner`, `Order`, `User`, `Admin`
- `PromoCode`, `SupportTicket`, `Broadcast`, `Settings`
- `UserEvent`, `WeeklyStat`, `OrderRecommendation`

**Migratsiya strategiyasi:**
1. Yangi `Tenant` yaratish (default tenant)
2. Mavjud barcha rowlarni shu tenantga bog'lash
3. Yangi modellarga `@@index([tenantId, ...])` qo'shish
4. Application-level scope middleware (har query tenantId filter)
5. Postgres RLS (Row Level Security) qo'shish — defense in depth

---

## 4. Sahifalar va Funksionallik

### 4.1 🏠 Dashboard (`/`)

**KPI kartochkalari (real-time):**
- Jami do'konlar (faol / nofaol)
- MRR (Monthly Recurring Revenue)
- ARR (Annual Recurring Revenue)
- Bu oydagi yangi obunalar
- Churn rate (oylik)
- AI sarfi (bu oy, USD + UZS)

**Grafiklar:**
- Daromad o'sishi (12 oy, line chart)
- Yangi do'konlar (30 kun, area chart)
- Tarif taqsimoti (donut chart)
- AI sarf trend (bar chart)

**Activity feed (real-time):**
- "Toshkent Eshik" do'koni Pro tarifga o'tdi
- 3 yangi to'lov qabul qilindi (Payme)
- Server SSD 60%'ga to'ldi

**Quick actions:**
- Tenant qidirish
- Broadcast yuborish
- Invoice yaratish

### 4.2 🏪 Tenants — Do'konlar (`/tenants`)

**Ro'yxat sahifa:**
- Jadval: nomi, egasi, tarif, status, MRR, oxirgi faollik, harakat
- Filtrlar: tarif, status, ro'yxatdan o'tgan sana, MRR diapazon
- Qidiruv: nomi, email, telefon, slug
- Sort: yaratilgan, MRR, mahsulot soni, buyurtma soni
- Bulk actions: broadcast, eksport, ban

**Tenant Detail (`/tenants/:id`):**
- **Overview tab** — KPI'lar, hozirgi tarif, statistika
- **Activity tab** — barcha harakatlar timeline
- **Subscription tab** — obuna tarixi, manual upgrade
- **Billing tab** — to'lovlar, invoices, refund
- **AI Usage tab** — har bir AI operation log
- **Resources tab** — SSD, DB size, images count
- **Catalog tab** — read-only access (mahsulotlar, banner)
- **Orders tab** — read-only (buyurtmalar)
- **Settings tab** — admin sozlamalari ko'rinishi

**Actions:**
- 🔄 Tariff change (manual upgrade/downgrade)
- ⏸ Suspend (sabab bilan)
- ▶️ Resume
- 🎁 Trial extend
- 🔑 **Impersonate** — mijoz panelga kirish (debug uchun)
- 📧 Send message (TG/email)
- 🗑 Delete (yumshoq + qattiq)

### 4.3 💳 Subscriptions (`/subscriptions`)

- Hamma faol obunalar ro'yxati
- Filtrlar: tarif, status, expire date
- Yaqinda muddati tugaydiganlar (30 kun)
- Past due (to'lovi muddati o'tgan)
- Manual renewal
- Bulk reminder yuborish

### 4.4 🧾 Billing & Payments (`/billing`)

**Invoices:**
- Hamma invoyslar
- Status filter: pending, paid, failed, refunded
- Manual invoice yaratish
- PDF download
- Refund (admin tasdiqi bilan)

**Payments:**
- Real-time to'lov stream
- Payme va Click alohida
- Failed payment retry
- Reconciliation (bank statement bilan solishtirish)

**Revenue Analytics:**
- Daromad bo'yicha to'lov usuli
- Geografik taqsimot (viloyat)
- Refund rate
- Average revenue per user

### 4.5 🤖 AI Credits (`/ai`)

**Overview:**
- Bu oydagi jami AI sarf (USD + UZS)
- Provider bo'yicha taqsimot (OpenAI, balki Anthropic)
- Operation bo'yicha taqsimot

**Per Tenant:**
- Kim eng ko'p AI ishlatadi (top 20)
- Quota overflow (limitdan oshganlar)
- Suspend AI ogohlantirishi

**Provider boshqaruvi:**
- API key rotation
- Rate limit konfiguratsiyasi
- Failover (zaxira provider)
- Cost alert (oylik byudjet)

### 4.6 📊 Platform Analytics (`/analytics`)

- **Cohort analysis** — qachon ro'yxatdan o'tgan, qancha vaqt qoldi
- **Funnel** — registratsiya → first product → first sale → upgrade
- **Retention** — D1, D7, D30
- **Feature usage** — qaysi funksiya qancha ishlatiladi
- **Geographic distribution** — viloyatlar bo'yicha

### 4.7 🖥 Server & Resources (`/infrastructure`)

- Server health: CPU, RAM, SSD, network
- Database: connections, slow queries, size
- Redis: memory, hit rate
- Image storage (R2/S3): total size, bandwidth
- Background jobs: queue depth, failed jobs
- Cron monitor: oxirgi ishlash, xato
- Logs viewer (filter by tenant)

### 4.8 🎫 Support Inbox (`/support`)

- Hamma tiketlar (barcha tenants)
- Filter: tenant, status, prioritet
- Assign to agent
- SLA tracking (1-soat, 4-soat, 24-soat)
- Internal notes
- Bulk reply templates

### 4.9 📢 Broadcasts (`/broadcasts`)

**Targeting:**
- Hamma tenant adminlariga
- Tarif bo'yicha (faqat Free)
- Region bo'yicha
- Faollik bo'yicha (oxirgi 7 kun ichida login)
- Custom segment (SQL builder)

**Channels:**
- Telegram message
- Email
- In-app notification (admin panelda)
- SMS (Premium)

**Templates:**
- Tariff upgrade offer
- New feature announcement
- Maintenance window
- Onboarding sequence

**Scheduled:**
- Drip campaign (onboarding)
- Recurring (haftalik newsletter)

### 4.10 👥 Platform Team (`/team`)

- Komanda a'zolari (PlatformAdmin)
- Rol tayinlash: OWNER, DEVOPS, FINANCE, SALES, SUPPORT
- 2FA majburiyligi
- Last login + IP
- Suspend / remove
- Invite link

### 4.11 📜 Audit Log (`/audit`)

- Har bir super-admin harakati
- Filter: kim, qachon, nima
- Before/after diff
- IP, user agent
- Eksport (CSV)

### 4.12 ⚙️ Tariff Config (`/tariffs`)

- Tariflarni tahrirlash:
  - Narx (monthly, yearly)
  - Limitlar (kategoriya, mahsulot, banner)
  - AI limitlar
  - Features (toggle)
- A/B test (yangi tarif sinab ko'rish)
- Promo offers boshqaruvi

### 4.13 🔧 Platform Settings (`/settings`)

- AI provider konfiguratsiyasi
- Payment gateway sozlamalari
- Email templates
- TG bot tokens (master bot)
- Feature flags
- Maintenance mode toggle

### 4.14 🔍 Dev Tools (`/dev`)

(faqat OWNER va DEVOPS uchun)
- Safe SQL query runner (faqat SELECT)
- Cache clear (Redis flush)
- Job queue monitor (BullMQ)
- Webhook tester
- Tenant data export (backup)
- Emergency tenant restore

---

## 5. Rollar va Ruxsatlar

| Modul | OWNER | DEVOPS | FINANCE | SALES | SUPPORT |
|---|---|---|---|---|---|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tenants — view | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tenants — edit | ✅ | ❌ | ❌ | ✅ | ❌ |
| Tenants — suspend | ✅ | ❌ | ✅ | ✅ | ❌ |
| Tenants — impersonate | ✅ | ✅ | ❌ | ❌ | ✅ |
| Subscriptions | ✅ | ❌ | ✅ | ✅ | ❌ |
| Billing | ✅ | ❌ | ✅ | ❌ | ❌ |
| AI Credits | ✅ | ✅ | ✅ | ❌ | ❌ |
| Analytics | ✅ | ✅ | ✅ | ✅ | ❌ |
| Infrastructure | ✅ | ✅ | ❌ | ❌ | ❌ |
| Support | ✅ | ❌ | ❌ | ❌ | ✅ |
| Broadcasts | ✅ | ❌ | ❌ | ✅ | ✅ |
| Team | ✅ | ❌ | ❌ | ❌ | ❌ |
| Audit Log | ✅ | ✅ | ✅ | ❌ | ❌ |
| Tariff Config | ✅ | ❌ | ✅ | ❌ | ❌ |
| Platform Settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| Dev Tools | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 6. Texnik Stack

### Frontend (`superadmin/`)
- **Next.js 15** (App Router) + **TypeScript**
- **Tailwind CSS** + **shadcn/ui**
- **Tanstack Query** (data fetching) + **Zustand** (state)
- **Recharts** yoki **Tremor** (grafiklar)
- **react-table** (jadvallar)
- **Framer Motion** (animatsiya)
- **Sonner** (toast)

### Backend (`backend/src/modules/super-admin/`)
- **NestJS** modullari:
  - `SuperAdminAuthModule` — JWT, 2FA, IP allowlist
  - `TenantsModule` — CRUD, impersonate
  - `BillingModule` — invoices, payments
  - `AiCreditsModule` — usage tracking, quotas
  - `PlatformStatsModule` — analytics aggregation
  - `PlatformAuditModule` — log middleware
- **Guards**: `PlatformAdminGuard`, `RoleGuard`, `IpAllowlistGuard`

### Infrastructure
- **Cloudflare R2** — rasm va backup uchun
- **Sentry** — error tracking
- **OpenTelemetry** — distributed tracing
- **Grafana + Prometheus** — server metrics
- **Better Auth** yoki custom JWT — auth

### Real-time
- **WebSocket** (Socket.io) — dashboard live updates
- **Server-Sent Events** — notification stream

### Deployment
- Alohida subdomain: `superadmin.platform.uz`
- Alohida Vercel project yoki self-hosted
- **CloudFlare Access** (Zero Trust) — qo'shimcha himoya

---

## 7. Bosqichma-bosqich Reja

### 🎯 Phase 1: Asos (1-2 hafta)
- [ ] `superadmin/` Next.js loyihasi yaratish (skeleton)
- [ ] `PlatformAdmin` modeli + migration
- [ ] Auth (JWT + 2FA)
- [ ] Login sahifasi + dashboard layout
- [ ] Backend `SuperAdminAuthModule`
- [ ] Audit log middleware

### 🎯 Phase 2: Multi-tenant migratsiya (2-3 hafta) ⚠️ KATTA
- [ ] `Tenant` modeli + barcha modellarga `tenantId`
- [ ] Migration script (mavjud datani default tenant'ga)
- [ ] Application-level scope middleware
- [ ] PostgreSQL RLS policies
- [ ] Mijoz admin panel testing (regressiya yo'q)

### 🎯 Phase 3: Tenants boshqaruvi (1 hafta)
- [ ] `/tenants` ro'yxat sahifasi
- [ ] Tenant detail (overview, settings)
- [ ] Suspend / resume / tariff change
- [ ] Impersonate functionality

### 🎯 Phase 4: Billing tizimi (2 hafta)
- [ ] `Subscription`, `Invoice`, `TariffConfig` modellari
- [ ] Payme va Click webhook'lari
- [ ] Avto-invoice generatsiyasi (cron)
- [ ] `/subscriptions`, `/billing` sahifalari
- [ ] PDF invoice generator

### 🎯 Phase 5: AI Credits (1 hafta)
- [ ] `AICreditUsage` modeli + tracking middleware
- [ ] OpenAI cost calculator
- [ ] Quota enforcement
- [ ] `/ai` sahifa
- [ ] Cost alerts

### 🎯 Phase 6: Analytics & Dashboard (1 hafta)
- [ ] KPI aggregation queries (materialized views)
- [ ] Real-time dashboard (WebSocket)
- [ ] Grafiklar (Recharts)
- [ ] `/analytics` sahifa

### 🎯 Phase 7: Infrastructure (1 hafta)
- [ ] Server health endpoint
- [ ] `TenantResourceStat` daily cron
- [ ] Logs viewer
- [ ] Job queue monitor

### 🎯 Phase 8: Operations (1 hafta)
- [ ] Support inbox (centralized)
- [ ] Broadcasts (segment + send)
- [ ] Team management
- [ ] Dev tools

### 🎯 Phase 9: Polish (1 hafta)
- [ ] Performance optimization
- [ ] Mobile responsive (admin can use phone)
- [ ] Onboarding docs (internal wiki)
- [ ] Penetration testing

**JAMI: ~11-13 hafta** (1 dev to'liq vaqt)
**Quick MVP (Phase 1, 3, qisman 4):** 3-4 hafta

---

## 8. Xavfsizlik

### Auth qatlamlar
1. **IP allowlist** — faqat ofis va VPN
2. **Cloudflare Access** — Zero Trust qatlam
3. **2FA majburiy** (TOTP yoki WebAuthn)
4. **Short JWT** (15 min) + refresh token
5. **Session binding** (IP + user agent)

### Audit
- Har bir mutation harakati `PlatformAuditLog`'ga yoziladi
- Sezgir actionlar uchun **dual approval** (masalan, tenant delete)
- Alertlar: yangi admin login, suspicious activity

### Data protection
- Tenant impersonation **vaqtinchalik** (max 30 daqiqa)
- Impersonation banner doim ko'rinib turadi
- Sezgir maydonlar maskalanadi (passport, karta)
- GDPR-style data export va delete

### Backup
- Daily PostgreSQL dump (encrypted) → R2
- Point-in-time recovery (PITR)
- Tenant-level export (mijoz so'rasa)

### Compliance
- O'zbekiston Respublikasi shaxsiy ma'lumotlar to'g'risida qonun (152-O'RQ)
- Data residency: O'zbekiston ichida server (talab bo'lsa)

---

## 9. Boshlanish nuqtasi — Tavsiya

**Birinchi qadam:** Phase 1 va Phase 3'ni parallel boshlash (Phase 2'ni keyinroq qilamiz).

Buning ma'nosi:
1. **Super Admin skelet** + auth + dashboard layout
2. **Mavjud data ustida** (single-tenant) tenant ro'yxati ko'rsatish (1 ta tenant — siz)
3. Keyin asta-sekin **multi-tenant migratsiya** bilan to'ldiramiz

Bu yondashuv eng tez **ko'rinadigan natija** beradi — 1 haftada Super Admin login va dashboard, keyin bosqichma-bosqich modullar qo'shamiz.

---

## 10. Keyingi qadam (qaror talab qiladi)

**Tasdiqlasangiz, men boshlayman:**
1. ✅ `superadmin/` Next.js skelet yaratish
2. ✅ `PlatformAdmin` Prisma modeli + migration
3. ✅ Login + auth
4. ✅ Dashboard layout (sidebar, topbar, navigation)
5. ✅ Birinchi sahifa: Tenants ro'yxati (placeholder data bilan)

Yoki agar boshqa yo'l istasangiz:
- Birinchi billing'dan boshlash
- Birinchi multi-tenant migratsiya
- Faqat dashboard + analytics

---

*Yaratilgan: 2026-06-08*
*Versiya: 1.0*
