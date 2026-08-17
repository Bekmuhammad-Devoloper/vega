# CLAUDE.md — Sellio

Guidance for working in this repo. Read this first.

## What this is

**Sellio** is a multi-tenant SaaS that lets a merchant run a full **Telegram storefront** in minutes. A seller DMs the onboarding bot (`@selliostorebot`), completes a Telegram Mini App wizard, optionally connects their own `@BotFather` bot token, and gets a hosted store: customer WebApp catalog, orders, payments (Payme / Click / manual card transfer), channel posts, broadcasts, AI product autofill, analytics. Business model is **tariff-based** (`FREE / STANDARD / PRO / PREMIUM`).

## Monorepo layout

| Dir | What | Stack | Dev port |
|---|---|---|---|
| `backend/` | API — the only stateful service | NestJS 10 + Prisma 5 + grammY + Socket.IO + Postgres | 4000 |
| `webapp/` | Customer Telegram Mini App | Next.js 15 / React 19 / Tailwind v4 | 5174 |
| `admin/` | Store-owner panel (per-tenant) | Next.js 15 / React 19 | 5175 |
| `superadmin/` | Platform-owner control tower | Next.js 15 / React 19 | 5180 |
| `landing/` | Marketing site | Express static | 5173 |
| `deploy/` | Bootstrap/deploy/rollback shell scripts + Nginx + watchdog | | |
| `docs/` | TZ specs + **`ARCHITECTURE.md`** (full map) + **`AUDIT-FINDINGS.md`** | | |

Production ports differ: **2400–2404** (see `ecosystem.config.cjs`). The 5173–5180 numbers are dev/CORS only.

## Commands

```bash
# Backend (from backend/)
npm run start:dev          # watch mode on :4000
npm run build              # nest build → dist/
npm run prisma:migrate     # prisma migrate dev
npm run prisma:deploy      # prisma migrate deploy (prod)
npm run db:seed            # demo data
npx tsc --noEmit           # type-check (DO THIS before declaring backend work done)

# Each frontend (from admin/ | webapp/ | superadmin/)
npm run dev                # next dev
npm run build              # next build  (CI gates on this)
npm run type-check         # tsc --noEmit
```

CI (`.github/workflows/ci.yml`) only **fails on `npm run build`** — lint/tsc/test are non-blocking. So always run `type-check` yourself before finishing.

## Critical conventions — read before editing backend

1. **Multi-tenancy is MANUAL.** There is **no Prisma middleware / `$use` / `$extends`** anywhere. Tenant isolation is a hand-rolled discipline: every tenant-owned model has a **nullable `tenantId`**, and **every query you write must add `where: { tenantId }`**. Forgetting it is the #1 bug class in this codebase (see `AUDIT-FINDINGS.md`). A missing/`null` `tenantId` **fails open** (= platform-wide access), so be deliberate.
   - Store-admin handlers get the tenant from the **JWT** (`admin.tenantId`) — never from the client.
   - Customer handlers get it from `@CurrentTenantId()` (resolved from the `x-tenant-slug` header via `TenantScopeService`).
   - Ownership checks return **404, not 403**, on cross-tenant access (don't leak existence).
2. **Three isolated auth realms**, each with its own guard + secret + JWT `type`:
   - Customer → `TelegramAuthGuard` (Telegram `initData` HMAC, verified against the **tenant's own** bot token; no token issued).
   - Store-admin → `AdminJwtGuard` (+ `RolesGuard` for `AdminRole`, + `TariffFeatureGuard` for tariff gating).
   - Platform super-admin → `SuperJwtGuard` (+ `PlatformRolesGuard`). **Footgun:** `@PlatformRoles()` with *no args* = allow-all (guard returns true when `required.length === 0`). To restrict, pass the role explicitly: `@PlatformRoles(PlatformRole.OWNER)`.
3. **BigInt** (Telegram IDs) — serialized to strings via a global `BigInt.prototype.toJSON` in `main.ts`. Pass them as strings across the wire.
4. **Money** is Prisma `Decimal(12,2)`; coerce with `Number()` at DTO boundaries. Payme amounts are in **tiyin** (×100); Click amounts are in **sum**.
5. **Bilingual fields** — `*Uz` / `*Ru` columns throughout (UI is Uzbek-Latin first).
6. **Async work** is in-process: `EventEmitter2` (e.g. `order.created`) + `@nestjs/schedule` crons (every-minute publishers, daily cleanup). This assumes a **single API instance** — horizontal scaling would duplicate cron sends and break the in-memory tenant/bot caches.
7. **Telegram:** one **global** bot (`TelegramBotService`) for onboarding + the shared orders/payments/support channels, plus **per-tenant** bots (`TenantBotService`, in-memory `Map`). Webhooks are excluded from the `api` prefix and share one static `TELEGRAM_WEBHOOK_SECRET`.

## Where things live

See the full table in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §11. Quick hits:
- Tenant resolution → `backend/src/common/tenant-scope/tenant-scope.service.ts`
- Order lifecycle / stock / promo → `backend/src/modules/orders/orders.service.ts`
- Payment webhooks → `backend/src/modules/payments/{payme,click}.service.ts`
- Schema (all models) → `backend/prisma/schema.prisma`
- Admin frontend API layer → `admin/src/lib/{api,endpoints,types}.ts`

## Production & deploy

PM2 (`ecosystem.config.cjs`) supervises 5 apps behind Nginx (one Let's Encrypt cert, 5 subdomains). Deploy via `deploy/deploy.sh` (selective: builds only changed apps).

⚠️ **Rollback gotcha:** `deploy.sh`'s error trap does `git reset --hard` + `pm2 reload` for **all 5 apps** if **any one** health check fails, and does **not** rebuild — so a single flaky endpoint can revert the whole repo into an inconsistent state. The standalone `deploy/rollback.sh` *does* rebuild. Migrations are forward-only and run before the health check with no snapshot.

## Known issues

A multi-agent audit (2026-06-24) found several **tenant-isolation gaps** and bugs. Before touching admin/super-admin endpoints, skim [`docs/AUDIT-FINDINGS.md`](docs/AUDIT-FINDINGS.md) — and when you add a query, double-check it's tenant-scoped.
