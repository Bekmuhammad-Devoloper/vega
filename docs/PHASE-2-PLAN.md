# Phase 2 — Professional plan

**Sana:** 2026-05-17
**Maqsad:** Profile sahifasini Uzum stilida qayta dizayn qilish + post-purchase mahsulot tavsiyalari (bot orqali) + admin broadcast.

---

## Qism 1 — Profile sahifasi qayta dizayn (Uzum stili UX)

### Yangi tuzilma
1. **Hero kartochkasi** (top):
   - Avatar (yoki initials) — 56×56 yumaloq
   - Ism (large, bold) + `@username` (sub)
   - O'ng tomonda statistika rozetkalari: **Buyurtmalar (N)** • **Sevimlilar (N)**
2. **Section 1 — Mening hisobim** (white card, dividerli):
   - Mening buyurtmalarim →
   - Sevimlilar →
   - Promokodlarim →
3. **Section 2 — Aloqa** (white card):
   - Yordam (Support)
   - Biz haqimizda
   - Bog'lanish (Phone)
4. **Section 3 — Sozlamalar** (white card):
   - Ilova tili (flag + qiymat o'ngda)
5. **Pastda**: versiya kichkina text

### Stil tafsilotlari
- Har section o'rtasida 12px gap
- Card ichida har row balandligi 56px (Uzum'dagidek)
- Icon: muted gray, chevron o'ngda
- Background: var(--color-bg) (off-white)
- Card: white, rounded-2xl, border-[var(--color-border)]

### Fayllar
- `webapp/src/app/(shop)/profile/page.tsx` — qayta yozish
- i18n: `profile.stats.orders`, `profile.stats.favorites`, `profile.notifications` qo'shish
- API: yangi endpoint kerak emas (mavjud `apiListOrders`, `apiFavoritesSummary` ishlatamiz)

---

## Qism 2 — Post-purchase mahsulot tavsiyalari (Product relations + bot DM)

### Mavjud infra
- `RelatedRule` model bor (sourceProduct → targetProduct)
- `/admin/related-rules` sahifasi ishlaydi
- Bot `sendDirectMessage()` mavjud
- `EventEmitter2` `order.created` event'ini chiqaradi
- `ScheduleModule` o'rnatilgan

### Yangi DB modeli
```prisma
model OrderRecommendation {
  id          String   @id @default(cuid())
  orderId     String   @unique
  userId      String
  scheduledAt DateTime  // now + 2 min
  expiresAt   DateTime  // now + 1 hour
  sentAt      DateTime?
  sentProductIds String[] // qaysi mahsulotlar tavsiya qilindi
  createdAt   DateTime @default(now())
  @@index([scheduledAt, sentAt])
}
```

### Backend modul: `RecommendationsModule`
- `OnEvent('order.created')` → 2 daqiqalik scheduledAt bilan `OrderRecommendation` yaratadi
- `@Cron(CronExpression.EVERY_MINUTE)` `processDue()`:
  1. `scheduledAt <= now AND sentAt IS NULL AND expiresAt > now` topadi
  2. Order item'larini oladi → har biri uchun `RelatedRule` so'rab targetProduct'larni yig'adi
  3. Unique 3-5 ta mahsulotni tanlaydi (eng ko'p sotilgan birinchi)
  4. Bot DM yuboradi (HTML rasmlar yo'q — title + price + WebApp tugma)
  5. `sentAt` va `sentProductIds` ni saqlaydi
- Idempotent: bir orderga bir marta yuboriladi

### Admin: Product formasiga "Related products" qo'shish
- `ProductForm` ga yangi `Card`: "Tavsiya etilgan mahsulotlar (siz buni sotib oldingiz → bularni ham xohlaysizmi)"
- Multi-select: mahsulotlarni qidiruv orqali tanlash
- On save (product create/update): mavjud `RelatedRule(sourceProductId=this)` ni o'chirib, yangilarini yaratadi
- Backend: AdminProductsService update'da `relatedProductIds: string[]` qabul qiladi

### Bot xabar formati
```
🎁 Sizga tavsiya etamiz

Siz "{product.title}" ni sotib oldingiz!
Quyidagi mahsulotlar shu mahsulot bilan mukammal qo'shiladi:

1. Premium chexol — 150 000 so'm
2. Tez quvvatlovchi kabel — 80 000 so'm
3. Himoya plyonkasi — 25 000 so'm

[🛍 Bularni ko'rish]  ← WebApp tugma
```

---

## Qism 3 — Admin broadcast (xabar yuborish)

### Yangi DB modeli
```prisma
model Broadcast {
  id          String   @id @default(cuid())
  messageUz   String
  messageRu   String?
  filters     Json     // { hasOrders?, noOrdersInDays?, language?, activeInDays? }
  totalCount  Int      @default(0)
  sentCount   Int      @default(0)
  failedCount Int      @default(0)
  status      String   @default("pending") // pending | running | completed | failed
  createdById String
  createdAt   DateTime @default(now())
  finishedAt  DateTime?
  @@index([createdAt])
}
```

### Backend modul: `AdminBroadcastModule`
- `POST /admin/broadcasts` body: `{ messageUz, messageRu?, filters }`
- `GET /admin/broadcasts/preview-count` query: `filters` → matched users count
- `GET /admin/broadcasts` list (history)
- Processor: yaratilgandan keyin async jarayonda batch'larda yuboradi
  - 25 user/secund (Telegram rate limit: 30 msg/sec global)
  - Har user uchun language'ga qarab uz/ru variant tanlanadi
  - Har 50ta dan keyin DB'ga progress yangilab boriladi

### Filterlar
- `hasOrders: true | false` — order qilgan/qilmagan
- `noOrdersInDays: N` — oxirgi N kun ichida order qilmagan (re-engagement)
- `activeInDays: N` — oxirgi N kun ichida faol
- `language: 'uz' | 'ru'` — faqat shu tildagi

### Admin UI: `/admin/broadcasts`
- Yangi broadcast tugma → sheet/modal forma:
  - Xabar matni (uz, ru)
  - Filter checkbox/inputlar
  - "Adresatlar: 1,234 user" — real-time preview
  - Yuborish tugma (confirm bilan)
- Tarix jadvali: matn, filter summary, sent/total, status, sana

---

## Bajarish tartibi

1. **Plan doc** ✓ (shu fayl)
2. **Profile redesign** — UI only, eng tez
3. **DB migrations** — OrderRecommendation, Broadcast
4. **Recommendations module** — service + cron + event listener
5. **Admin: related products** in product form + backend update
6. **Admin broadcast** — module + controller + UI
7. **Type-check + commit + push**

Eslatma:
- Telegram rate limit: ~30 msg/sec global. Batchda 25 ms gap ishlatamiz.
- Bot DM yuborganda foydalanuvchi blocklagan bo'lsa — silently log, davom etamiz.
- `sentProductIds` String[] — Postgres arrayda saqlanadi.

---
