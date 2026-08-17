# Sellio Store — Production CI/CD (Google Cloud)

Yangi Google Cloud serveridan production'ga to'liq avtomatik deploy chiqarish uchun qo'llanma.

---

## 1. Yangi GCP server tayyorlash

### 1.1. Compute Engine VM yaratish

```bash
gcloud compute instances create marketplace-prod \
  --zone=europe-west3-a \
  --machine-type=e2-standard-2 \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=40GB \
  --boot-disk-type=pd-ssd \
  --tags=http-server,https-server \
  --metadata=enable-oslogin=TRUE
```

### 1.2. Firewall

```bash
gcloud compute firewall-rules create allow-http-https \
  --allow=tcp:80,tcp:443 \
  --target-tags=http-server,https-server
```

### 1.3. DNS yozuvlari (A record)

Quyidagi subdomenlarning hammasi server IP'siga ishora qilishi shart:

- `selliostore.uz`
- `www.selliostore.uz`
- `admin.selliostore.uz`
- `clients.selliostore.uz`
- `dev.selliostore.uz`

### 1.4. Bootstrap (BIR BUYRUQ)

```bash
ssh user@SERVER_IP
sudo bash -c "$(curl -fsSL https://raw.githubusercontent.com/Ziyodillokh/marketplace/main/deploy/bootstrap.sh)"
```

Bu skript:
- Node.js 20, PostgreSQL 17, Nginx, PM2, Certbot, UFW o'rnatadi
- Repo'ni `/opt/marketplace`ga clone qiladi
- `.env` so'rab oladi (yoki `NON_INTERACTIVE=1` bo'lsa skip)
- Hamma narsani build qiladi va PM2 ishga tushiradi
- Nginx + Let's Encrypt SSL sozlaydi
- Health check yuritadi

---

## 2. GitHub Actions secret va var'lar

### 2.1. `vars` (Settings → Secrets and variables → Actions → Variables)

| Nom | Qiymat | Izoh |
| --- | --- | --- |
| `DEPLOY_MODE` | `gcloud` yoki `ssh` | Default: `ssh`. `gcloud` tavsiya |
| `DEPLOY_HOST` | `selliostore.uz` | Faqat ko'rsatish uchun |
| `GCP_INSTANCE_NAME` | `marketplace-prod` | Faqat `gcloud` rejimida |
| `GCP_ZONE` | `europe-west3-a` | Faqat `gcloud` rejimida |
| `GCP_PROJECT_ID` | `your-project-id` | Faqat `gcloud` rejimida |

### 2.2. `secrets` (Settings → Secrets and variables → Actions → Secrets)

**Hamma rejimda kerak:**

| Nom | Izoh |
| --- | --- |
| `TELEGRAM_NOTIFY_TOKEN` | Deploy bildirishnomalari uchun bot tokeni |
| `TELEGRAM_NOTIFY_CHAT_ID` | Bildirishnomalar yuboriladigan chat |

**`DEPLOY_MODE=ssh` uchun:**

| Nom | Izoh |
| --- | --- |
| `SSH_HOST` | Server IP yoki DNS |
| `SSH_USER` | SSH user (masalan `ubuntu`) |
| `SSH_PRIVATE_KEY` | `id_ed25519` private key (PEM format, to'liq) |

**`DEPLOY_MODE=gcloud` uchun:**

| Nom | Izoh |
| --- | --- |
| `GCP_WIF_PROVIDER` | Workload Identity Federation provider resource name |
| `GCP_SA_EMAIL` | Service Account email |

---

## 3. Workload Identity Federation (gcloud rejimi)

Bu rejim — eng xavfsiz variant. SSH key'ni GitHub'ga qo'ymasdan IAP tunnel orqali ishlatadi.

```bash
PROJECT_ID="your-project-id"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
REPO="Ziyodillokh/marketplace"

# 1. Service Account yaratish
gcloud iam service-accounts create github-deployer \
  --display-name="GitHub Actions Deployer"

SA_EMAIL="github-deployer@${PROJECT_ID}.iam.gserviceaccount.com"

# 2. Kerakli rollar
for role in roles/compute.instanceAdmin.v1 roles/iap.tunnelResourceAccessor roles/compute.osLogin; do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SA_EMAIL}" --role="$role"
done

# 3. Workload Identity Pool
gcloud iam workload-identity-pools create github \
  --location=global --display-name="GitHub Actions"

# 4. OIDC provider (GitHub)
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location=global --workload-identity-pool=github \
  --display-name="GitHub OIDC" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='${REPO}'" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# 5. Service Account'ga ushbu repodan token olishga ruxsat
gcloud iam service-accounts add-iam-policy-binding $SA_EMAIL \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/${REPO}"

# 6. GitHub'ga qo'yiladigan qiymatlar
echo "GCP_WIF_PROVIDER=projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/providers/github-provider"
echo "GCP_SA_EMAIL=${SA_EMAIL}"
```

---

## 4. Workflow'lar

| Fayl | Maqsad | Qachon ishga tushadi |
| --- | --- | --- |
| `.github/workflows/ci.yml` | Build + lint + type-check + test | har push/PR'da |
| `.github/workflows/main.yml` | Production deploy | `main`ga push'da yoki qo'lda |
| `.github/workflows/rollback.yml` | Qo'lda rollback | qo'lda (`workflow_dispatch`) |
| `.github/workflows/healthcheck.yml` | Endpoint monitoring | har 5 daqiqada cron |

---

## 5. Foydali buyruqlar (serverda)

```bash
# Deploy (qo'lda)
cd /opt/marketplace && bash deploy/deploy.sh

# Rollback (1 commit orqaga)
bash deploy/rollback.sh

# Rollback (aniq commit'ga, CI uchun non-interactive)
YES=1 bash deploy/rollback.sh abc1234

# Health check
bash deploy/06-health-check.sh

# PM2
pm2 list
pm2 logs marketplace-api --lines 100
pm2 restart marketplace-api
pm2 reload ecosystem.config.cjs --update-env

# Nginx
nginx -t && systemctl reload nginx
tail -f /var/log/nginx/error.log

# SSL renewal test
certbot renew --dry-run
```

---

## 6. Troubleshooting

### Deploy xato — nima qilish

1. GitHub Actions log ko'rish: `Actions → Deploy to production (GCP)`
2. Serverda log: `tail -100 /opt/marketplace/logs/deploy-*.log`
3. Avtomatik rollback ishladi: `git log --oneline -5 /opt/marketplace`
4. Qo'lda rollback: `bash deploy/rollback.sh HEAD~1`

### Health check xato

1. PM2 jarayonlari ishlayaptimi: `pm2 list`
2. Backend logi: `pm2 logs marketplace-api --err --lines 200`
3. Nginx logi: `tail -100 /var/log/nginx/error.log`
4. DB ulanish: `sudo -u postgres psql -d marketplace -c '\dt'`

### SSL muddati tugayapti

Certbot avtomatik yangilaydi (systemd timer). Qo'lda:

```bash
certbot renew && systemctl reload nginx
```
