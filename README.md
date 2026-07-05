# Vega — Virtual raqamlar (web app)

`@Nomer_xuzbot` Telegram botining web-ilova ko'rinishi. Foydalanuvchilar SMS
tasdiqlash uchun turli davlatlarning **vaqtinchalik virtual raqamlarini** sotib
oladi va kelgan **SMS kodini** real vaqtda ko'radi.

> ⚙️ Raqamlar ortdagi ulgurji provayder ([5sim.net](https://5sim.net))
> API'sidan olinadi — biz ustiga ustama (markup) qo'shib sotamiz.

## Nima ishlaydi (to'liq)

- 🏠 **Landing sahifa** mehmonlar uchun + ro'yxatdan o'tish / kirish
- 🔐 Auth: email + parol, JWT sessiya cookie, birinchi user = **admin**
- 🛒 Xizmat + davlat tanlab **narxni ko'rish** va raqam **sotib olish**
- 📩 **Real vaqtda SMS kutish** (3s da bir) + **countdown taymer** + kod/raqamni nusxalash
- ↩️ **Bekor qilish → pul avtomatik qaytadi** (SMS kelmasa yoki vaqt tugasa)
- 💰 **Hamyon**: balans + harakatlar tarixi (har biri tranzaksiya sifatida)
- 💳 **Balansni to'ldirish**:
  - `demo` — sinov uchun darhol tushadi
  - `manual` — so'rov → **admin tasdiqlaydi** → tushadi
  - `Payme` / `Click` — merchant sozlansa avtomatik yoqiladi
- 👑 **Admin panel**: kutilayotgan to'lovlarni tasdiqlash/rad etish, qo'lda balans, foydalanuvchilar ro'yxati
- 🛡️ **Rate-limit** (login/register/xarid/to'ldirish) — suiiste'moldan himoya
- 🧪 **DEMO (mock) rejim** — API kaliti bo'lmasa ham to'liq sinab ko'rsa bo'ladi

## Texnologiyalar

- **Next.js 15** (App Router) + React 19 + TypeScript
- **Tailwind CSS v4**
- **Prisma 6 + SQLite** (keyin PostgreSQL'ga oson o'tadi)
- **jose** (JWT sessiya) + **bcryptjs** (parol) + **zod** (validatsiya)

## Ishga tushirish

```bash
# 1. Paketlar
npm install

# 2. .env yarating (namunadan)
cp .env.example .env

# 3. Baza + jadvallar
npm run db:migrate

# 4. (ixtiyoriy) test admin yaratish
npm run db:seed
#   -> admin@nomer.uz / admin123  (100 000 so'm balans bilan)

# 5. Dev server
npm run dev
# -> http://localhost:3000
```

`npm run db:seed` ishlatmasangiz — **birinchi ro'yxatdan o'tgan foydalanuvchi
avtomatik ADMIN** bo'ladi. Admin `/admin` da to'lovlarni tasdiqlaydi yoki qo'lda
balans to'ldiradi.

**Tezkor sinov (demo rejim):** ro'yxatdan o'ting → `/wallet` da "Demo to'ldirish"
bilan balansni to'ldiring → bosh sahifada raqam sotib oling → SMS ~8s da keladi.

## npm scriptlar

| Skript             | Vazifasi                          |
| ------------------ | --------------------------------- |
| `npm run dev`      | Dev server                        |
| `npm run build`    | Ishlab chiqarish uchun build      |
| `npm run db:migrate` | Migratsiya (jadvallarni yaratish) |
| `npm run db:seed`  | Test admin yaratish               |
| `npm run db:studio`| Prisma Studio (bazani ko'rish)    |

## `.env` sozlamalari

| O'zgaruvchi                    | Ma'nosi                                       |
| ------------------------------ | --------------------------------------------- |
| `DATABASE_URL`                 | SQLite fayl manzili                           |
| `AUTH_SECRET`                  | Sessiya JWT kaliti (prod'da tasodifiy qiling) |
| `FIVESIM_API_KEY`              | 5sim API kaliti. **Bo'sh = DEMO/mock rejim**  |
| `RUB_TO_UZS` / `MARKUP_PERCENT`| Narx konvertatsiyasi va ustama %              |
| `DEMO_TOPUP`                   | Demo to'ldirish (**prod'da `false`!**)        |
| `MIN_TOPUP` / `MAX_TOPUP`      | To'ldirish limitlari (so'm)                   |
| `PAYME_*` / `CLICK_*`          | Merchant ma'lumotlari (to'ldirilsa yoqiladi)  |
| `APP_URL`                      | To'lov qaytish havolalari uchun               |

### Haqiqiy rejimga o'tish

1. **Raqamlar:** [5sim.net](https://5sim.net) da API key oling → `.env` ga `FIVESIM_API_KEY`.
2. **To'lov:** Payme/Click merchant oching → `PAYME_*` yoki `CLICK_*` ni to'ldiring.
   > ⚠️ Payme/Click uchun webhook (Merchant API) endpoint'ini yozish kerak —
   > `src/lib/payments.ts` da checkout havolasi tayyor, webhook'ni `src/app/api/`
   > ga qo'shasiz. To'lov usuli adapteri shu fayl ichida markazlashgan.

## Loyiha tuzilmasi

```
src/
├─ app/
│  ├─ api/            # auth, prices, orders, wallet, payments, admin
│  ├─ login/          # kirish / ro'yxatdan o'tish
│  ├─ orders/[id]/    # buyurtma + jonli SMS + countdown
│  ├─ wallet/         # balans + to'ldirish + tarix
│  ├─ history/        # buyurtmalar tarixi
│  ├─ admin/          # to'lovlarni tasdiqlash, balans, userlar
│  └─ page.tsx        # landing (mehmon) / dashboard (user)
├─ components/
└─ lib/
   ├─ provider/       # SMS-provayder adapterlari (5sim + mock)
   ├─ payments.ts     # to'lov / balans to'ldirish mantiqi
   ├─ orders.ts       # xarid / poll / bekor qilish + hamyon
   ├─ ratelimit.ts    # rate-limiter
   ├─ auth.ts         # sessiya + parol
   └─ config.ts       # sozlamalar + narx hisoblash
```

## Keyingi qadamlar (roadmap)

- [x] To'lov tizimi (demo + manual + Payme/Click adapteri)
- [x] Rate-limit himoyasi
- [x] Landing + hamyon + countdown
- [ ] **Payme/Click webhook** (Merchant API) — avtomatik tasdiqlash
- [ ] Telegram Login orqali kirish
- [ ] Narxlar/davlatlarni 5sim'dan avtomatik yangilash
- [ ] PostgreSQL + prod deploy (Vercel + Neon yoki VPS)
- [ ] Ko'p instansiya uchun Redis rate-limit

## Muhim eslatma

Virtual raqam xizmatlari **ikki tomonlama (dual-use)**: to'lov provayderlari
bunday biznesni rad etishi, hamda raqamlarni ba'zi platformalarga ro'yxatdan
o'tkazish o'sha platforma qoidalariga zid bo'lishi mumkin. Ishga tushirishdan
oldin to'lov shartlari va mahalliy qonunchilikni tekshiring.
