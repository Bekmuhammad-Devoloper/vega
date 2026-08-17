# Sellio — Audit Findings & Remediation Tracker

Point-in-time security/correctness audit (2026-06-24, 13-agent exploration). Full architecture context in [`ARCHITECTURE.md`](ARCHITECTURE.md) §10. This file tracks **status + the concrete fix** for each item.

Legend: ✅ fixed · 🔧 recommended fix below · ⚠️ needs a design decision before fixing.

---

## ✅ Fixed (2026-06-24)

### F2 — super-admin team privilege escalation `[CRITICAL]`
`super-admin/super-team.controller.ts`: `update` / `reset-password` / `deactivate` / `activate` had **no `@PlatformRoles`**, and `PlatformRolesGuard` returns `true` when `required.length === 0` — so *any* authenticated platform admin (SUPPORT, SALES, …) could promote themselves to `OWNER` or reset the owner's password. The existing `create` decorator (`@PlatformRoles()` with **no args**) was *also* allow-all for the same reason — its "OWNER only" comment was wrong.

**Fix applied:** all five mutations now carry `@PlatformRoles(PlatformRole.OWNER)`, and a comment documents the empty-args footgun. `list`/`get` remain readable by any authenticated platform admin (intentional). Backend type-checks clean.

> Root cause worth remembering: **`@PlatformRoles()` with no arguments = allow-all**, not "owner-only". Always pass the role.

---

## ⚠️ Needs a design decision (do NOT blind-patch)

### F-throttle — rate limiting is dead, but enabling it naively will 429 the whole platform `[HIGH]`
`ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }])` is registered and `@Throttle()` decorators sit on `public/seller.controller.ts`, but **no `ThrottlerGuard` is registered as `APP_GUARD`**, so all of it is inert.

**Why I did not just turn it on:** `main.ts` never calls `app.set('trust proxy', …)`. Behind Nginx, `req.ip` is the proxy address (same for every request), so a global guard at `120/min` would throttle the **entire platform on one shared IP** — an instant outage — and would also throttle Telegram/Payme/Click webhooks.

**Safe fix (apply + validate in staging):**
1. In `main.ts`, after `NestFactory.create`: `app.set('trust proxy', 1)` (exactly the number of proxy hops; Nginx = 1). Verify `req.ip` then reflects the real client IP via `X-Forwarded-For`.
2. Register the guard in `app.module.ts`:
   ```ts
   import { APP_GUARD } from '@nestjs/core';
   import { ThrottlerGuard } from '@nestjs/throttler';
   // ...
   providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
   ```
3. `@SkipThrottle()` on machine-to-machine controllers so providers/bots are never throttled: `payments.controller.ts` (Payme/Click webhooks), `telegram-bot/*webhook.controller.ts`, `health`, and the Socket.IO handshake path.
4. Load-test signup + login under the real Nginx config before deploy. Consider a higher global `limit` and rely on the per-endpoint `@Throttle()` for the sensitive routes.

### F1 — `admin/admins` is un-scoped `[CRITICAL, latent]`
`admin/admin-admins.module.ts` `list/create/update/delete` carry no `tenantId`. Guarded by `@Roles(SUPERADMIN)`; in the multi-tenant model store-admins are `ADMIN`/`CREATOR`/`MODERATOR` and store teams are managed via `/admin/store/team`, so this is only reachable by a platform-level `SUPERADMIN`. **Decision needed:** is this legacy global-admin manager still used? If not, **remove the module**. If yes, scope every query by the caller's `tenantId` (and forbid `SUPERADMIN` role assignment by tenants).

