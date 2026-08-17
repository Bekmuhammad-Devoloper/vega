# Yaxshilanishlar rejasi

## 🎯 Maqsad
Real-time, ko'p tilli, professional UX bilan production-ready marketplace.

---

## 1️⃣ WebApp — gorizontal scroll va layout muammolari

**Hozir:** Sahifani gorizontal silkitish mumkin (overflow).

**Yechim:**
- `webapp/src/app/globals.css` ga `html, body { overflow-x: hidden; }` qo'shish
- `(shop)/layout.tsx` ga `overflow-x-clip` va max-width
- Banner carousel'da `mx-4` (lateral padding) bilan tasalli
- Kategoriya tabs'da `-mx-4 px-4` to'g'rilash

## 2️⃣ Banner dizayni — yumshoqroq

**Hozir:** Banner butun ekran kengligida, to'rt burchakli.

**Yechim:**
- Banner'ga `rounded-2xl` + side padding (`mx-4`)
- Aspect-ratio `2.4/1` → `16/9` yoki `2.1/1` (kompaktroq)
- Slide indicator chiroyliroq

## 3️⃣ Kategoriyalar rus tilida ham ishlaydi

**Hozir:** Til o'zgartirilsa, kategoriyalar UZ da qoladi (cache).

**Sabab:** TanStack Query keyi locale'ni hisobga olmaydi.

**Yechim:**
- `useLocaleStore` da locale o'zgarganda → `qc.invalidateQueries()` chaqirish
- Yoki barcha `queryKey` larga `locale` qo'shish (ko'proq ish, lekin aniqroq)
- Birinchi variant — bitta joyda providers.tsx'da

## 4️⃣ Admin: kategoriya yaratganda RU input ko'rinadigan

**Hozir:** RU field bor lekin auto-fill UZ qiymat bilan to'ldiriladi va ko'rinmasligi mumkin.

**Yechim:**
- Aniq alohida 2 ta input (UZ va RU), placeholder bilan
- Required validation
- Admin form'da hozir bor — tekshirib aniqlash kerak

## 5️⃣ Like button instant feedback (optimistik)

**Hozir:** Heart bosilganda server javob kelguncha ~300ms kechikadi.

**Yechim:**
- `useMutation` da `onMutate` bilan optimistik update
- Cache'da `isFavorite: !prev.isFavorite` ni darhol o'zgartirish
- Error'da rollback
- Favorites list ham invalidate qilinadi

## 6️⃣ Mahsulot kartochka — "В корзину" tugmasi + qty controller

**Hozir:** Faqat heart icon va detail'ga link.

**Yechim:**
- Kartochka pastida:
  - Savatda yo'q: **"В корзину"** tugmasi (oddiy variant uchun bir bosish)
  - Savatda bor: **`− N +`** qty controller
- Variantlari ko'p mahsulotlar uchun: tugma `→ detail` ga yo'naltiradi
- Hech qanday horizontal scroll yo'q

## 7️⃣ ENG MUHIM — Real-time everywhere (Socket.IO)

### 7.1 Yangi backend gateway: `/user` namespace

**Yangi modul:** `backend/src/modules/webapp-notifications/`

- `WebAppNotificationsGateway` — `/user` namespace
- Auth: Telegram `initData` HMAC orqali (handshake.auth)
- Per-user room: `user:<userId>`
- Events emitted:
  - `order:status_changed` — admin status o'zgartirsa
  - `support:new_response` — admin javob bersa
  - `product:updated` — admin mahsulot yangilasa (broadcast)
  - `cart:invalidate` — kerak bo'lsa
  - `favorites:invalidate` — kerak bo'lsa

### 7.2 Admin tomonidan event'lar

- `AdminOrdersService.updateStatus` → emit `user.order.status_changed` (userId bilan)
- `AdminSupportController.respond` → emit `user.support.response`
- `AdminProductsService.update` → emit `product.updated` (broadcast)
- `AdminProductsService.create` → emit `product.created` (broadcast)
- `AdminProductsService.delete` → emit `product.deleted` (broadcast)
- `AdminCategoriesService.update/create` → emit `categories.invalidate`
- `AdminBannersService.update/create` → emit `banners.invalidate`

### 7.3 WebApp client: `useRealtime` hook

`webapp/src/hooks/use-realtime.ts`:
- `useEffect` da `/user` namespace'ga ulanish (initData bilan)
- Event handlers:
  - `order:status_changed` → invalidate orders queries + toast
  - `support:new_response` → invalidate tickets + toast
  - `product:updated` → invalidate product + products
  - `product:created/deleted` → invalidate products
  - `categories:invalidate` → invalidate categories
  - `banners:invalidate` → invalidate banners
- Reconnect logic

### 7.4 Admin tomonidan real-time updates

`admin/src/hooks/use-socket.ts` allaqachon bor — mavjudligini tekshirish:
- Dashboard live activity ko'rsatadi (allaqachon ishlaydi)
- `order-created` event yangi buyurtmani qo'shadi
- Yangi: `order:user_cancelled` — agar user buyurtmani bekor qilsa

## 8️⃣ Admin: status o'zgartirish UI yaxshilash

**Hozir:** Bir nechta tugma (Confirm/Onway/Cancel).

**Yechim:**
- **Status dropdown** — to'liq workflow ko'rinadi:
  ```
  PENDING → CONFIRMED → ON_THE_WAY → DELIVERED
                    └────────→ CANCELLED
  ```
- Bosganda confirm dialog
- Comment qo'shish field (optional)
- Sticky pastda joylanadi (tezroq bosilishi uchun)
- Vizual status timeline (yashil → kulrang circle bilan)

## 9️⃣ Nginx config — Socket.IO uchun (allaqachon to'g'ri)

`/socket.io/` location WebSocket upgrade qiladi — barcha namespacelarga ishlaydi.

---

## 📋 Bajarish tartibi

1. **Backend gateway + event emitters** (eng muhim, hammasi shunga bog'liq)
2. **WebApp `useRealtime` hook** + providers ga qo'shish
3. **WebApp UI fixes** — overflow, banner, like, qty button
4. **Admin status dropdown**
5. **Locale-aware queries** (RU/UZ to'g'ri ishlashi)
6. **Commit + push → CI/CD avtomatik deploy**

## 🧪 Test rejasi (deploy'dan keyin)

1. Brauzerda https://marketplace.yuksalish.dev ochish (telefonda ham)
2. Gorizontal scroll yo'qligini tekshirish
3. Banner yumaloq ko'rinishi
4. Til o'zgartirish — kategoriyalar tarjima
5. Heart bosish — darhol qizaradi
6. Mahsulot kartochkasidan "В корзину" — qty controller chiqadi
7. Admin status o'zgartirish → WebApp da real vaqtda yangilanadi
8. Admin support javob → WebApp da toast + sahifada javob
9. Admin mahsulot nomini o'zgartirish → WebApp da kartochkada o'zgaradi
