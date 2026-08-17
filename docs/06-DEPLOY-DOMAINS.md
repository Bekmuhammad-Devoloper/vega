# 🌐 Domain konfiguratsiyasi — selliostore.uz

Sellio Store ishlab chiqarish (production) domenlari va ularning sozlamalari.

---

## 📋 Domain xaritasi

| Domen | Maqsad | Port (internal) | Tarkib |
|---|---|---|---|
| `selliostore.uz` | Landing va public site | `2404` | `landing/` |
| `admin.selliostore.uz` | Mijoz admin paneli | `2402` | `admin/` |
| `clients.selliostore.uz` | Telegram WebApp / do'kon | `2401` | `webapp/` |
| `dev.selliostore.uz` | Super Admin (siz uchun) | `2403` | `superadmin/` |
| `selliostore.uz/api/*` | Backend API | `2400` | `backend/` |

---

## 🌍 DNS yozuvlari (A records)

Server IP: `35.234.87.15`

```
selliostore.uz          A    35.234.87.15  TTL: 14440
www.selliostore.uz      A    35.234.87.15  TTL: 14440
admin.selliostore.uz    A    35.234.87.15  TTL: 14440
clients.selliostore.uz  A    35.234.87.15  TTL: 14440
dev.selliostore.uz      A    35.234.87.15  TTL: 14440
```

**Tekshirish:**
```bash
dig selliostore.uz +short
dig admin.selliostore.uz +short
dig clients.selliostore.uz +short
dig dev.selliostore.uz +short
```

---

## 🔐 SSL sertifikatlari (Let's Encrypt)

Hammasi uchun bitta wildcard yoki har bir subdomain alohida. **Tavsiya:** wildcard yoki SAN sertifikat.

### Variant 1 — Hammasi uchun bitta SAN sertifikat
```bash
sudo certbot certonly --webroot -w /var/www/certbot \
  -d selliostore.uz \
  -d www.selliostore.uz \
  -d admin.selliostore.uz \
  -d clients.selliostore.uz \
  -d dev.selliostore.uz \
  --email admin@selliostore.uz \
  --agree-tos --no-eff-email
```

### Variant 2 — Wildcard (DNS challenge kerak)
```bash
sudo certbot certonly --manual --preferred-challenges dns \
  -d selliostore.uz -d "*.selliostore.uz" \
  --email admin@selliostore.uz \
  --agree-tos --no-eff-email
```

Sertifikat o'rnatilgandan keyin **Nginx**'da ham shu path:
```
/etc/letsencrypt/live/selliostore.uz/fullchain.pem
/etc/letsencrypt/live/selliostore.uz/privkey.pem
```

---

## 🔧 Nginx sozlash

1. Nginx config nusxalash:
   ```bash
   sudo cp deploy/selliostore.uz.nginx /etc/nginx/sites-available/selliostore.uz
   sudo ln -s /etc/nginx/sites-available/selliostore.uz /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

2. Tekshirish:
   ```bash
   curl -I https://selliostore.uz
   curl -I https://admin.selliostore.uz
   curl -I https://clients.selliostore.uz
   curl -I https://dev.selliostore.uz
   ```

---

## 📦 Backend env (production)

`/opt/marketplace/backend/.env`:
```
ADMIN_URL=https://admin.selliostore.uz
WEBAPP_URL=https://clients.selliostore.uz
SUPERADMIN_URL=https://dev.selliostore.uz
LANDING_URL=https://selliostore.uz
APP_URL=https://selliostore.uz
```

`.env.production.example` faylga qarang.

---

## 🚀 PM2 ishga tushirish

`ecosystem.config.cjs`'da 5 ta jarayon konfiguratsiya qilingan:

```bash
cd /opt/marketplace
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # autostart
```

Tekshirish:
```bash
pm2 status
# marketplace-api          → port 2400
# marketplace-webapp       → port 2401
# marketplace-admin        → port 2402
# marketplace-superadmin   → port 2403
# marketplace-landing      → port 2404
```

---

## 🧪 End-to-end test (production)

1. **Landing** ochiladi: https://selliostore.uz
2. **"Bepul boshlash"** bosing → /signup sahifaga o'tadi
3. Forma to'ldiring va submit qiling → POST `/api/public/signup`
4. Vaqtinchalik parol qaytadi
5. **"Admin panelga kirish"** bosing → https://admin.selliostore.uz/login
6. Email + temp parol bilan kiring → admin panel ochiladi

### Super admin tekshiruv
1. https://dev.selliostore.uz/login → owner@selliostore.uz
2. Tenants ro'yxatida yangi do'kon ko'rinishi kerak
3. Audit log'da `signup` event yozilgan bo'lishi kerak

---

## 🔥 Xavfsizlik tavsiyalari

### `dev.selliostore.uz` (Super Admin)
Cloudflare Access yoki Nginx IP allowlist orqali himoyalang:

```nginx
# Faqat ofis va VPN
allow 1.2.3.4;     # office
allow 5.6.7.8;     # VPN gateway
deny all;
```

### Production checklist
- [ ] HTTPS hammasida ishlayapti (HSTS yoqilgan)
- [ ] `.env`'da real secret'lar (default'larni almashtirildi)
- [ ] Postgres backup avtomatlashtirilgan
- [ ] Rate limiting yoqilgan (Public signup uchun 5/soat/IP)
- [ ] Nginx access log'lari rotate qilinadi (logrotate)
- [ ] PM2 monit yoqilgan: `pm2 install pm2-logrotate`
- [ ] Telegram webhook URL'i `selliostore.uz`'ga yangilangan
- [ ] OWASP top 10 ko'rib chiqilgan
- [ ] OpenAI API kalit `.env`'da, hech qachon kod ichida emas

---

## 🆘 Tuzatish (troubleshooting)

### "502 Bad Gateway"
PM2'da jarayon o'chgan. Tekshirish:
```bash
pm2 logs marketplace-api --lines 50
```

### "ERR_TOO_MANY_REDIRECTS"
HTTP→HTTPS redirect loop. Cloudflare orqasidamiz → SSL mode "Full (strict)"ga o'rnating.

### Sertifikat eskirgan
Certbot avto-renewal o'chgan. Qayta yoqish:
```bash
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

### CORS xato
Brauzer'da: "blocked by CORS". `backend/src/main.ts`'da regex tekshiring:
```ts
/^https:\/\/(.+\.)?selliostore\.uz$/
```

---

## 📞 Yordam

Server: `35.234.87.15` (GCP / DigitalOcean / boshqa)
Repo: bizning Git
Sertifikatlar: Let's Encrypt
DNS provider: (sizning domain registrar)
