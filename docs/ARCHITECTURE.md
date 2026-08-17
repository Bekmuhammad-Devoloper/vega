# Sellio — Architecture Overview

*Definitive technical map for the maintainer. Synthesized from a 13-agent codebase exploration (2026-06-24); cross-checked against source where reports disagreed. File paths are repo-relative to the project root unless noted absolute.*

> **Remediation status:** for which findings in §10 are fixed vs open, see [`AUDIT-FINDINGS.md`](AUDIT-FINDINGS.md).

---

## 1. What Sellio is

**Sellio is a multi-tenant SaaS that lets a merchant run a complete Telegram storefront in minutes.** A seller DMs the platform's onboarding bot (`@selliostorebot`), fills out a Telegram Mini App wizard, optionally connects *their own* `@BotFather` bot token, and immediately gets a hosted store: a customer-facing Telegram WebApp catalog, order management, online + manual payments (Payme / Click / card transfer), channel post scheduling, broadcasts, AI product autofill, and analytics. The business model is **tariff-based** (`FREE / STANDARD / PRO / PREMIUM`): each tenant starts on `FREE`, and paid plans — gated by `TariffConfig` limits and feature flags — are activated when a seller uploads a payment receipt that a platform operator approves. Platform staff operate the whole estate from a separate super-admin "control tower" (tenants, billing, tariffs, AI-credit accounting, audit, infra).

---

## 2. System topology

**Five deployables**, supervised by PM2 (`ecosystem.config.cjs`, names prefixed `marketplace-`), fronted by Nginx with Let's Encrypt TLS. The backend is the only stateful service; everything else is a thin client.

| Deployable | PM2 name | Port | Public domain | Stack |
|---|---|---|---|---|
| Backend API | `marketplace-api` | **2400** (127.0.0.1 only) | *(internal)* | NestJS + Prisma + Postgres 17 |
| Customer WebApp | `marketplace-webapp` | 2401 | `clients.selliostore.uz` | Next.js 15 / React 19 |
| Store admin | `marketplace-admin` | 2402 | `admin.selliostore.uz` | Next.js 15 / React 19 |
| Super-admin | `marketplace-superadmin` | 2403 | `dev.selliostore.uz` | Next.js 15 / React 19 |
| Landing | `marketplace-landing` | 2404 | `selliostore.uz` / `www` | Express static |

> **Note on the "5173–5180" numbers:** those are the backend's *CORS allowlist dev defaults* (`main.ts`) and each frontend's local `npm run dev` port — **not** production ports. Production is uniformly 2400–2404 (`ecosystem.config.cjs`).

**How they talk** — every frontend hits its *own origin* over a relative `/api`; Next.js `rewrites()` (and Nginx in prod) proxy to the backend. This makes the whole system same-origin (no client CORS, works behind tunnels) and means **the backend is never exposed directly**.

```
                         Telegram Bot API
                           │        ▲
              webhooks /telegram/*  │ getMe / sendMessage / setWebhook
                           ▼        │
  Customer ─┐         ┌──────────────────────────────────────────┐
 (Mini App) │  HTTPS  │              Nginx (TLS, :443)            │
  Seller ───┤ ───────▶│  selliostore.uz   → landing      :2404   │
 (admin TG) │         │  clients.*        → webapp       :2401   │
  Platform ─┘         │  admin.*          → admin        :2402   │
  staff               │  dev.*            → superadmin   :2403   │
                      │  /api /telegram /uploads /socket.io ─────┼──▶ API :2400 (loopback)
                      └──────────────────────────────────────────┘        │
                                                                          ▼
                                          Postgres 17 ◀── Prisma ── NestJS API
                                          (single client, no middleware)
   Realtime: Socket.IO  /admin namespace (admin live feed) · /user namespace (WebApp)
   Async:    EventEmitter2 (in-process) + @nestjs/schedule cron
```

`/telegram/*` is proxied **without** the `/api` prefix because `main.ts` sets a global `api` prefix that **excludes** `telegram/webhook` and `telegram/t/:tenantId/webhook`. The webhook is intentionally reachable on all four subdomains to survive Telegram's DNS caching when the server IP changes (`APP_URL` is deliberately pinned to `https://dev.selliostore.uz`).

---

## 3. Multi-tenancy model — *the single most important concept*

A `Tenant` is the root of all store-owned data. The model is **manual, convention-based tenant isolation — there is no Prisma middleware, `$use`, or `$extends` anywhere in `backend/src`**. Isolation is a hand-rolled discipline: every tenant-owned model carries a **nullable `tenantId`**, and every service method must remember to add `where: { tenantId }`.

