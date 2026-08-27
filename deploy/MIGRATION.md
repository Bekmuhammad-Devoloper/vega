# Yangi serverga ko'chish + CI/CD

## Tartib

### 1. Yangi serverni tayyorlash
```bash
ssh root@<YANGI_IP>
curl -fsSL https://raw.githubusercontent.com/Bekmuhammad-Devoloper/vega/saas/deploy/provision-server.sh -o /tmp/p.sh
bash /tmp/p.sh
```
Node 20, pm2, Docker, Postgres+Redis, nginx, certbot o'rnatiladi;
repo `/opt/vega/app` ga klonlanadi; `.env` yaratiladi; GitHub uchun SSH kalit chiqadi.

### 2. Kalitlarni to'ldirish
```bash
nano /opt/vega/app/backend/.env
```
`TELEGRAM_BOT_TOKEN`, `SPIDER_API_KEY`, `ISTAR_API_KEY`, `HEROSMS_API_KEY`.

### 3. Ma'lumotlarni ko'chirish
ESKI serverda:
```bash
bash deploy/migrate-data.sh dump --stop     # backend to'xtaydi, dump olinadi, qayta yonadi
scp /tmp/vega-*.dump root@<YANGI_IP>:/tmp/
```
YANGI serverda:
```bash
bash /opt/vega/app/deploy/migrate-data.sh restore /tmp/vega-*.dump
```

### 4. Birinchi ishga tushirish
```bash
cd /opt/vega/app/backend
npm ci && npx prisma generate && npx nest build
pm2 start dist/src/main.js --name vega-backend --update-env
pm2 save && pm2 startup
```

### 5. GitHub Secrets
`Settings → Secrets and variables → Actions → New repository secret`

| Nom | Qiymat |
|---|---|
| `SSH_HOST` | yangi server IP |
| `SSH_USER` | `root` |
| `SSH_KEY` | provision chiqargan **maxfiy** kalit (to'liq, `-----BEGIN`dan `END`gacha) |
| `SSH_PORT` | ixtiyoriy, default 22 |
| `HEALTH_URL` | ixtiyoriy, default api.vega.yuksalish.dev |

### 6. nginx + SSL
```bash
certbot --nginx -d api.vega.yuksalish.dev -d app.vega.yuksalish.dev \
        -d admin.vega.yuksalish.dev -d panel.vega.yuksalish.dev
```
Avval DNS A yozuvlari yangi IP'ga qaratilgan bo'lsin.

### 7. Sinov
GitHub → Actions → **Deploy** → Run workflow.
Yoki `saas` branchiga push — avtomatik ishlaydi.

---

## Keyin har safar
```bash
git push origin master:saas
```
→ CI tip tekshiruvi + build → o'tsa serverga deploy → sog'liq tekshiruvi.
Buzuq kod serverga **chiqmaydi** (`check` job darvoza).

## Orqaga qaytarish
```bash
ssh root@<IP> 'cd /opt/vega/app && git reset --hard <eski_sha> && bash /opt/vega/deploy.sh saas'
```
