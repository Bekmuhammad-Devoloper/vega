# Marketplace Admin Panel

Mobile-first admin panel (Next.js 15 + Tailwind v4 + TanStack Query + Recharts + Socket.IO).

## Quick start

```bash
cp .env.example .env.local
npm install
npm run dev      # http://localhost:5175
```

Login: `admin@example.com` / `ChangeMe123!` (seed orqali).

## Sahifalar

- `/login` — Login
- `/` — Dashboard (KPI + chart + live activity feed)
- `/orders`, `/orders/[id]` — Buyurtmalar (status, channel sync)
- `/products`, `/products/new`, `/products/[id]` — Mahsulotlar (variantlar + rasm + specs)
- `/categories` — Kategoriyalar tree
- `/users`, `/users/[id]` — Foydalanuvchilar (timeline + interests + buyurtmalar)
- `/analytics` — Konversiya voronkasi, top mahsulotlar/kategoriyalar, cart abandonment
- `/promo-codes` — Promo kodlar
- `/support` — Tiketlar (bot orqali javob)
- `/banners` — Bannerlar (image upload)
- `/related-rules` — Bog'liq mahsulotlar qoidalari
- `/settings` — Do'kon sozlamalari
- `/admins` — Adminlar (faqat superadmin)
- `/more` — Mobile drawer

## Mobile-first dizayn

- **Mobile (`<768px`):** bottom tab bar (5 ta) + top app bar
- **Desktop (`≥768px`):** left sidebar (collapsible)
- Forms — telefonda full-screen
- Jadvallar — telefonda card view, desktopda jadval

## Real-time

Socket.IO `/admin` namespace JWT bilan auth qiladi. Live activity feed har bir foydalanuvchi harakatini ko'rsatadi (view_product, cart_add, order_placed, va h.k.).

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript strict
- Tailwind CSS v4 (oq + ko'k palitra)
- TanStack Query (server state) + Zustand (UI state)
- Recharts (charts)
- Socket.IO client (real-time)
- react-hook-form (forms)
- lucide-react (icons)