**How a request resolves its tenant** depends on the auth realm:
- **Customer (WebApp):** sends an `x-tenant-slug` header (resolved client-side from `?shop=` → Telegram `start_param` → `localStorage`). `TenantScopeService.resolve(slug)` (`common/tenant-scope/`) looks up the `Tenant` by slug — **in-memory cached, positive-only, `status === 'ACTIVE'` only** — returning `{ tenantId, slug, botToken }`. The guard sets `req.tenantId`, read via `@CurrentTenantId()`.
- **Store-admin:** the tenant is **baked into the JWT** — the active store = the `Admin.tenantId` of the row the token authenticates. Switching stores re-issues a token scoped to another tenant. There is **no client-side tenant ID**; handlers derive scope from `admin.tenantId`.
- **Super-admin:** operates across all tenants by `:id`; no implicit scoping.

**Where it's enforced:** *per handler, manually.* Guards write `req.tenantId` / `req.admin`; controllers pass `admin.tenantId` (or `@CurrentTenantId()`) into services, which add `where: { tenantId }` and `assertOwn*` ownership checks that return **404 (not 403)** on mismatch (so a tenant can't probe for the existence of another tenant's rows).

**Global-vs-tenant split** — the convention is `tenantId === null ⇒ platform-owner / unscoped / full access`. This is deliberate (legacy single-store rows, platform-owner reach) but **fails open**: a missing/`undefined` `tenantId` grants platform-wide access rather than denying. Scoping is also *inconsistent by design* across models:

| Data | Scoping rule | Notes |
|---|---|---|
| `Product`, `Banner` | **exact** `tenantId: tenantId ?? null` | a shop sees only its own |
| `Category` | **inclusive** `OR: [{tenantId: null}, {tenantId}]` | global base categories shared; tenants edit only their own |
| `Cart`, `Favorite` | **none** — keyed by `userId` only | a user's cart/favorites span all shops; filtered to one tenant only at checkout |
| `RelatedRule` | **no `tenantId` column at all** | rules are global (see §10) |
| `Settings` | **none** — one global row per key | shared across all tenants (see §10) |
| `Broadcast`, `SupportTicket` reads | **none** in admin queries | cross-tenant leak (see §10) |

This split is the source of most of the serious findings in §10.

---

## 4. The three auth realms

Three fully isolated realms with distinct secrets and token `type` discriminators, so a token from one realm is rejected by another's verifier.

| | **Customer** | **Store-admin** | **Platform super-admin** |
|---|---|---|---|
| Mechanism | Telegram `initData` HMAC | JWT (email/pwd **or** Telegram passwordless) | JWT (email/pwd + optional TOTP 2FA) |
| Token? | **None** — re-verified every request | access (15m) + refresh (30d) | access (15m) + refresh + 5m temp-2FA token |
| Transport | `X-Telegram-Init-Data` + `x-tenant-slug` headers | `Authorization: Bearer` **or** `access_token` cookie | `Authorization: Bearer` **only** (no cookie fallback) |
| Guard | `TelegramAuthGuard` → `req.user`, `req.tenantId` | `AdminJwtGuard` → `req.admin` | `SuperJwtGuard` → `req.platformAdmin` |
| RBAC | n/a | `RolesGuard` (`AdminRole`) + `TariffFeatureGuard` | `PlatformRolesGuard` (`PlatformRole`; **`OWNER` bypasses all**) |
| Secrets | tenant `botToken` (HMAC key) | `JWT_ACCESS/REFRESH_SECRET` | `SUPER_JWT_*` (fallback: admin secret + `:super`) |

**Customer lifecycle:** `verifyTelegramInitData()` (`common/helpers/telegram-init-data.ts`) recomputes `HMAC_SHA256(HMAC("WebAppData", botToken), dataCheckString)`, enforces a 24h `auth_date` window, then `upsertFromTelegram` keys the `User` on `telegramId` (BigInt). The init-data is verified against the **tenant's own** bot token — the multi-tenant core of customer auth. `assertNotBlocked` checks global `User.isBlocked` **and** per-tenant `TenantBlockedUser`. **Dev bypass:** when `NODE_ENV !== 'production'`, missing *or invalid* initData logs in as `DEV_TELEGRAM_ID = 999000001`.

**Store-admin lifecycle:** access JWT `{sub, email, role, type:'access'}`; refresh stored as **SHA-256 hash** in `RefreshToken`, rotated-and-revoked on use. Cookies are httpOnly (`secure`+`sameSite:none` in prod). Passwordless Telegram sellers get a synthetic email `tg<id>@sellio.bot` and no `passwordHash`.

