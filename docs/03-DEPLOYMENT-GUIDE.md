# DEPLOYMENT & LOCAL TUNNEL GUIDE

> Lokal dev'dan prod'gacha ishga tushirish bo'yicha to'liq qo'llanma. Telegram WebApp HTTPS talab qiladi — shuning uchun **ngrok / cloudflared / loca.lt** kabi tunnel xizmatlardan foydalanamiz.

---

## 1. LOKAL ISHGA TUSHIRISH

### 1.1 Talablar
- Node.js 20+ va npm 10+
- Docker Desktop (Postgres + Redis uchun)
- ngrok hisobi (yoki cloudflared)
- BotFather'da yaratilgan bot va `BOT_TOKEN`
- Buyurtmalar uchun Telegram **private channel** va admin bot u yerda — `CHANNEL_ID` (`-100...`)

### 1.2 1-qadam: Docker bilan DB ishga tushirish
`backend/docker-compose.yml`:
```yaml
version: "3.9"
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: marketplace
      POSTGRES_PASSWORD: marketplace
      POSTGRES_DB: marketplace
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
volumes:
  pgdata:
```

```bash
cd marketplace/backend
docker compose up -d
```

### 1.3 2-qadam: Backend
```bash
cd marketplace/backend
cp .env.example .env
# .env ni to'ldiring: BOT_TOKEN, CHANNEL_ID, DB_URL, REDIS_URL, JWT secrets
npm install
npx prisma generate
npx prisma migrate dev
npx prisma db seed       # boshlang'ich admin + demo data
npm run start:dev
```

Backend → `http://localhost:4000`.

### 1.4 3-qadam: WebApp
```bash
cd marketplace/webapp
cp .env.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:4000 (yoki tunnel URL ishlatadigan bo'lsangiz tunnel)
npm install
npm run dev
```

WebApp → `http://localhost:5174`.

### 1.5 4-qadam: Admin panel
```bash
cd marketplace/admin
cp .env.example .env.local
npm install
npm run dev
```

Admin → `http://localhost:5175`.

### 1.6 5-qadam: Tunnel (Telegram WebApp uchun)
Telegram WebApp **HTTPS** talab qiladi. 2 ta variant:

#### A) ngrok (oson)
```bash
ngrok http 5174     # webapp uchun
# Ikkinchi terminal:
ngrok http 4000     # backend webhook uchun
```

ngrok bizga 2 ta HTTPS URL beradi, masalan:
- `https://abc123.ngrok-free.app` → webapp
- `https://def456.ngrok-free.app` → backend

#### B) cloudflared (ngrok-siz, doimiy)
```bash
cloudflared tunnel --url http://localhost:5174
cloudflared tunnel --url http://localhost:4000
```

#### C) Bitta `npm` script bilan ikkalasini paralel
`scripts/dev-tunnel.js`:
```js
const { spawn } = require('child_process');
const apps = [
  ['ngrok', ['http', '5174', '--log=stdout']],
  ['ngrok', ['http', '4000', '--log=stdout']],
];
apps.forEach(([cmd, args]) => spawn(cmd, args, { stdio: 'inherit' }));
```

### 1.7 6-qadam: BotFather sozlash
1. `@BotFather` → `/mybots` → bot tanlash → **Bot Settings → Menu Button → Configure** → URL: `https://abc123.ngrok-free.app` (webapp tunnel URL).
2. `/setdomain` → webapp tunnel domain (`abc123.ngrok-free.app`).
3. (ixtiyoriy) `/setcommands`:
   ```
   start - Botni ishga tushirish
   help - Yordam
   ```

### 1.8 7-qadam: Telegram webhook (backend uchun)
Backend `TelegramBotService` ga 2 rejim:
- **DEV (polling):** `TELEGRAM_USE_WEBHOOK=false` → grammY `bot.start()` polling.
- **PROD (webhook):** `TELEGRAM_USE_WEBHOOK=true` + backend public URL.

