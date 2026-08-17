# 🚀 Serverda ishga tushirish — qisqa qo'llanma

> Ubuntu 22.04 LTS · GCP / DigitalOcean / boshqa
> Domain: `selliostore.uz`

---

## 📋 Oldindan tayyorlash

### 1. Server kerak
- ✅ Ubuntu 22.04 LTS
- ✅ Kamida 4 GB RAM, 40 GB SSD
- ✅ Root yoki `sudo` ruxsati
- ✅ Public IP

### 2. DNS yozuvlari (avval qiling!)

DNS provider'da (Cloudflare / namecheap / boshqa) **A records** qo'shing:

```
selliostore.uz          A    <SERVER_IP>
www.selliostore.uz      A    <SERVER_IP>
admin.selliostore.uz    A    <SERVER_IP>
clients.selliostore.uz  A    <SERVER_IP>
dev.selliostore.uz      A    <SERVER_IP>
```

TTL: 14440 (4 soat) yoki kichikroq. **DNS yangilangunga kuting** (5-10 daqiqa, ba'zan 1 soat).

Tekshirish:
```bash
dig +short selliostore.uz
dig +short admin.selliostore.uz
```

---

## 🛠 Server ishlash (1 marta)

```bash
# 1) Server'ga SSH qiling
ssh user@<SERVER_IP>

# 2) Birinchi marta — bootstrap (Node.js, Postgres, Nginx, PM2, Certbot, UFW)
sudo bash <(curl -sL https://raw.githubusercontent.com/Ziyodillokh/marketplace/main/deploy/00-server-bootstrap.sh)

# Yoki agar repo allaqachon /opt/marketplace'da bo'lsa:
sudo bash /opt/marketplace/deploy/00-server-bootstrap.sh
```

Bootstrap natijasi:
- Postgres user: `marketplace` / random parol → saqlangan: `/root/.marketplace-db-password`
- PostgreSQL 17, Nginx, PM2, Certbot, UFW (22/80/443 ochiq)

---

## 📦 Loyihani deploy qilish

```bash
cd /opt/marketplace  # bootstrap papka yaratdi

# 1) Repo clone (yoki pull, agar bor bo'lsa)
bash deploy/01-clone-and-prepare.sh

# 2) Backend .env yaratish (interaktiv — bot token, parollar so'raydi)
sudo bash deploy/02-env-setup.sh

# 3) Install + Prisma migrate + Build (3-5 daqiqa)
bash deploy/03-install-build-migrate.sh

# 4) PM2 ishga tushirish
bash deploy/04-pm2-start.sh

# 5) Nginx + SSL (Let's Encrypt)
sudo bash deploy/05-nginx-and-ssl.sh

# 6) Health check
bash deploy/06-health-check.sh
```

---

## 🔐 Avto-start (reboot'dan keyin)

```bash
# Faqat 1 marta:
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME
# Pastdagi buyruqni copy-paste qiling (pm2 startup chiqaradi)
pm2 save
```

---

## 🧪 Hammasi ishlayotganini tekshirish

```bash
# PM2 holatlari (5 ta jarayon online bo'lishi kerak)
pm2 status

# Loglar (real-time)
pm2 logs marketplace-api
pm2 logs marketplace-landing

# Nginx
sudo nginx -t
sudo systemctl status nginx

# Postgres
sudo systemctl status postgresql

# Sertifikatlar
sudo certbot certificates

# Brauzerda
# https://selliostore.uz             → landing
# https://admin.selliostore.uz       → mijoz admin
# https://clients.selliostore.uz     → webapp
# https://dev.selliostore.uz         → super admin
```

---

## 🔄 Yangilanish (deploy keyingi marta)

```bash
cd /opt/marketplace
git pull origin main
bash deploy/03-install-build-migrate.sh
pm2 reload ecosystem.config.cjs
bash deploy/06-health-check.sh
```

---

## 🆘 Tuzatish

### "502 Bad Gateway"
PM2'da jarayon o'chgan:
```bash
pm2 logs marketplace-api --lines 50 --err
pm2 restart marketplace-api
```

### Certbot xato — DNS not pointing
```bash
# DNS hali yangilanmagan, kuting va qayta urinib ko'ring
sudo certbot renew --dry-run
sudo bash deploy/05-nginx-and-ssl.sh
```

### Postgres "Authentication failed"
```bash
# Parol fayldan o'qish
cat /root/.marketplace-db-password
# Backend .env'dagi DATABASE_URL'ni tekshiring
grep DATABASE_URL /opt/marketplace/backend/.env
```

### Build memory yetmaydi (8 GB ostida)
```bash
# Swap qo'shish
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Port band
```bash
sudo lsof -i :2400  # qaysi PID
sudo kill -9 <PID>
```

---

## 📂 Server papka strukturasi

```
/opt/marketplace/
├── backend/          # NestJS API (port 2400)
├── webapp/           # Next.js webapp (port 2401)
├── admin/            # Next.js mijoz admin (port 2402)
├── superadmin/       # Next.js super admin (port 2403)
├── landing/          # Statik landing (port 2404)
├── deploy/           # bu skriptlar
├── logs/             # PM2 loglari
├── uploads/          # mahsulot rasmlari
└── ecosystem.config.cjs

/root/.marketplace-db-password  # Postgres parol
/etc/nginx/sites-available/selliostore.uz
/etc/letsencrypt/live/selliostore.uz/
```

---

## 🔑 Kim qaerga kiradi

| URL | Login |
|---|---|
| https://selliostore.uz | umumiy (landing) |
| https://selliostore.uz/signup | umumiy (ro'yxatdan o'tish) |
| https://admin.selliostore.uz/login | mijoz admin akkauntlari |
| https://dev.selliostore.uz/login | siz (owner) — `.env`'dagi `SUPER_SEED_EMAIL` |
| https://clients.selliostore.uz | umumiy (Telegram Mini App) |

---

## 📞 Telegram bot webhook

Deploy oxirida bot webhook'ni o'rnatish:

```bash
BOT_TOKEN=$(grep TELEGRAM_BOT_TOKEN /opt/marketplace/backend/.env | cut -d= -f2)
WEBHOOK_SECRET=$(grep TELEGRAM_WEBHOOK_SECRET /opt/marketplace/backend/.env | cut -d= -f2)

curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -d "url=https://selliostore.uz/api/telegram/webhook" \
  -d "secret_token=${WEBHOOK_SECRET}"

# Tekshirish
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" | python3 -m json.tool
```

---

✅ Hamma narsa sozlangan. Yangi do'kon ochish uchun: **https://selliostore.uz** ga kiring, "Bepul boshlash" bosing.