**Super-admin lifecycle:** bcrypt login; if `twoFactorEnabled`, returns `requires2FA + tempToken`, then `verifyTotpCode` (hand-rolled RFC-6238, ±1 step window). Refresh hashes stored with `ipAddress`/`userAgent`; login/2FA events written to `PlatformAuditLog`. Refresh tokens are revoked on password reset / deactivate. **Footgun:** `@PlatformRoles()` with no args = allow-all (the guard returns `true` when `required.length === 0`); restrict with an explicit role, e.g. `@PlatformRoles(PlatformRole.OWNER)`.

---

## 5. Backend domain map

~30 NestJS modules wired in `app.module.ts`. `PrismaModule` and `TenantScopeModule` are `@Global()`. Boot (`main.ts`): BigInt→string JSON patch, CORS allowlist (`*.selliostore.uz` + tunnels), helmet (relaxed CORP for cross-origin images), cookie-parser, `api` prefix (excl. webhooks), global `ValidationPipe` / `HttpExceptionFilter` / `TraceIdInterceptor`, static `/uploads`.

**By domain (one line each):**

- **Bootstrap/cross-cutting** — `main`, `app.module`, `config/env.validation` (fail-fast `validateEnv`), `prisma`, `common/*` (decorators, `HttpExceptionFilter`, `TraceIdInterceptor`, `tenant-scope`, `tariff.ts`, `role-groups.ts`, helpers).
- **Customer auth** — `auth/` (`TelegramAuthGuard`, `authenticate`/`devLogin`).
- **Store-admin auth** — `admin-auth/` (`AdminJwtGuard`, `jwt.service`, refresh rotation, `RolesGuard`, `TariffFeatureGuard`).
- **Super-admin auth** — `super-admin/super-auth.*`, `super-jwt.*` (2FA, `PlatformRolesGuard`).
- **Catalog (read)** — `products`, `categories`, `banners`, `related-products` (no controller), `recommendations` (event/cron only).
- **Shopping** — `cart`, `favorites`, `orders`, `promo-codes`.
- **Payments** — `payments/` (`payme.service`, `click.service`, checkout-URL builder).
- **Store admin API** — `admin/*` (13 modules: products, orders, categories, users, broadcast, store, banners, promo, related, settings, stats, support, admins).
- **Super-admin API** — `super-admin/*` (15 controllers: tenants, tariffs, billing, subscriptions, ai, audit, team, settings, analytics, infra, support, broadcasts, dev, dashboard).
- **Telegram** — `telegram-bot/` (global + per-tenant bots, webhooks, order/payment/support listeners), `channel-posts/`.
- **Platform plumbing** — `analytics` (+cleanup cron), `ai` (OpenAI + credit metering), `support`, `notifications` (`/admin` socket), `webapp-notifications` (`/user` socket), `settings`, `uploads` (sharp→webp), `users`, `public` (seller onboarding).

### Key end-to-end flows

**(a) Customer order → payment → channel → recommendation**
1. `POST /orders` (`OrdersService.create`, `TelegramAuthGuard` → `req.tenantId`). Cart is **filtered to the current tenant's products** (multi-store cart → one order per store), stock re-validated, `minOrderAmount` enforced, promo evaluated, delivery fee computed.
2. One `$transaction`: create `Order` (`PENDING`) + snapshotted `OrderItem`s + seed `OrderEvent`; decrement `ProductVariant.stock`; increment `Product.soldCount`; redeem promo; **clear the entire cart**; emit `order.created`.
3. `order.created` fans out to three listeners: `TelegramOrdersListener` (posts an HTML card with status buttons to the **global** orders channel, stores `channelMessageId`, DMs the customer via tenant-bot-first-then-global fallback), `RecommendationsService`, and `NotificationsGateway` (admin live feed).
4. **Payment** — online via `GET /payments/checkout` returning a Payme (`a=total×100`, **tiyin**) or Click (`amount=total`, **sum**) hosted URL; webhooks at `/payments/payme/:tenantId` (Basic-auth = `paymeKey`, state machine 1/2/-1/-2) and `/payments/click/{prepare,complete}` (MD5 sign). Both emit `order.paid`. **Manual** card transfer: customer uploads a receipt → posted to the tenant's `manualPaymentChannelId` with `paycfm:approve|reject` buttons → seller approves → `paidAt` + `CONFIRMED`.
5. **Post-purchase recommendation:** `OrderRecommendation` scheduled `now + 1min`; an every-minute cron (`processDue`) picks ≤20 due rows with optimistic locking, builds related-product suggestions via `RelatedProductsService.getRelatedFor`, and DMs the customer (tenant bot → global fallback). Daily 3 AM cleanup.