Webhook'ni o'rnatish:
```bash
curl -F "url=https://def456.ngrok-free.app/telegram/webhook" \
     -F "secret_token=YOUR_TELEGRAM_WEBHOOK_SECRET" \
     "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook"
```

Backendda webhook controller:
```ts
@Post('telegram/webhook')
async webhook(@Headers('x-telegram-bot-api-secret-token') secret, @Body() update) {
  if (secret !== env.TELEGRAM_WEBHOOK_SECRET) throw new ForbiddenException();
  return this.bot.handleUpdate(update);
}
```

### 1.9 8-qadam: Channel ID olish
1. Private channel yarating.
2. Botni admin qilib qo'shing (post yuborish huquqi bilan).
3. Channelga test xabar yuboring.
4. Brauzerda: `https://api.telegram.org/bot<TOKEN>/getUpdates` — yoki `@username_to_id_bot` orqali.
5. `-1001234567890` ko'rinishidagi ID ni `TELEGRAM_ORDERS_CHANNEL_ID` ga qo'ying.

### 1.10 9-qadam: Tekshirish
1. Telegramda botingizni oching.
2. `/start` → "Do'konni ochish" tugmasini bosing.
3. WebApp ochilib bosh sahifa chiqishi kerak.
4. Mahsulot tanlab savatga qo'shing → buyurtma bering.
5. Channelda buyurtma kartochkasi paydo bo'lishi kerak.
6. Admin paneldan (`http://localhost:5175`) login qiling → dashboardda live activity'da event ko'rinishi kerak.

---

## 2. SEED DATA (`prisma/seed.ts`)

Boshlang'ich ma'lumotlar:
- 1 ta **superadmin** (`ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD`).
- **Kategoriyalar:** Telefonlar, Aksessuarlar, Kiyim-kechak, Kosmetika, Elektronika, Uy uchun.
- Har bir kategoriyaga 5–10 ta demo mahsulot variantlari bilan.
- 3 ta promo kod (PERCENT 10%, FIXED 50 000, expired test).
- 1 ta home banner.
- Demo related rules (telefon → chexol).

Ishga tushirish:
```bash
npx prisma db seed
```

`package.json`:
```json
{
  "prisma": { "seed": "ts-node prisma/seed.ts" }
}
```

---

## 3. PROD DEPLOYMENT

### 3.1 Server (VPS Ubuntu 22.04 misol)
```bash
# 1) Node, pnpm/npm, nginx, certbot
sudo apt update && sudo apt install -y nodejs npm nginx certbot python3-certbot-nginx postgresql redis git
sudo npm i -g pm2

# 2) Repo
git clone <repo> /opt/marketplace
cd /opt/marketplace

# 3) DB
sudo -u postgres createdb marketplace
sudo -u postgres psql -c "CREATE USER marketplace WITH ENCRYPTED PASSWORD 'strong-pass'; GRANT ALL ON DATABASE marketplace TO marketplace;"

# 4) Backend
cd backend
cp .env.example .env  # to'ldiring
npm ci --omit=dev
npx prisma migrate deploy
npm run build
pm2 start dist/main.js --name marketplace-api

# 5) WebApp
cd ../webapp
cp .env.example .env.local
npm ci
npm run build
pm2 start npm --name marketplace-webapp -- run start

# 6) Admin
cd ../admin
cp .env.example .env.local
npm ci
npm run build
pm2 start npm --name marketplace-admin -- run start

pm2 save && pm2 startup
```

### 3.2 Nginx config

`/etc/nginx/sites-available/marketplace`:
```nginx
# API
server {
  listen 80;
  server_name api.your-domain.uz;
  client_max_body_size 10M;

  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /socket.io/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }
}

# WebApp
server {
  listen 80;
  server_name webapp.your-domain.uz;
  location / {
    proxy_pass http://127.0.0.1:5174;
    proxy_set_header Host $host;
  }
}

# Admin
server {
  listen 80;
  server_name admin.your-domain.uz;
  location / {
    proxy_pass http://127.0.0.1:5175;
    proxy_set_header Host $host;
  }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/marketplace /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.your-domain.uz -d webapp.your-domain.uz -d admin.your-domain.uz
```

