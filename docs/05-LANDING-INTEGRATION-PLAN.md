# 🌐 LANDING INTEGRATION — Reja va Arxitektura

> Sellio landing sahifasini (Ziyodillokh/landing) bizning marketplace platformaga to'liq qo'shish.

---

## 📊 Mavjud holat tahlili

### Landing (Ziyodillokh/landing)
- **Tech:** Vanilla HTML + Tailwind (CDN) + Lucide icons + Geist font
- **Build tool:** YO'Q (statik fayl)
- **Tarif tugmalari:** Free, Pro, Premium (Standard'siz)
- **CTA tugmalari:** "Bepul boshlash", "Pro'ga o'tish", "Premium olish" — hozir `href="#"` (sahta)
- **Sahifa bo'limlari:** Hero, Features (phone carousel), Before/After AI, Pricing, FAQ, Testimonials, Footer

### Bizning platforma
- **`backend/`** — NestJS API, port 4000
- **`admin/`** — Mijoz panel, port 5175
- **`superadmin/`** — Platform Owner panel, port 5180
- **`webapp/`** — Telegram WebApp, port 5174
- ❌ **`landing/`** — YO'Q

---

## 🎯 Asosiy maqsad

Landing → Signup → Tenant yaratish → Mijoz admin paneli ishga tushishi
( **"Bepul boshlash"** tugmasi → real ro'yxatdan o'tish → do'kon yaratiladi → user `admin/` panelga kiradi )

---

## 🏗 Tanlangan arxitektura

### A varianti — Statik landing (TANLANGAN ⭐)
```
landing/
├── public/
│   ├── index.html       # ✅ Sellio landing (modifikatsiya bilan)
│   ├── signup.html      # Yangi — ro'yxatdan o'tish forma
│   ├── login.html       # Yangi — login redirect
│   ├── assets/
│   │   ├── icons/
│   │   └── images/
│   └── js/
│       └── api.js       # Backend bilan aloqaga
├── package.json         # serve script
└── README.md
```

**Plus:**
- Tezkor — build kerakmas
- SEO-friendly
- Cloudflare/Vercel'da bepul host bo'ladi
- O'zgarishlar darhol ko'rinadi

**Minus:**
- JS framework yo'q → form validation qo'lda

### B varianti — Next.js landing
**Plus:** Component reuse, A/B test, SSG
**Minus:** Build kerak, hozir 4 ta Next loyiha bor — qiyinroq deploy

➡️ **A variantni tanlaymiz** — landing kichik, statik bo'lib qolgani ma'qul.

---

## 🔄 User Flow (yangi mijoz)

```
1. user landing'ga keladi: https://platform.uz
       ↓
2. "Bepul boshlash" tugmasi → /signup
       ↓
3. Forma to'ldiradi: do'kon nomi, email, telefon, tarif
       ↓
4. POST /api/public/signup → tenantni yaratadi (status: PENDING_VERIFY)
       ↓
5. Email/SMS orqali verify link/code yuboriladi (Phase 2)
       ↓
6. Verify bo'lgach → tenant ACTIVE bo'ladi, admin akkaunt ochiladi
       ↓
7. Mijoz https://admin.platform.uz ga login qiladi
       ↓
8. Birinchi mahsulot qo'shish onboarding boshlanadi
```

**Phase 1 (bugun):** 1-4 va 7 (verify'siz, darhol active)
**Phase 2 (keyin):** Email verify, Telegram OAuth

---

## 📋 Implementation reja (bosqichma-bosqich)

### Bosqich 1 — Landing loyihasini sozlash
- [ ] `landing/` papkasini yaratish
- [ ] `public/index.html` — Sellio landing nusxasini olib kelish
- [ ] Brending o'zgartirish (Sellio → bizning nom, agar kerak bo'lsa qoldiramiz)
- [ ] CTA tugmalarini `/signup` ga yo'naltirish
- [ ] **4-tarif** qo'shish (Standard'ni ham, hozir 3 ta bor)
- [ ] Static server (Express yoki sirve)

### Bosqich 2 — Backend public signup API
- [ ] `backend/src/modules/public/` modul yaratish
  - `public.module.ts`
  - `public-signup.controller.ts` — POST `/api/public/signup`
  - `public-signup.service.ts` — Tenant + Admin yaratish (transaction)
- [ ] DTO validation
- [ ] Rate limiting (5 ta signup / IP / soat)
- [ ] Slug yaratish (unique check)
- [ ] Default Admin credentials (password reset link yuboriladi)
- [ ] Public endpoint — no auth

### Bosqich 3 — Signup forma
- [ ] `landing/public/signup.html`
  - Do'kon nomi
  - Egasi ismi
  - Email
  - Telefon
  - Tarif (URL'dan tanlash: ?plan=PRO)
  - Submit → POST /api/public/signup
- [ ] Success ekran: "Yaratildi! Email tekshiring"
- [ ] Error handling
- [ ] Loading state

### Bosqich 4 — Landing CTA bog'lash
- [ ] "Bepul boshlash" → `/signup?plan=FREE`
- [ ] "Standard tanlash" → `/signup?plan=STANDARD`
- [ ] "Pro'ga o'tish" → `/signup?plan=PRO`
- [ ] "Premium olish" → `/signup?plan=PREMIUM`
- [ ] "Demoga yozilish" tugmasi → tg://t.me/yourbot

### Bosqich 5 — Login link
- [ ] Navbar "Kirish" tugmasi → `https://admin.platform.uz` (yoki `/admin/login`)
- [ ] Dev'da → `http://localhost:5175/login`

### Bosqich 6 — Deploy konfiguratsiyasi
- [ ] `landing/package.json` — `serve` paketi bilan dev script
- [ ] `landing/Dockerfile` (kelajak uchun)
- [ ] Nginx config (production) — landing root path
- [ ] `ecosystem.config.cjs` — PM2 entry qo'shish

---

## 🔌 API kontrakti

### POST `/api/public/signup`

**Request:**
```json
{
  "shopName": "Eshik Bozori",
  "ownerName": "Sardor Karimov",
  "ownerEmail": "sardor@eshik.uz",
  "ownerPhone": "+998901234567",
  "tariffPlan": "FREE",
  "agreeTerms": true
}
```

**Response (200):**
```json
{
  "ok": true,
  "tenantId": "cmq6...",
  "slug": "eshik-bozori",
  "adminLoginUrl": "http://localhost:5175/login",
  "tempPassword": "TempPass123!"
}
```

**Response (409 — email/slug band):**
```json
{
  "message": "Email yoki do'kon nomi allaqachon band",
  "field": "ownerEmail"
}
```

**Response (429 — rate limit):**
```json
{
  "message": "Juda ko'p urinish. 1 soatdan keyin urinib ko'ring"
}
```

### Backend logikasi
1. Validate DTO
2. Rate limit check (5/soat/IP)
3. Slug auto-generate (`shopName` dan)
4. Slug + email unique check
5. Transaction:
   - `Tenant` yaratish (status: ACTIVE, FREE/STANDARD da trial 14 kun)
   - `Admin` yaratish (random password)
   - `RefreshToken` yo'q
6. (Future) Email yuborish (welcome + password reset link)
7. Audit log
8. Response

---

## 🎨 Brending o'zgartirishlar

| Original (Sellio) | Bizning | Sabab |
|---|---|---|
| Logo | Bizning | Brending |
| Sellio nomi | (qoldiramiz yoki nomimiz) | Tanlov |
| 3 tarif | 4 tarif (Standard qo'shamiz) | Marketplace pricing |
| `href="#"` CTA | `/signup?plan=X` | Aksiya |
| Footer telefon | Bizning telefon | Real ma'lumot |
| Demo link | Telegram bot link | Onboarding |

---

## 📐 Texnik tafsilotlar

### Portlar (dev)
- Backend API: **4000**
- Landing: **5173** (yangi)
- Webapp: 5174
- Admin: 5175
- SuperAdmin: 5180

### Routing strategiyasi (dev)
- `http://localhost:5173` → Landing
- `http://localhost:5173/signup` → Signup form
- `http://localhost:5175/login` → Admin login
- `http://localhost:5180/login` → Super Admin login

### Routing strategiyasi (prod)
- `https://platform.uz` → Landing
- `https://platform.uz/signup` → Signup
- `https://admin.platform.uz` → Mijoz admin
- `https://super.platform.uz` → Super admin
- `https://api.platform.uz` → Backend

### CORS
- Backend `main.ts` da CORS allow list:
  - `http://localhost:5173` (landing)
  - `http://localhost:5174` (webapp)
  - `http://localhost:5175` (admin)
  - `http://localhost:5180` (super admin)

---

## ⚠️ Xavfsizlik

1. **Rate limiting** — IP bo'yicha (NestJS Throttler)
2. **Honeypot** — sahta input (botlarni tutish)
3. **CAPTCHA** — Phase 2 (Cloudflare Turnstile)
4. **Email verify** — Phase 2
5. **Temp password** — bir martalik, kirgandan keyin majburiy o'zgartirish

---

## 🚀 Boshlanish — Phase 1 MVP (bugun)

Hozir bajaramiz:
1. ✅ `landing/` papka, statik HTML
2. ✅ Backend `PublicSignupController`
3. ✅ Signup forma
4. ✅ CTA tugmalarni bog'lash
5. ✅ Localda end-to-end test

**Vaqt:** ~30-45 daqiqa

**Keyin (boshqa kun):**
- Email verify
- CAPTCHA
- Onboarding wizard (admin'da)
- Cloud deploy

---

## ❓ Qarorlar (siz tasdiqlashingiz kerak)

| Savol | Variantlar | Tavsiyam |
|---|---|---|
| **Landing nomi** | Sellio / o'z brendingiz | Hozircha Sellio qoldiraylik, keyin almashtirasiz |
| **Standard tarifi** | Landing'ga qo'shamizmi? | ✅ Ha (sizning narxlash modelida bor) |
| **Trial** | FREE'da ham trial / faqat pulli'da | Trial faqat pulli (Standard+) |
| **Verify** | Hozir kerakmi yoki keyin? | Phase 2 (hozir darhol active) |
| **Telegram OAuth** | Phase 1 yoki 2? | Phase 2 |
| **Logo va rang** | Sellio'niki / bizniki | Hozir Sellio'niki, keyin almashtirasiz |

---

## ✅ Boshlay olamanmi?

Tasdiqlasangiz, men quyidagilarni darhol qilaman:
1. `landing/` papka — Sellio HTML + signup forma
2. Backend `public/signup` endpoint
3. CTA tugmalarni real ishlatishga sozlash
4. Hammasini birga test

Yoki agar yo'lni o'zgartirmoqchi bo'lsangiz, qaysi varianni xohlaysiz?
