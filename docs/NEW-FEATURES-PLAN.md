# Yangi xususiyatlar — Professional reja

**Sana:** 2026-05-17
**Maqsad:** Bot `/admin` buyrug'i, WebApp navigatsiyasini qayta qurish (Bosh sahifa + Katalog ajratish).

---

## 1. Bot tomonida o'zgarishlar

### 1.1. `/admin` buyrug'i
- Foydalanuvchi `/admin` yozsa, bot inline tugma bilan javob beradi.
- Tugma `https://marketplace.yuksalish.dev/admin/login` ga olib boradi (browser).
- Tugma matni: "🔐 Admin panelni ochish".
- Telegram WebApp ichida admin panelni `web_app` tugma orqali ochishga urinmaymiz — chunki admin panelni telefon brauzerida (yoki kompyuterda) ochish to'g'riroq.

### 1.2. Bot menu commands (`setMyCommands`)
Botning pastki menu tugmasi (chap pastdagi "Menu" tugma) bosilganda chiqadigan ro'yxat:
- `/start` — Botni ishga tushirish / WebApp ochish
- `/help` — Yordam
- `/admin` — Admin panelga kirish (faqat adminlar uchun ko'rinadi, lekin bot side hammasiga ruxsat)

### 1.3. Menu button (`setChatMenuButton`)
Chat oynasi pastida doimiy "Menu" tugma — to'g'ridan-to'g'ri WebApp ochadi:
- Text: "🛍 Do'konni ochish"
- Type: `web_app`
- URL: WEBAPP_URL

Bu bilan website botga to'liq ulangan bo'ladi (foydalanuvchi har doim WebApp ga bir tugma orqali kirishi mumkin).

---

## 2. WebApp navigatsiyasini qayta qurish

### 2.1. Sahifalar tuzilishi (yangi)

| Route          | Sahifa nomi          | Mazmun                                                                                |
| -------------- | -------------------- | ------------------------------------------------------------------------------------- |
| `/`            | **Bosh sahifa**      | Banner carousel + "Eng ko'p sotilgan" + "Yangi qo'shilganlar" (current home, soddalashtiriladi) |
| `/catalog`     | **Katalog**          | Root kategoriyalar 2 ustunli grid — har bir kartochkada banner/icon + nomi            |
| `/category/[slug]` | Kategoriya sahifasi  | Kategoriyaga oid mahsulotlar, tepada filter+sort tugmasi (sheet)                      |
| `/cart`        | Savat                | (o'zgarishsiz)                                                                        |
| `/favorites`   | Sevimlilar           | (o'zgarishsiz)                                                                        |
| `/profile`     | Profil               | (o'zgarishsiz)                                                                        |

### 2.2. Bottom navigation (5 ta tab)
- 🏠 Bosh sahifa (`/`)
- 📦 Katalog (`/catalog`)
- 🛒 Savat (`/cart`)
- ❤ Sevimlilar (`/favorites`)
- 👤 Profil (`/profile`)

**Grid:** `grid-cols-5` (avval `grid-cols-4` edi).
**i18n:** `nav.home` qo'shiladi.

### 2.3. Bosh sahifa (`/`) — soddalashtirish
- `CategoryTabs` olib tashlanadi (endi alohida Katalog sahifasi bor).
- Banner + Bestsellers + New Arrivals qoladi.
- Bestsellers ko'rsatishdan oldin kichik "Hammasini ko'rish →" linki `/catalog` ga olib boradi.

### 2.4. Katalog sahifasi (`/catalog`) — TO'LIQ YANGI
- Tepada qidiruv bar (mavjud katalogdagidek) — qidiruv `/search?q=` ga yoki `/catalog?q=` ga olib boradi.
- Pastida **2 ustunli grid**: har bir kategoriya kartochkasi:
  - Aspect ratio: `aspect-[4/3]`
  - Background: kategoriya banner yoki primary rang gradient
  - Icon yoki img: o'rtada
  - Nomi: pastda overlay
  - Bosilsa → `/category/[slug]`
- Eski search/filter logikasi `/search` sahifasiga ko'chiriladi (allaqachon bor).

### 2.5. Kategoriya sahifasi (`/category/[slug]`)
- Tepada filter chip qatori + filter tugma (sheet bilan)
- Sheet ichida: sort, narx oralig'i
- Pastida mahsulotlar 2 ustunli grid (mavjud `ProductGrid`)
- Sub-kategoriyalar bor bo'lsa — bar shaklda ko'rinadi (mavjud)

---

## 3. i18n qo'shimchalar

### uz.json
```json
"nav": { "home": "Bosh sahifa", "catalog": "Katalog", ... }
"home": { "viewAll": "Hammasini ko'rish" }
"catalog": { "title": "Katalog", "subtitle": "Kategoriya tanlang" }
```

### ru.json
```json
"nav": { "home": "Главная", "catalog": "Каталог", ... }
"home": { "viewAll": "Смотреть все" }
"catalog": { "title": "Каталог", "subtitle": "Выберите категорию" }
```

---

## 4. Bajarish tartibi

1. **Plan dokumenti** ✓ (shu fayl)
2. **Bot service** — `/admin` command, `setMyCommands`, `setChatMenuButton`
3. **WebApp**:
   - `BottomNav` — 5 tab
   - `/` — `CategoryTabs` olib tashlash + "View all" link
   - `/catalog` — yangi 2-col category grid
   - `/category/[slug]` — filter sheet qo'shish
   - i18n yangilash
4. **Eski `/catalog?q=` search funksiyasi** — `/search` ga move qilingan (allaqachon bor)
5. **Commit + push** → GitHub Actions auto-deploy

---

## 5. Test rejasi

- Bot: `/admin` yuborib admin tugma chiqishi
- Bot: Menu tugma bosilib `/start`, `/help`, `/admin` ko'rinishi
- Bot: Chat pastidagi "Menu" tugmasi WebApp ochishi
- WebApp: 5 ta tab pastda
- WebApp: `/catalog` da 2 ustunli kategoriyalar
- WebApp: kategoriya bosilsa mahsulotlar + filter ishlaydi
- WebApp: tilni o'zgartirsa "Bosh sahifa" → "Главная" bo'ladi

---