### 3.3 BotFather (prod)
- Menu Button URL → `https://webapp.your-domain.uz`
- `/setdomain` → `webapp.your-domain.uz`
- Webhook:
  ```bash
  curl -F "url=https://api.your-domain.uz/telegram/webhook" \
       -F "secret_token=YOUR_SECRET" \
       "https://api.telegram.org/bot<TOKEN>/setWebhook"
  ```

### 3.4 PM2 monitoring
```bash
pm2 status
pm2 logs marketplace-api
pm2 logs marketplace-webapp
pm2 logs marketplace-admin
pm2 monit
```

### 3.5 Backup
- Postgres `pg_dump` cron — har kuni.
- Uploads papkasi (yoki S3) — har kuni.

---

## 4. CI/CD (GitHub Actions, ixtiyoriy)

`.github/workflows/ci.yml`:
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'npm' }
      - run: cd backend && npm ci && npm run lint && npm run test
      - run: cd webapp && npm ci && npm run lint && npm run build
      - run: cd admin && npm ci && npm run lint && npm run build
```

Prod deploy (manual yoki webhook):
```yaml
deploy:
  needs: test
  if: github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  steps:
    - uses: appleboy/ssh-action@v1
      with:
        host: ${{ secrets.SSH_HOST }}
        username: ${{ secrets.SSH_USER }}
        key: ${{ secrets.SSH_KEY }}
        script: |
          cd /opt/marketplace && git pull
          cd backend && npm ci && npx prisma migrate deploy && npm run build
          cd ../webapp && npm ci && npm run build
          cd ../admin && npm ci && npm run build
          pm2 reload all
```

---

## 5. CHECKLIST PROD GO-LIVE

- [ ] Domenlar va SSL ishlamoqda (3 ta subdomain).
- [ ] `.env` da kuchli sirlar (32+ byte JWT secrets).
- [ ] `NODE_ENV=production`.
- [ ] Bot menu button va domain to'g'ri.
- [ ] Webhook o'rnatilgan, `getWebhookInfo` ko'rsatadi.
- [ ] Channel ID to'g'ri va bot u yerda admin.
- [ ] Test buyurtma → channel'ga keldi.
- [ ] Admin login → dashboard ochildi.
- [ ] Postgres backup cron.
- [ ] PM2 ishga tushirish (`pm2 startup`).
- [ ] Sentry (ixtiyoriy) konfiguratsiya qilingan.
- [ ] CORS faqat ruxsat etilgan origin'lar uchun.
- [ ] Rate limit yoqilgan.
- [ ] Lokal va prod URL'lar `.env` da to'g'ri ajratilgan.

---

## 6. TROUBLESHOOTING

| Muammo | Sabab | Yechim |
|--------|-------|--------|
| WebApp ochilmayapti | Bot domain noto'g'ri | BotFather `/setdomain` qayta sozlang |
| `initData invalid` | BOT_TOKEN noto'g'ri | `.env` tekshiring |
| 24 soatdan eski initData | Telegram klient eski | Foydalanuvchi WebApp'ni qayta ochsin |
| Channel'ga xabar bormayapti | Bot kanal admin emas | Bot'ni kanalga admin qilib qo'shing |
| Live activity ko'rinmayapti | Socket.IO blocked | Nginx WebSocket proxy headerlarni tekshiring |
| Rasm yuklanmayapti | Upload dir ruxsat | `chmod 755 uploads/` va PM2 user'ga write huquq |
| Migration xato | DB versiyasi mos emas | `npx prisma migrate reset` (dev only!) |
