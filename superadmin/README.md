# Super Admin Panel — Platform Owner Dashboard

Marketplace SaaS platformasi egasi uchun **Control Tower** — barcha mijoz do'konlarini, obunalarni, to'lovlarni, AI sarflarini va server resurslarini boshqarish uchun.

## 🎯 Mavjud sahifalar

| Path | Sahifa | Status |
|---|---|---|
| `/` | Dashboard (KPI, grafiklar, activity) | ✅ Ishlaydi |
| `/tenants` | Do'konlar ro'yxati (qidiruv, filter, paginatsiya) | ✅ Ishlaydi |
| `/tenants/[id]` | Do'kon batafsil (9 tab) | ✅ Overview |
| `/subscriptions` | Obunalar (summary + filter + expiring) | ✅ Ishlaydi |
| `/billing` | To'lovlar, invoyslar (summary + filter + manual create) | ✅ Ishlaydi |
| `/ai` | AI Credits (chart + operation breakdown + top 20) | ✅ Ishlaydi |
| `/team` | Platforma adminlari (CRUD + reset password + activate) | ✅ Ishlaydi |
| `/audit` | Audit log (filter + expandable diff) | ✅ Ishlaydi |
| `/tariffs` | Tarif konfiguratsiyasi (inline edit) | ✅ Ishlaydi |
| `/analytics` | Platforma analitika | 🔜 Phase 6 |
| `/infrastructure` | Server health | 🔜 Phase 7 |
| `/support` | Centralized support | 🔜 Phase 8 |
| `/broadcasts` | Kampaniyalar | 🔜 Phase 8 |
| `/settings` | Platforma sozlamalari | 🔜 Phase 9 |
| `/dev` | Dev tools | 🔜 Phase 9 |

## 🚀 Lokalda ishga tushirish

### 1. Backend (Prisma migratsiya + seed)
```bash
cd backend
npx prisma migrate dev --name add_super_admin
npm run db:seed:super
```

Bu yaratadi:
- `PlatformAdmin` (owner@platform.uz / SuperOwner123!)
- 4 ta `TariffConfig` (Free, Standard, Pro, Premium)

Demo tenantlar bilan birga:
```powershell
$env:SUPER_SEED_DEMO=1
npm run db:seed:super
```

### 2. Backend ishga tushirish
```bash
cd backend
npm run start:dev
# Server: http://localhost:4000
```

### 3. Super Admin frontend
```bash
cd superadmin
npm install
npm run dev
# Open: http://localhost:5180
```

Login:
- Email: `owner@platform.uz`
- Password: `SuperOwner123!`

## 🔐 Auth arxitektura

- **Mutlaq ajratilgan token'lar** — `super_access_token` va `super_refresh_token` cookie'lar
- **15 daqiqalik access TTL** — qisqa
- **7 kunlik refresh TTL** — admin paneldan kamroq
- **Refresh rotation** — har refresh'da eski token revoke
- **2FA (TOTP)** — yoqilsa, login → temp token → verify code
- **Audit log** — har bir mutation `PlatformAuditLog`'ga yoziladi

## 👥 Rollar va ruxsatlar

| Rol | Kim |
|---|---|
| `OWNER` | Siz — hammasiga to'liq ruxsat |
| `DEVOPS` | Server, deploy, dev tools |
| `FINANCE` | Billing, invoyslar, refund, tarif config |
| `SALES` | Tenant boshqaruv, obunalar, broadcasts |
| `SUPPORT` | Support tiketlar, broadcasts |

Sidebar'da navigatsiya banlar avtomatik filtrlanadi (`hasRole`).

## 🎨 Dizayn tizimi

**Mavjud admin'dan farqlash uchun** — alohida dark + glassmorphism theme:
- Primary: `#6366F1` (Indigo)
- Accent: `#10B981` (Emerald)
- Background: `#0A0B14` (deep navy)
- Surface: `#151823` (elevated)

CSS o'zgaruvchilar `globals.css`'da, har bir komponent shu palitra'ni ishlatadi.

## 📁 Loyiha strukturasi

```
superadmin/
├── src/
│   ├── app/
│   │   ├── login/             # Login + 2FA
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx     # Sidebar + topbar wrapper
│   │   │   ├── page.tsx       # Dashboard home
│   │   │   ├── tenants/       # Do'konlar
│   │   │   ├── subscriptions/
│   │   │   ├── billing/
│   │   │   ├── ai/
│   │   │   ├── analytics/
│   │   │   ├── infrastructure/
│   │   │   ├── support/
│   │   │   ├── broadcasts/
│   │   │   ├── team/
│   │   │   ├── audit/
│   │   │   ├── tariffs/
│   │   │   ├── settings/
│   │   │   └── dev/
│   │   ├── layout.tsx
│   │   ├── globals.css        # Dark theme
│   │   └── providers.tsx
│   ├── components/
│   │   ├── ui/                # Button, Input, Card, Badge, Toast
│   │   ├── layout/            # Sidebar, PageHeader, ComingSoon
│   │   ├── dashboard/         # KpiCard, RevenueChart, TariffDonut, ActivityFeed
│   │   └── tenants/           # TenantRow
│   ├── lib/
│   │   ├── api.ts             # fetch wrapper + token refresh
│   │   ├── endpoints.ts       # Backend API calls
│   │   ├── types.ts           # TypeScript DTOs
│   │   ├── format.ts          # UZS, dates, bytes
│   │   ├── tariff.ts          # Tariff metadata
│   │   └── cn.ts
│   └── stores/
│       ├── auth-store.ts      # Zustand auth state
│       └── toast-store.ts
└── package.json
```

## 🔌 Backend modullari

```
backend/src/modules/super-admin/
├── super-admin.module.ts        # Asosiy modul
├── super-jwt.service.ts         # JWT sign/verify (alohida secret)
├── super-auth.service.ts        # Login, 2FA, refresh, TOTP
├── super-auth.controller.ts     # POST /super-admin/auth/*
├── super-jwt.guard.ts           # SuperJwtGuard + PlatformRolesGuard
├── super-audit.service.ts       # Audit log writer
├── super-dashboard.service.ts   # KPI aggregation
├── super-dashboard.controller.ts # GET /super-admin/dashboard/*
├── super-tenants.service.ts     # Tenant CRUD + actions
└── super-tenants.controller.ts  # /super-admin/tenants/*
```

## 🌐 Production deploy

Nginx misol:
```nginx
server {
    server_name superadmin.platform.uz;

    # IP allowlist (qo'shimcha himoya)
    allow 1.2.3.4;   # Sizning ofis IP
    deny all;

    location / {
        proxy_pass http://127.0.0.1:2403;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
    }
}
```

PM2:
```bash
pm2 start ecosystem.config.cjs --only marketplace-superadmin
```

## 🛣 Keyingi qadamlar

1. **Phase 2** — Multi-tenant migratsiya (mavjud modellariga `tenantId` qo'shish)
2. **Phase 4** — Billing tizimi (Subscription, Invoice, Payme/Click webhooks)
3. **Phase 5** — AI Credits tracking middleware
4. **Phase 6** — Real-time dashboard (Socket.io)
5. **Phase 8** — Broadcast tizimi va Support inbox
6. **Phase 9** — Polish + xavfsizlik audit + penetration test

To'liq spetsifikatsiya: [docs/04-SUPER-ADMIN-TZ.md](../docs/04-SUPER-ADMIN-TZ.md)
