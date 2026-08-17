# ADMIN PANEL — TO'LIQ TEXNIK TOPSHIRIQ

> Marketplace boshqaruvi: mahsulotlar, kategoriyalar, buyurtmalar, foydalanuvchilar, analytics, promo kodlar, support, related rules, sozlamalar. **Mobile-first**: telefonda ham, planshetda ham, kompyuterda ham to'liq ishlaydigan responsive UI.

---

## 1. UMUMIY KO'RINISH

### 1.1 Foydalanuvchi
- Faqat admin/manager/superadmin login qila oladi (email + parol).
- 3 ta rol:
  - **superadmin** — hammasi (admin yaratish ham).
  - **admin** — hammasi, lekin admin user'larni boshqara olmaydi.
  - **manager** — faqat buyurtmalar, support, mahsulot stock va status.

### 1.2 Texnologiya
- **Frontend:** Next.js 15+ (App Router) + Tailwind v4 + shadcn-ui (yoki o'z UI kit).
- **State:** TanStack Query + Zustand (UI state).
- **Form:** react-hook-form + zod.
- **Charts:** Recharts.
- **Table:** TanStack Table.
- **Notification (real-time):** Socket.IO client.
- **Auth:** httpOnly cookie (access + refresh JWT).

### 1.3 Mobile-first dizayn prinsiplari
- **Asosiy navigatsiya** — telefonda **bottom tab bar** (5 ta asosiy + hamburger), desktopda **left sidebar**.
- **Tablar** — telefonda sticky bottom, kichkina ekranlarda ikonalar + label.
- **Jadval ko'rinishlar** — telefonda **card view**ga aylanadi (jadvalda emas), desktopda klassik jadval.
- **Filterlar** — telefonda offcanvas drawer, desktopda chap panel.
- **Form** — telefonda full-screen, bosqichli (multi-step).
- **Touch targets** — min 44×44 px.
- **Click-once UX** — har bir action oraliq dialog/modal bilan tasdiqlash.

---

## 2. AUTH

### 2.1 Login (`/login`)
- Email + parol formasi.
- Submit → `POST /admin/auth/login` → `{ accessToken, refreshToken }` httpOnly cookie sifatida.
- 5 marta noto'g'ri urinish — 15 daqiqa rate-limit.

### 2.2 Token refresh
- Access JWT 15 min.
- Refresh 30 kun, rotation (har refresh'da yangi refresh token, eskisini revoke).
- Axios interceptor 401 da auto-refresh.

### 2.3 Logout
- `POST /admin/auth/logout` — refresh tokenni revoke + cookie clear.

---

## 3. SAHIFALAR (PAGES)

### 3.1 OVERVIEW / DASHBOARD (`/`)
**Yuqorida — Quick stats kartochkalari (4 ta KPI):**
- 📦 **Bugungi buyurtmalar** — bugungi (00:00 dan beri) buyurtmalar soni + summa.
- 💵 **Bugungi tushum** — `total` jami (faqat tasdiqlangan/yetkazilgan).
- 👁 **Bugungi tashriflar** — unique users `view_home` event.
- 🛒 **Konversiya** — orders / unique users (% bilan).

Har bir kartochkada o'tgan kun bilan farq (▲ 12% yashil yoki ▼ 5% qizil).

**Pastida 2 ta blok (mobile da stacked, desktop da grid):**

1. **Oxirgi 7 kunlik chiziq grafigi** (Recharts AreaChart):
   - Buyurtmalar / tushum / tashriflar (uchta line, toggle bilan).

2. **Bugungi mahsulot top-10** — eng ko'p ko'rilgan / sotilgan mahsulotlar (table mobile da card).

**Pastida — Live activity feed (real-time Socket.IO):**
- "Foydalanuvchi `@username` mahsulotni ko'rdi: **iPhone 15 chexol**" — 5 sek oldin
- "Foydalanuvchi `@xyz` savatga qo'shdi: **Ko'k ko'ylak (M)** ×2" — 1 daq oldin
- "🛒 Yangi buyurtma #M-000123 — 850 000 so'm" — toast bilan ko'tariladi
- "Foydalanuvchi savatdan o'chirdi: **Adidas krossovka**" — 2 daq oldin
- Toggle: pause/resume.

**API:**
- `GET /admin/stats/overview?date=today`
- `GET /admin/stats/timeseries?metric=&from=&to=`
- `GET /admin/stats/top-products?period=today&metric=views|sales&limit=10`
- WebSocket room: `admin-live` — `user-event`, `order-created`.

---

### 3.2 PRODUCTS (`/products`)
**List view:**
- Yuqorida search input + "+ Yangi mahsulot" tugma.
- Filterlar (mobile drawer): kategoriya, status (active/inactive), stock (in/out), brand.
- Sort: yangi, sotuv, qoldiq.
- Mobile — card view (rasm + nom + narx + stock + status badge + 3-dot menu).
- Desktop — table.

**Yaratish/Tahrirlash (`/products/new`, `/products/:id`):**
Multi-step yoki tab'lar:
1. **Asosiy**: nom (uz/ru), slug (auto), kategoriya, brand, narx, eski narx, isActive, isFeatured.
2. **Tavsif**: rich text (uz/ru).
3. **Rasmlar**: drag-drop upload, sort, asosiy rasm tanlash.
4. **Variantlar**: matrix builder (rang × o'lcham) yoki manual qator-qator. Har biriga: SKU, narx, qoldiq, rasm (optional).
5. **Xususiyatlar**: key-value (uz/ru) — qo'shish/o'chirish.
6. **SEO**: meta title/description (ixtiyoriy).

Saqlash → `POST /admin/products` yoki `PATCH /admin/products/:id`.

**API:**
- `GET /admin/products?q=&categoryId=&status=&cursor=&limit=`
- `POST /admin/products`
- `PATCH /admin/products/:id`
- `DELETE /admin/products/:id` (soft delete — `isActive=false`)
- `POST /admin/products/:id/images` (upload)
- `DELETE /admin/products/:id/images/:imgId`
- `POST /admin/products/:id/variants` (batch upsert)

---

### 3.3 CATEGORIES (`/categories`)
- Tree view (drag-drop reorder uchun `@dnd-kit`).
- Har bir node: edit / delete / "Subkategoriya qo'shish".
- Form: titleUz, titleRu, slug, icon upload, banner upload, parent, isVisible, position.

**API:**
- `GET /admin/categories?tree=true`
- `POST /admin/categories`
- `PATCH /admin/categories/:id`
- `DELETE /admin/categories/:id`
- `PATCH /admin/categories/reorder` — body: `[{id, position, parentId}]`

---

### 3.4 ORDERS (`/orders`)
**List:**
- Tabs: Yangi / Tasdiqlangan / Yo'lda / Yetkazilgan / Bekor qilingan.
- Search: order number, telefon, ism.
- Filter: sana oralig'i, summa oralig'i, to'lov turi.
- Mobile card / desktop table.
- Real-time — yangi order kelganda toast + tepada "Yangi (1)" badge mish-mish.

**Detail (`/orders/:id`):**
- Buyurtma raqami, sana, foydalanuvchi (Telegram link).
- Status timeline + status o'zgartirish dropdown.
- Yetkazib berish ma'lumotlari (xarita preview agar `lat/lng` bor).
- Mahsulotlar jadvali (rasm, nom, variant, qty, narx, jami).
- Summary: subtotal, promo, delivery, total.
- "Mijozga xabar yuborish" (bot orqali).
- "Bekor qilish" / "Yetkazildi deb belgilash" / "Yo'lda" tugmalari (rolga qarab).
- Comment qo'shish — internal note (faqat admin ko'radi).

**API:**
- `GET /admin/orders?status=&q=&from=&to=&cursor=`
- `GET /admin/orders/:id`
- `PATCH /admin/orders/:id/status` body: `{ status, comment? }`
- `POST /admin/orders/:id/message` body: `{ text }` — bot orqali foydalanuvchiga DM.

**Status o'zgartirilganda:**
- DB ga `OrderEvent` yozish.
- Telegram kanaldagi xabar **edit** qilinadi (yangi status badge).
- Foydalanuvchiga avtomatik bot DM (sozlanadigan — "status yangilanganda xabar yuborish" toggle settings da).

---

### 3.5 USERS (`/users`)
**List:**
- Search: Telegram ID, username, ism, telefon.
- Filter: faol (oxirgi 30 kun), bloklangan, til.
- Mobile card / desktop table.

**Detail (`/users/:id`)** — bu eng muhim sahifalardan biri:

**Tab 1 — Profil:**
- Telegram info, til, telefon, ro'yxatdan o'tgan sana, oxirgi tashrif.
- Buyurtmalar soni, jami summa, AOV.
- "Bloklash / Blokdan chiqarish" tugma.

**Tab 2 — Faollik (timeline):**
- Sana bo'yicha guruhlangan event'lar feed:
  - "🏠 Bosh sahifaga kirdi" — 14:32
  - "🔍 Qidiruv: «iphone case»" — 14:33
  - "📱 Ko'rdi: iPhone 15 silicon case (45 soniya)" — 14:34
  - "❤️ Sevimlilarga qo'shdi: iPhone 15 silicon case" — 14:35
  - "🛒 Savatga qo'shdi: iPhone 15 silicon case ×1" — 14:36
  - "❌ Savatdan o'chirdi: Adidas krossovka" — 14:40
  - "✅ Buyurtma berdi #M-000123 — 850 000 so'm" — 14:45
- Filter: event type, sana oralig'i.
- Infinity scroll.

**Tab 3 — Qiziqishlar (Interests):**
- Top kategoriyalar (donut chart) — qiziqish score asosida.
- Top brendlar.
- Eng ko'p ko'rgan mahsulotlar (top 10).
- Eng ko'p savatga qo'shgan, lekin sotib olmaganlari.

**Tab 4 — Buyurtmalar:**
- Foydalanuvchining barcha buyurtmalari ro'yxati.

**API:**
- `GET /admin/users?q=&isBlocked=&cursor=`
- `GET /admin/users/:id`
- `PATCH /admin/users/:id` body: `{ isBlocked }`
- `GET /admin/users/:id/timeline?type=&from=&to=&cursor=`
- `GET /admin/users/:id/interests`
- `GET /admin/users/:id/orders?cursor=`

---

### 3.6 ANALYTICS (`/analytics`)
**Yuqorida — Period selector:** Bugun / 7 kun / 30 kun / 90 kun / Custom range.

**Bloklar (Recharts):**
1. **Tushum & Buyurtmalar** — AreaChart (kunlik).
2. **Konversiya voronkasi (Funnel):**
   - Tashrif (`view_home`) → Mahsulot ko'rdi (`view_product`) → Savatga qo'shdi (`CART_ADD`) → Checkout boshladi (`CHECKOUT_START`) → Buyurtma berdi (`ORDER_PLACED`).
   - Har bir bosqichda foiz.
3. **Top mahsulotlar** — sotuv va ko'rishlar bo'yicha (table).
4. **Top kategoriyalar** — qiziqish va sotuv (bar chart).
5. **Cart abandonment** — savatga qo'shilgan, lekin sotib olinmagan mahsulotlar top 10.
6. **Trafik manbalari** — agar Telegram referral tracking qo'shilsa (`?startapp=...`).
7. **Haftalik snapshot** — oxirgi 12 hafta, eng yaxshi/yomon haftalar.

**Eksport:** `GET /admin/analytics/export?from=&to=&format=csv|xlsx`.

**API:**
- `GET /admin/analytics/overview?from=&to=`
- `GET /admin/analytics/funnel?from=&to=`
- `GET /admin/analytics/top-products?metric=&from=&to=&limit=`
- `GET /admin/analytics/top-categories?...`
- `GET /admin/analytics/cart-abandonment?...`
- `GET /admin/analytics/weekly` — haftalik snapshotlar ro'yxati.

---

### 3.7 PROMO CODES (`/promo-codes`)
- List: kod, type, value, qo'llanishlar (used/limit), expire, status.
- Form: kod (uppercase auto), type (percent/fixed), value, minOrder, maxDiscount, startsAt, expiresAt, usageLimit, perUserLimit, isPublic, isActive.
- "Generate code" tugmasi — random 8 belgi.
- Detail sahifa: kim qo'llaganini ko'rish (orders bilan join).

**API:**
- `GET /admin/promo-codes?q=&active=&cursor=`
- `POST /admin/promo-codes`
- `PATCH /admin/promo-codes/:id`
- `DELETE /admin/promo-codes/:id`
- `GET /admin/promo-codes/:id/usages`

---

### 3.8 SUPPORT (`/support`)
- Yangi tiketlar yuqorida.
- Filter: status (open/answered/closed).
- Detail — chat ko'rinish: user xabari + admin javoblari. "Javob yuborish" textarea + send → user bot orqali DM oladi.

**API:**
- `GET /admin/support/tickets?status=&cursor=`
- `GET /admin/support/tickets/:id`
- `POST /admin/support/tickets/:id/responses` body: `{ message }`
- `PATCH /admin/support/tickets/:id` body: `{ status }`

---

### 3.9 RELATED RULES (`/related-rules`)
- Manual related qoidalarni boshqarish.
- Form: source (product yoki category) → target (product yoki category) + position + isActive.
- Bulk: "iPhone 15" sahifasi uchun barcha aksessuarlar (multi-select).
- Preview: "Bu rules natijasida foydalanuvchi quyidagi mahsulotlar ko'radi:" sample chiqaradi.

**API:**
- `GET /admin/related-rules?sourceProductId=&sourceCategoryId=`
- `POST /admin/related-rules`
- `DELETE /admin/related-rules/:id`
- `PATCH /admin/related-rules/:id`

---

### 3.10 BANNERS (`/banners`)
- Placement bo'yicha (home, category, ...) ro'yxat.
- Form: rasm upload (uz va ru alohida), targetType+targetValue, position, startsAt, endsAt, isActive.
- Drag-drop reorder.

**API:**
- `GET /admin/banners?placement=`
- `POST /admin/banners`
- `PATCH /admin/banners/:id`
- `DELETE /admin/banners/:id`

---

### 3.11 SETTINGS (`/settings`)
**Bloklar:**
1. **Umumiy**: do'kon nomi, kontakt telefon, manzil, ish vaqti.
2. **Delivery & Order**: minimal buyurtma, yetkazib berish narxi, bepul yetkazib berish chegarasi.
3. **Telegram**: bot username (read-only, env'dan), orders channel ID, support chat ID, "Status o'zgarganda foydalanuvchiga DM" toggle.
4. **Til**: default til.
5. **Tarmoq**: analytics retention days, weekly aggregation cron.
6. **Adminlar** (faqat superadmin): admin yaratish/o'chirish.

Hammasini DB'da `Settings` jadvali (key-value JSON) saqlash (`.env` faqat sirlar va boot uchun).

**API:**
- `GET /admin/settings`
- `PATCH /admin/settings` body: `{ key, value }`
- `GET /admin/admins` (superadmin)
- `POST /admin/admins`
- `PATCH /admin/admins/:id`
- `DELETE /admin/admins/:id`

---

## 4. UMUMIY UI/UX TALABLARI (admin)

### 4.1 Layout
- **Mobile (`<768px`):**
  - Top app bar (sahifa nomi + back + 3-dot menu).
  - Bottom tab bar (5 ta): Dashboard, Buyurtmalar, Mahsulotlar, Foydalanuvchilar, Boshqa (drawer).
  - Drawer ichida: Kategoriyalar, Analytics, Promo, Support, Related, Bannerlar, Settings, Logout.
- **Desktop (`≥1024px`):**
  - Left sidebar (collapsible) — barcha sahifalar.
  - Top bar: search + notifications + admin avatar.

### 4.2 Komponentlar (shadcn-ui style yoki o'z)
- Button (primary/secondary/ghost/destructive), Input, Select, Switch, Tabs, Sheet, Dialog, DropdownMenu, Toast, Badge, Avatar, Skeleton, Table (responsive), Pagination, EmptyState.

### 4.3 Real-time notifications
- Socket.IO room `admin-live`.
- Server emit qiladi: `order:created`, `order:status_changed`, `user:event`, `support:new_ticket`.
- Admin paneldagi notification badge — yangi orderlar uchun.
- Toast — yangi order kelganda ovoz bilan (ixtiyoriy).

### 4.4 Permissions (rol asosida)
| Sahifa | superadmin | admin | manager |
|--------|-----------|-------|---------|
| Dashboard | ✅ | ✅ | ✅ |
| Products CRUD | ✅ | ✅ | stock va status only |
| Categories CRUD | ✅ | ✅ | ❌ |
| Orders | ✅ | ✅ | ✅ |
| Users | ✅ | ✅ | ko'rish only |
| Analytics | ✅ | ✅ | ✅ |
| Promo Codes | ✅ | ✅ | ❌ |
| Support | ✅ | ✅ | ✅ |
| Related Rules | ✅ | ✅ | ❌ |
| Banners | ✅ | ✅ | ❌ |
| Settings | ✅ | ko'rish | ❌ |
| Admin users | ✅ | ❌ | ❌ |

NestJS `RolesGuard` + `@Roles('admin','superadmin')` decorator.

### 4.5 Form UX
- Loading state — submit tugma disabled + spinner.
- Server error — toast + inline error.
- Yo'qotilgan ma'lumotlar (unsaved changes) — sahifani tark etmoqchi bo'lganda warning.
- Autosave (mahsulot description uchun ixtiyoriy).

---

## 5. BACKEND ADMIN ENDPOINT'LAR (umumiy ro'yxat)

`/admin/*` prefiksi bilan, `AdminJwtGuard` bilan himoyalangan.

- `POST /admin/auth/login`
- `POST /admin/auth/refresh`
- `POST /admin/auth/logout`
- `GET /admin/me`

- `GET|POST|PATCH|DELETE /admin/products`
- `GET|POST|PATCH|DELETE /admin/categories`
- `GET|PATCH /admin/orders`
- `GET|PATCH /admin/users`
- `GET /admin/users/:id/timeline`
- `GET /admin/users/:id/interests`
- `GET|POST|PATCH|DELETE /admin/promo-codes`
- `GET|POST|PATCH|DELETE /admin/banners`
- `GET|POST|PATCH|DELETE /admin/related-rules`
- `GET|PATCH /admin/support/tickets`
- `POST /admin/support/tickets/:id/responses`
- `GET /admin/stats/*`
- `GET /admin/analytics/*`
- `GET /admin/admins` (superadmin)
- `GET|PATCH /admin/settings`
- `POST /admin/uploads/image` (returns url + variants)

---

## 6. ANALYTICS HISOBLASH ALGORITMLARI

### 6.1 Conversion funnel (oraliq vaqt davomida)
```sql
-- Unique users per stage
WITH stages AS (
  SELECT user_id, MIN(CASE WHEN type='VIEW_HOME' THEN created_at END) AS s1,
                  MIN(CASE WHEN type='VIEW_PRODUCT' THEN created_at END) AS s2,
                  MIN(CASE WHEN type='CART_ADD' THEN created_at END) AS s3,
                  MIN(CASE WHEN type='CHECKOUT_START' THEN created_at END) AS s4,
                  MIN(CASE WHEN type='ORDER_PLACED' THEN created_at END) AS s5
  FROM user_events
  WHERE created_at BETWEEN $from AND $to
  GROUP BY user_id
)
SELECT
  COUNT(s1) AS visits,
  COUNT(s2) AS product_views,
  COUNT(s3) AS cart_adds,
  COUNT(s4) AS checkouts,
  COUNT(s5) AS orders
FROM stages;
```

### 6.2 Interest score (per user, per category)
```
score(user, category) =
  3 * count(view_product where product.categoryId = category)
  + 5 * count(favorite_add where ...)
  + 8 * count(cart_add where ...)
  + 20 * count(order_placed for category)
weighted by recency: e^(-Δdays / 14)
```

### 6.3 Cart abandonment
```sql
-- Mahsulotlar savatga qo'shilgan, lekin shu user buyurtma bermagan
SELECT p.id, p.title_uz, COUNT(*) abandoned_count
FROM user_events ue
JOIN products p ON ue.product_id = p.id
WHERE ue.type = 'CART_ADD'
  AND ue.created_at BETWEEN $from AND $to
  AND NOT EXISTS (
    SELECT 1 FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.user_id = ue.user_id
      AND oi.product_id = ue.product_id
      AND o.created_at >= ue.created_at
      AND o.status != 'CANCELLED'
  )
GROUP BY p.id
ORDER BY abandoned_count DESC
LIMIT 10;
```

### 6.4 Haftalik aggregation worker
- BullMQ scheduled job (`weekly-stats`).
- Har dushanba 03:00 (UTC) ishga tushadi.
- Oxirgi 7 kun (oldingi hafta) bo'yicha barcha metric'larni hisoblaydi va `WeeklyStat` ga yozadi (upsert `weekStart+metric+scope` unique).
- 12 haftadan eski `WeeklyStat`'larni o'chiradi.
- Hodi loglanadi, xatolik bo'lsa Sentry + admin Telegramga alert.

---

## 7. SOCKET.IO REAL-TIME EVENT'LAR

**Gateway:** `/admin` namespace, autentifikatsiya — JWT cookie.

**Room:** `admin-live` (barcha login bo'lgan adminlar a'zo).

**Server → Client event'lar:**
- `user-event` — `{ userId, username, type, productId?, payload, createdAt }`
- `order-created` — `{ id, orderNumber, total, userId }`
- `order-status-changed` — `{ id, newStatus, by }`
- `support-new-ticket` — `{ id, userId, subject }`

**Client → Server:**
- `subscribe-live` (default on connect)
- `unsubscribe-live` (live feed pause)

---

## 8. RESPONSIVE BREAKPOINTS

| Breakpoint | Tailwind | Tafsilot |
|------------|----------|----------|
| Mobile | `< 640px` | Bottom nav, card view, full-screen forms |
| Tablet | `640–1024px` | Hybrid — sidebar collapsed, jadval qisqartirilgan |
| Desktop | `≥ 1024px` | Full sidebar, jadvallar, multi-column |

Test qilish — **Chrome DevTools mobile emulator + real telefonda**.

---

## 9. ACCEPTANCE CRITERIA (admin)

- [ ] Login → dashboard ochiladi, KPI kartochkalar to'g'ri.
- [ ] Telefonda barcha sahifalar to'liq ishlaydi (touch-friendly, scroll buzilmagan).
- [ ] Yangi buyurtma kelganda admin panelda toast + bottom tab badge ko'tariladi.
- [ ] Buyurtma status'i o'zgartirilganda Telegram kanaldagi xabar avtomatik edit qilinadi.
- [ ] Foydalanuvchi timeline'i to'liq event'larni ko'rsatadi (kim nimani ko'rdi/qo'shdi/o'chirdi).
- [ ] User detail → Qiziqishlar tab kategoriya/brand donut chart ko'rsatadi.
- [ ] Mahsulot yaratishda variant matrix bilan oson ishlatiladi.
- [ ] Promo kod test qilganda (limit oshganda, expire da, min order da) to'g'ri xato qaytaradi.
- [ ] Related rules saqlanganda WebApp'da related products to'g'ri ko'rinadi.
- [ ] Analytics period o'zgartirilganda barcha chartlar yangi ma'lumot bilan yangilanadi.
- [ ] Haftalik snapshotlar saqlanadi va 12 haftadan eskisi o'chadi.
- [ ] CSV/XLSX export ishlaydi.
- [ ] Rol asosida sahifa/tugma to'g'ri yashiriladi.
- [ ] Refresh token rotation ishlaydi (eski token revoke qilinadi).
- [ ] `npm run build`, lint, type-check sof.