### F-orderpaid — online payment never confirms the order `[HIGH, product impact]`
`order.paid` is emitted by Payme/Click but has **no `@OnEvent('order.paid')` listener**. Paid orders stay `PENDING`: no auto-`CONFIRMED`, no customer "payment received" DM, no `Tenant.totalRevenue`/`totalOrders` rollup. **Decision needed** (product behavior): should a paid online order auto-advance to `CONFIRMED`, or to a new `PAID`-but-unconfirmed state the seller still approves? Once decided, add a listener mirroring the manual card-transfer approval path (`telegram-payments.listener` / the `paycfm:approve` handler) — set status + `OrderEvent`, DM the customer, and update revenue counters, all in one transaction.

---

## 🔧 Recommended fixes (clear direction, scope each carefully)

### Cross-tenant isolation (the dominant risk class)
- **F3 — `admin/admin-related`**: `RelatedRule` has no `tenantId` column. Add one (migration) + scope all CRUD by tenant, or constrain rules to products the caller's tenant owns.
- **F4 — `admin/admin-broadcast`**: filter the recipient query by `tenantId` and send via the **tenant** bot, not the global one; honor `TenantBlockedUser` in `excludeBlocked`.
- **F5 — `admin/admin-settings` + `admin/admin-support`**: make settings rows tenant-scoped (composite key or `tenantId` column); use `SupportTicket.tenantId` for **access control**, not just reply routing.
- **F6 — `NotificationsGateway` (`/admin`)**: join each admin to a **per-tenant room** (`admin-live:<tenantId>`) and emit to that room only.
- **F7 — global orders channel**: post order cards to the **tenant's own** channel, and authorize the status-button `callback_query` actor against the order's tenant.

### Payments & auth hardening
- **Payme tenant binding**: thread the `:tenantId` through `Check/Perform/Cancel` and require the resolved transaction's `tenantId` to match. Use constant-time secret comparison; add Click `sign_time` freshness.
- **Webhook secret**: derive/store a per-tenant secret, or at minimum verify the update's bot id matches `:tenantId`.
- **Deactivated store-admins**: revoke their `RefreshToken`s on deactivate (mirror the super realm).
- **`NODE_ENV` dev bypass**: gate the dev login on an explicit `ENABLE_DEV_AUTH=true` flag, not merely `NODE_ENV !== 'production'`.
- **`HttpExceptionFilter`**: return a generic message for unhandled 500s; log the detail server-side only.
- **`enhance-image` SSRF**: allow-list the image host (own `/uploads` + Telegram CDN).
- **Tokens in `localStorage`**: consider moving the super-admin access token to an httpOnly cookie + CSRF, given it's a platform-owner credential.

### Correctness & data integrity
- **WebApp `/user` socket** (`WebAppNotificationsGateway`): pass the tenant bot token into `authenticate(initData)` so per-tenant customers actually get personal events. *(High user-facing impact, low blast radius — good early fix.)*
- **Promo**: use the existing `applyOnUsage` helper, make evaluate+increment atomic (unique constraint on `(promoCodeId, userId)` or a transactional check), and refund the allotment on cancel.
- **Order status**: add a transition whitelist; move stock side-effects to the correct edges.
- **AI cost**: compute `costUsd`/`costUzs` from token/image counts × model price; make quota-check + insert atomic.
- **`viewCount`**: debounce or move to the analytics pipeline; don't UPDATE on every GET.

### Cleanups (low risk)
- Remove dead `WeeklyStat` + `WEEKLY_AGGREGATION_CRON` (or implement it) — and drop the now-unneeded required env var.
- Reconcile the dashboard `TARIFF_PRICE` tables with `TariffConfig`; remove fake KPI deltas / `churnRate: 0` placeholders.
- Fix the support-badge query-key mismatch (`['support','open-count']` vs `['support-tickets']`).
- GC orphaned upload webp files on image delete.
- Fix role-model drift in admin `types.ts`; fix mojibake strings; reconcile infra host/repo drift in `deploy/`.

---

*Re-run the exploration after a remediation pass to confirm closure. The cross-tenant items (F3–F7) and the WebApp-socket token bug are the highest value-to-risk fixes to tackle first.*