> ⚠️ **`order.paid` has no `@OnEvent` listener.** Payme/Click payments set `paidAt` but leave the order **`PENDING`** — no auto-`CONFIRMED`, no "payment received" notification, no revenue rollup. Only the manual flow advances status. See §10 / `AUDIT-FINDINGS.md`.

**(b) Seller onboarding → tenant → tariff**
1. Seller DMs `@selliostorebot` `/start` → global bot replies with a `web_app` button → admin-panel Mini App wizard.
2. `SellerOnboardingService.onboard()` (`public/seller.service.ts`) verifies initData, generates a unique slug, and in one `$transaction` creates the `Tenant` (`tariffPlan: 'FREE'`, paid plan parked in `pendingTariff`) + a passwordless owner `Admin` (`tg<id>@sellio.bot`, role `ADMIN`). Idempotent (returns existing tenant if any).
3. If a bot token was supplied: `checkBotToken` (getMe) + uniqueness check → `tenantBot.configure()` sets the per-tenant webhook.
4. Paid tariff → `POST upgrade/receipt` uploads a receipt → global bot posts to the payments chat with `pay:approve|reject:<tenantId>` → `TelegramPaymentsListener` activates `pendingTariff` and DMs the owner.

**(c) Channel post scheduling/publishing**
`ChannelPostsController` (admin JWT + `CATALOG_ROLES`) → `create` validates (text ≤3500, ≤60-day horizon, ≤10 pending) and stores a `ChannelPost(SCHEDULED)`; if due within 5s, publishes immediately. `@Cron(EVERY_MINUTE) publishDue` picks ≤25 due posts → `TenantBotService.publishToChannel(tenantId, …)` to the tenant's `channelId` with an optional "Sotib olish" URL button → `PUBLISHED` + `channelMessageId`, or `FAILED` + error.

---

## 6. Data model

Postgres via Prisma (`backend/prisma/schema.prisma`). Money is `Decimal(12,2)` coerced with `Number()` at DTO boundaries; Telegram IDs are `BigInt` serialized as strings; bilingual `*Uz`/`*Ru` columns throughout.

- **`Tenant`** — the multi-tenant root. Holds store identity (`slug @unique`, `shopName`, branding), lifecycle (`status`, `tariffPlan`, `pendingTariff`, `isOnTrial`/`trialEndsAt`, `suspendedReason`), bot fields (`botToken @unique`, `botUsername`, `botPhotoUrl`, `channelId`, `manualPaymentChannelId`, `ownerTelegramId`), and **per-tenant merchant secrets** (`paymeMerchantId`/`paymeKey`, `clickServiceId`/`clickSecretKey`/…, `manualCardNumber`/`manualCardHolder`). So payments are fully isolated per store.
- **Billing** — `TariffConfig` (4 pre-seeded rows: pricing, limits, AI quotas, `features` JSON — the editable source of truth), `Subscription` (status, MRR), `Invoice` (`INV-…`, status, provider, `paidAt`). The super-admin dashboard and `lib/tariff.ts` mirror prices in a **hardcoded table** that can drift from `TariffConfig` (see §10).
- **Auth/identity** — `User` (`telegramId @unique`, `isBlocked`), `Admin` (`role: AdminRole`, nullable `tenantId`, `@@unique([tenantId, telegramId])`), `RefreshToken`, `PlatformAdmin` (`role: PlatformRole`, `twoFactorSecret`), `PlatformRefreshToken`, `TenantBlockedUser`, `PlatformAuditLog`.
- **Catalog** — `Category` (self-referential 2-level tree, inclusive scoping), `Product` (`slug`/`sku` unique, `Decimal` prices, `discountPct` denormalized, `soldCount`/`viewCount`), `ProductImage`/`ProductVariant`/`ProductSpec`, `Banner` (placement + time window), `RelatedRule` (**no `tenantId`**), `CartItem` (`@@unique([userId, productId, variantId])`, **no tenant scope**), `Favorite`.
- **Orders** — `Order` (`M-` number, status, `paidAt`, `channelMessageId`, `payReceiptMessageId`, `promoCodeId` + string `promoSnapshot`), `OrderItem` (snapshotted), `OrderEvent` (append-only audit), `PaymentTransaction` (`@@unique([provider, providerTxId])` for idempotency, Int state machine), `PromoCode`/`PromoCodeUsage`, `OrderRecommendation`.
- **Analytics/AI** — `UserEvent` (`EventType` enum, 22 values; indexed on `[userId,createdAt]`, `[type,createdAt]`, `[productId,type]`; 14-day retention cron), `AICreditUsage` (`AIOperation`, model, token/image counts, **`costUsd`/`costUzs` always 0** — see §10), `WeeklyStat` (**dead model — zero writers**).

