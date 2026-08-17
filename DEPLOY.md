# Marketplace — Production Deploy

Eskirgan namuna deploy hujjati. Yangi to'liq qo'llanma uchun:
**[`deploy/DEPLOY.md`](deploy/DEPLOY.md)** ga qarang — Google Cloud uchun
ssh va gcloud rejimlarida CI/CD, GitHub Actions secret/var ro'yxati,
Workload Identity Federation va h.k.

## Qisqacha tuzilish

```
/opt/marketplace/
├── backend/        NestJS API (port 2400)
├── webapp/         Next.js webapp (port 2401)
├── admin/          Next.js admin (port 2402)
├── superadmin/     Next.js super admin (port 2403)
├── landing/        Express landing (port 2404)
├── deploy/         Shell skriptlar + nginx config + watchdog
├── uploads/        Yuklangan rasmlar
├── logs/           PM2 loglari
└── ecosystem.config.cjs
```

## Portlar

| Port | Servis |
| --- | --- |
| 2400 | Backend API |
| 2401 | WebApp Next.js |
| 2402 | Admin Next.js |
| 2403 | Super Admin Next.js |
| 2404 | Landing |
| 80/443 | Nginx (public) |

## PM2

```bash
pm2 list
pm2 logs marketplace-api --lines 100
pm2 reload ecosystem.config.cjs --update-env
```

## Tezkor qo'lda deploy

```bash
cd /opt/marketplace && bash deploy/deploy.sh
```

## Xavfsizlik

- Hech bir servis porti to'g'ridan-to'g'ri ochiq emas — faqat 80/443 (Nginx orqali)
- JWT access (15m) + refresh (30d) rotation
- httpOnly cookie + Bearer token
- Telegram initData HMAC tasdiqlash
- Rate limit
- Helmet headers
- Fail2ban + unattended-upgrades (`deploy/07-reliability.sh`)

## Sirlar (secret/credential) qoidasi

- `.env` git'ga **commit qilinmaydi** — `.gitignore` orqali bloklangan
- Karta raqamlari, kanal taklif linki va boshqa shaxsiy ma'lumotlar
  `backend/.env` ichidagi `PAYMENT_*` o'zgaruvchilardan o'qiladi
- GitHub Actions secret'lari uchun [`deploy/DEPLOY.md`](deploy/DEPLOY.md) ga qarang