---

## 7. Frontends

All three are Next.js 15 / React 19, App Router, **strictly client-rendered** (`'use client'` everywhere), TanStack Query (server state) + Zustand (auth/UI), Uzbek-Latin UI with `ru-RU`/`uz-UZ` number formatting. Each proxies relative `/api` to the backend via `next.config.ts` rewrites.

| | **admin** (store) | **webapp** (customer) | **superadmin** (platform) |
|---|---|---|---|
| Auth | `apiMe()` bootstrap; JWT in memory + `localStorage('admin_at')`; silent 401 refresh | Telegram `initData` per request; no token | JWT + `localStorage('super_at')`; silent refresh; TOTP 2FA login |
| Tenant context | **encoded in JWT**; `StoreSwitcher` re-issues token + hard reload | `getShopSlug()` → `X-Tenant-Slug` header | by `:id`, no implicit scope |
| Data layer | `useInfiniteQuery` cursor lists, `invalidateQueries` on mutate | optimistic cart/favorite cache rewrites + rollback | server-paginated tables + summary KPIs |
| Realtime | Socket.IO `/admin` (live order/support feed) | Socket.IO `/user` (order/support/catalog invalidations) | **none** — polls every 5–30s (sockets declared but unused) |
| Notable | settings is a 748-line monolith; role-model drift (§10) | same-origin proxy; checkout via `Telegram.WebApp.openLink` | many placeholder tabs/buttons; client-only RBAC; secrets shown plaintext |

The customer webapp and admin are also **Telegram Mini Apps** (back-button sync, haptics, theming). Admin runs dual-mode: standalone web (email/pwd) *or* Mini App (initData onboarding wizard). Per-tenant `primaryColor` is injected into CSS vars at runtime.

---

## 8. Telegram bot architecture

Built on **grammY**. Two coexisting systems:

- **Global Sellio bot** (`TelegramBotService`) — one bot for the SaaS: `/start` onboarding launcher, the **shared central orders channel** (`TELEGRAM_ORDERS_CHANNEL_ID`), platform-tariff payment approvals (`TELEGRAM_PAYMENTS_CHAT_ID`), support fan-in (`TELEGRAM_SUPPORT_CHAT_ID`), and DM fallback. Degrades gracefully (no token → `enabled=false`, every method early-returns). Runs webhook or long-polling. Also exposes `lookupUserProfile(telegramId)` (getChat → name/username/photo) used by the team-add flow.
- **Per-tenant bots** (`TenantBotService`) — each seller's own `@BotFather` token; an in-memory `Map<tenantId, Bot>` cache. `configure(tenantId)` sets `${APP_URL}/telegram/t/${tenantId}/webhook` (allowed_updates: message + callback_query) and a chat-menu `web_app` button → `WEBAPP_URL?shop=<slug>`. `buildBot` registers `/start` (opens storefront) and the `paycfm:(approve|reject)` receipt callback. On boot, `selfHeal()` reconfigures all tenants and — if exactly one tenant exists — backfills `null`-tenant products/banners/promos to it.

**Webhooks** are excluded from the `api` prefix and validate a **single static `TELEGRAM_WEBHOOK_SECRET`** shared by *all* tenant bots via `x-telegram-bot-api-secret-token`; the `:tenantId` path param is the only differentiator (and isn't cross-checked against the update's bot — see §10).

**Listeners** (EventEmitter2): `telegram-orders.listener` (order cards + channel-button status transitions + customer DMs), `telegram-payments.listener` (tariff approve/reject), `telegram-support.listener` (ticket forwarding). The global bot decodes callbacks then re-emits via a single shared `callbackEmitter`.

**Channel integration:** per-tenant order receipts go to `manualPaymentChannelId` (correctly isolated); scheduled marketing posts go to `channelId`; **but order lifecycle posts to the one global orders channel** — a cross-tenant control surface (§10).

---

## 9. Infra & deploy

**Production topology:** Postgres 17 (localhost-only after hardening) ← Prisma ← API (2400, loopback) ← Nginx (TLS, one Let's Encrypt cert covering 5 subdomains) ← the four public frontends. PM2 supervises all 5 apps (fork mode, autorestart, logrotate, systemd boot). UFW allows only 22/80/443.

**Bootstrap pipeline** (`deploy/00`→`07`, orchestrated by `bootstrap.sh` or the all-in-one `fresh-server.sh`): install stack + create DB with random pw → clone → generate `.env` (openssl secrets, chmod 600) → install/build/migrate/seed → PM2 start + `pm2 save` → certbot + final Nginx → reliability layer (swap, fail2ban, unattended-upgrades, watchdog cron, daily backup, PG tuning) → health check.

**CI/CD** (GitHub Actions): `ci.yml` (per-app matrix build, paths-filter; **lint/tsc/test are non-blocking** — only `npm run build` fails CI), `main.yml` (deploy on push to `main` via gcloud-IAP or SSH → `deploy/deploy.sh`), `rollback.yml` (manual), `healthcheck.yml` (external ping every 5 min). Ops notifications go to Telegram from every script and workflow.

**`deploy/deploy.sh`** is selective: diffs changed paths, builds only changed apps, runs `prisma migrate deploy` only if migrations changed, zero-downtime `pm2 reload` per changed app, then curls 5 HTTPS endpoints.

> ⚠️ **Rollback blast radius:** the `on_error` trap does `git reset --hard $PREV_COMMIT` + `pm2 reload ecosystem.config.cjs` for **all 5 apps** even though the build was selective — so a flaky health check on *any one* endpoint reverts the whole repo and bounces every service. Worse, the in-deploy trap does **not** re-run install/build/migrate, so rolled-back code can be inconsistent with on-disk `dist`/`.next` and an already-applied migration. The standalone `rollback.sh` *does* rebuild. Migrations are forward-only and run *before* the health check with no pre-migration snapshot.

**Migration timeline (18 migrations)** tells the product's evolution: `init` (single-store marketplace, 2026-05) → `add_super_admin` (the **SaaS pivot**: Tenant, tariffs, PlatformAdmin) → `telegram_seller_onboarding` (passwordless) → `tenant_scoped_catalog` (nullable `tenantId` everywhere) → online + card-transfer payments → `channel_posts` → `multi_store` + `store_team_roles` (CREATOR/MODERATOR) → `tenant_blocked_user` → `support_ticket_tenant`. **Arc: single-store marketplace → multi-tenant tariff SaaS → Telegram-native onboarding → payments → multi-store teams → per-tenant blocking & support.**

---

## 10. Cross-cutting observations

Consolidated and de-duplicated. **Severity-ordered.** See [`AUDIT-FINDINGS.md`](AUDIT-FINDINGS.md) for remediation status.

### Critical — cross-tenant isolation failures (manual scoping forgotten)
Isolation depends entirely on developer discipline (no Prisma middleware), and several handlers forgot it:

1. **`admin/admin-admins.module.ts` — store team management is un-scoped.** `list()` returns **all admins across all tenants**; `create()` makes an admin with **no `tenantId`**; `update()`/`delete()` operate on any admin id platform-wide. Guarded by `@Roles(SUPERADMIN)` — in practice tenant store-admins are `ADMIN`/`CREATOR`/`MODERATOR`, so exploitation requires an already-platform-level `SUPERADMIN`. Latent, but the endpoint should be retired or scoped (store teams are managed via `/admin/store/team`).
2. **`super-admin/super-team.controller.ts` — privilege escalation.** `update` / `reset-password` / `deactivate` / `activate` had **no `@PlatformRoles`**, and `PlatformRolesGuard` returns `true` when no metadata is set. So *any* authenticated platform admin (even `SUPPORT`) could promote themselves to `OWNER` or reset the owner's password. (Note `@PlatformRoles()` with empty args is *also* allow-all.) **[FIXED 2026-06-24]**
3. **`admin/admin-related.module.ts` — `RelatedRule` CRUD is un-scoped** (model has no `tenantId`). A store `ADMIN` can read/create/delete rules referencing other tenants' products by id.
4. **`admin/admin-broadcast` — global blast.** Recipient query has no tenant filter and uses the **global** bot; a store `ADMIN` reaching `POST /admin/broadcasts` can message the entire platform `User` table. `excludeBlocked` only checks global `User.isBlocked`, ignoring `TenantBlockedUser`.
5. **`admin/admin-settings` and `admin/admin-support`** are global: any store `ADMIN` can overwrite shared `business`/`store` settings, and any admin can read/answer/close **every** tenant's support tickets (the new `SupportTicket.tenantId` is used for reply *routing* but **not access control**).
6. **Realtime cross-tenant leak.** `NotificationsGateway` (`/admin`) joins every admin to one global `admin-live` room — a tenant admin receives `user-event`/`order-created`/`support-new-ticket` for **all** tenants.
7. **Shared global orders channel.** Every tenant's orders post to one `TELEGRAM_ORDERS_CHANNEL_ID`, and the channel-button callbacks have **no actor/tenant authorization** — anyone in that channel can transition any order.

### High — auth, payments, and security gaps
- **Rate limiting is dead config.** `ThrottlerModule` is registered and `@Throttle()` decorators exist on signup endpoints, but **no `ThrottlerGuard`/`APP_GUARD` is registered** — both the global config and the decorators are inert. (Enabling it requires care — see `AUDIT-FINDINGS.md`: `trust proxy` is not set, so a naive global guard would 429 the whole platform.)
- **`order.paid` has no listener.** Online (Payme/Click) payments mark `paidAt` but leave the order `PENDING`; no auto-confirm, no customer notification, no `Tenant.totalRevenue`/`totalOrders` update.
- **WebApp realtime uses the wrong bot token.** `WebAppNotificationsGateway.handleConnection` calls `auth.authenticate(initData)` with **no tenant bot token**, so it verifies against the global `TELEGRAM_BOT_TOKEN`. For tenant stores the HMAC fails, the `catch{}` swallows it, and the user silently lands in broadcast-only `all` — so personal `order:status_changed` / `support:new_response` events are **never delivered in production for tenant stores**.
- **Dev auth bypass keys on `NODE_ENV !== 'production'`** in *both* the HTTP guard and the socket gateway. If a deployed env ever runs with `NODE_ENV` unset, all customer auth is bypassable as user `999000001`.
- **Static webhook secret shared by all tenant bots**; the `:tenantId` path isn't cross-checked against the update's bot.
- **Payme cross-tenant tx risk.** `CheckTransaction`/`PerformTransaction`/`CancelTransaction` ignore the `_tenantId` arg and resolve transactions globally by `providerTxId`; a valid request to tenant A's URL can act on tenant B's transaction. Provider secrets are compared with non-constant-time equality; Click has no `sign_time` freshness check (replay).
- **Tokens in `localStorage`** (`admin_at`, `super_at`) — XSS-exfiltratable bearer tokens. Refresh tokens are httpOnly cookies (good).
- **Super-admin Dev SQL runner** (`$queryRawUnsafe`) is allow-listed only by naive substring matching — CTEs/subqueries/`pg_sleep` can slip through.
- **Hand-rolled TOTP** with no constant-time compare and no replay protection within the 30s window.
- **`HttpExceptionFilter` leaks internal error messages** verbatim in 500 bodies.
- **`enhance-image` SSRF:** `fetch(dto.imageUrl)` with no host allow-listing.

### Medium — correctness & data-integrity
- **Promo redemption** is duplicated (inlined in `orders.service.ts`), **not atomic** (TOCTOU between `evaluate` and increment; no unique constraint on `(promo,user)`), and **not refunded on cancel** (stock restored but promo allotment permanently consumed).
- **No order-status transition validation** — `DELIVERED`→`PENDING` is allowed; stock side-effects fire only on the `→CANCELLED` edge, so stock can drift.
- **AI cost is never computed** — `costUsd`/`costUzs` hardcoded to 0; quota check + insert non-atomic; month boundary uses server local time.
- **`viewCount` write on every product-detail GET** (unconditional UPDATE — write amplification, non-idempotent GET).
- **Deactivated store-admins keep working** until access-token expiry — the admin realm doesn't revoke refresh tokens on deactivate (the super realm does).
- **Recommendation send isn't transactional** with the `sentAt` write — a crash after send re-sends (bounded to ≤3).
- **Dashboard/super-admin price drift** — MRR/tariff distribution computed from **hardcoded `TARIFF_PRICE` tables** (backend `super-dashboard.service.ts` + frontend `lib/tariff.ts`), ignoring editable `TariffConfig.monthlyPrice`. Plus hardcoded fake KPI deltas, `churnRate: 0 // TODO`, `productsCount` always 0, `sort=products` actually sorts by orders.

### Low — smells, dead code, cosmetics
- **`WeeklyStat` model + `WEEKLY_AGGREGATION_CRON` are dead** — zero writers/consumers, yet the env var is required at boot.
- **`TenantScopeService` cache is unbounded, per-process, positive-only** — won't invalidate across replicas. Same single-process assumption breaks horizontal scaling for the per-tenant bot cache and every-minute crons (multiple replicas → duplicate posts/recommendations; no DB lock).
- **Frontend role-model drift** — `AdminRole` in admin `types.ts` is `SUPERADMIN|ADMIN|MANAGER`, but nav gates reference `CREATOR`/`MODERATOR`; a `MANAGER` gets no Categories/Users/Analytics nav.
- **Support-badge cache-key mismatch** — socket invalidates `['support-tickets']`, badge keys `['support','open-count']`.
- **Orphaned upload files** — sharp writes 3 webp files per image, no GC on delete.
- **Anonymous `/user` socket fallback** subscribes unauthenticated clients to catalog broadcasts.
- **Mojibake** — Cyrillic `да` mixed into Latin Uzbek strings (`tariff-feature.guard.ts`, `admin-products.service.ts`).
- **Infra drift** — repo URL hardcodes `github.com/Ziyodillokh/...` while git user is `Bekmuhammad-Devoloper`; docs target three different hosts; stale `marketplace.yuksalish.dev.nginx`; `06-health-check.sh` POSTs to a non-existent `/api/public/signup`; `fresh-server.sh` runs all 5 Node apps as **root**.

---

## 11. Glossary / entry points — where to look

| Concern | Primary file(s) |
|---|---|
| App bootstrap, CORS, prefix, global pipes | `backend/src/main.ts`, `backend/src/app.module.ts` |
| Env validation (fail-fast) | `backend/src/config/env.validation.ts` |
| **Tenant resolution** (slug → tenant) | `backend/src/common/tenant-scope/tenant-scope.service.ts` |
| Customer auth (initData HMAC) | `backend/src/modules/auth/telegram-auth.guard.ts`, `common/helpers/telegram-init-data.ts` |
| Store-admin auth (JWT, refresh rotation) | `backend/src/modules/admin-auth/{admin-jwt.guard,jwt.service,admin-auth.service}.ts` |
| Super-admin auth (JWT + 2FA) | `backend/src/modules/super-admin/super-{jwt,auth}.{guard,service}.ts` |
| Tariff limits / feature flags | `backend/src/common/tariff.ts`; runtime source of truth: `TariffConfig` rows |
| RBAC role bundles | `backend/src/common/role-groups.ts` |
| Order lifecycle + stock + promo | `backend/src/modules/orders/orders.service.ts` |
| Payment webhooks (Payme/Click) | `backend/src/modules/payments/{payme,click}.service.ts`, `payments.controller.ts` |
| Per-tenant merchant creds | `Tenant` model, `backend/prisma/schema.prisma` |
| Global Sellio bot | `backend/src/modules/telegram-bot/telegram-bot.service.ts` |
| Per-tenant bots + receipt callbacks | `backend/src/modules/telegram-bot/tenant-bot.service.ts` |
| Order/payment/support listeners | `backend/src/modules/telegram-bot/telegram-*.listener.ts` |
| Channel post scheduling | `backend/src/modules/channel-posts/channel-posts.service.ts` |
| Post-purchase recommendations | `backend/src/modules/recommendations/recommendations.service.ts` |
| Seller onboarding | `backend/src/modules/public/seller.service.ts` |
| Store team (add by Telegram ID, lookup) | `backend/src/modules/admin/admin-store.controller.ts` |
| AI autofill + credit metering | `backend/src/modules/ai/{openai.service,ai.controller}.ts` |
| Analytics + retention cron | `backend/src/modules/analytics/*` |
| Realtime gateways | `backend/src/modules/{notifications,webapp-notifications}/*.gateway.ts` |
| **Schema (all models/enums)** | `backend/prisma/schema.prisma` |
| Migration timeline | `backend/prisma/migrations/` |
| Admin frontend API layer | `admin/src/lib/{api,endpoints,types}.ts` |
| WebApp tenant/auth headers | `webapp/src/lib/api.ts` (`getShopSlug`, header injection) |
| Super-admin frontend API | `superadmin/src/lib/{api,endpoints}.ts` |
| PM2 process manifest | `ecosystem.config.cjs` |
| Production Nginx | `deploy/selliostore.uz.nginx` |
| CI deploy + rollback | `deploy/deploy.sh`, `deploy/rollback.sh`, `.github/workflows/{main,rollback}.yml` |
| Reliability layer (watchdog/backup) | `deploy/{07-reliability,watchdog,backup}.sh` |
