# GCP infratuzilma — 24/7 ishonchli ishlash

Bu sozlamalar **server tashqarisida** (GCP Console'da) qilinishi kerak.

---

## 1. GCP disk snapshot policy (kunlik avtomatik)

Server diskini har kuni avtomatik snapshot qilish. Halokat bo'lsa, butun serverni 1 daqiqada tiklash mumkin.

```bash
# Snapshot policy yaratish — har kuni 02:30 UTC, 14 kun saqlash
gcloud compute resource-policies create snapshot-schedule marketplace-daily \
  --description="Marketplace VM daily snapshot" \
  --max-retention-days=14 \
  --on-source-disk-delete=keep-auto-snapshots \
  --daily-schedule \
  --start-time=02:30 \
  --region=europe-west3 \
  --storage-location=eu

# VM diskiga ulash
DISK_NAME=$(gcloud compute instances describe yuksalish-server \
  --zone=europe-west3-a \
  --format='value(disks[0].source.basename())')

gcloud compute disks add-resource-policies "${DISK_NAME}" \
  --zone=europe-west3-a \
  --resource-policies=marketplace-daily
```

**Halokat'da tiklash:**
```bash
# 1. Eski VM'ni o'chirish (zarurat'da)
gcloud compute instances delete yuksalish-server --zone=europe-west3-a

# 2. Eng oxirgi snapshot'dan disk yaratish
gcloud compute disks create yuksalish-server-restored \
  --source-snapshot=<snapshot-name> \
  --zone=europe-west3-a

# 3. Yangi VM yaratish shu diskdan
gcloud compute instances create yuksalish-server \
  --zone=europe-west3-a \
  --machine-type=e2-standard-2 \
  --disk=name=yuksalish-server-restored,boot=yes
```

---

## 2. GCS bucket — PostgreSQL backup'larini saqlash

Server o'chsa ham, backup'lar bulutda saqlansin:

```bash
PROJECT_ID=$(gcloud config get-value project)
BUCKET="${PROJECT_ID}-marketplace-backups"

# Bucket yaratish (Europe, multi-region, IA storage)
gcloud storage buckets create gs://${BUCKET} \
  --location=europe-west3 \
  --default-storage-class=NEARLINE \
  --uniform-bucket-level-access

# Lifecycle: 90 kundan keyin Coldline, 365 kundan keyin o'chirish
cat > /tmp/lifecycle.json <<EOF
{
  "lifecycle": {
    "rule": [
      {"action": {"type": "SetStorageClass", "storageClass": "COLDLINE"},
       "condition": {"age": 90}},
      {"action": {"type": "Delete"},
       "condition": {"age": 365}}
    ]
  }
}
EOF
gcloud storage buckets update gs://${BUCKET} --lifecycle-file=/tmp/lifecycle.json

# Server'dan yozish uchun service account ruxsati
SA_EMAIL="github-deployer@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud storage buckets add-iam-policy-binding gs://${BUCKET} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.objectCreator"
```

**Server'da** `/etc/marketplace-watchdog.env` ga qo'shing:
```bash
GCS_BACKUP_BUCKET=your-project-id-marketplace-backups
```

`backup.sh` avtomatik upload qiladi.

---

## 3. GCP Uptime Check (tashqi monitoring)

GitHub Actions cron 5 daqiqada ishlaydi, lekin GCP uptime check har 1 daqiqada ishlatib ko'p geografik nuqtalardan tekshiradi.

```bash
gcloud monitoring uptime create marketplace-https \
  --resource-type=uptime-url \
  --resource-labels=host=selliostore.uz \
  --protocol=https \
  --path=/ \
  --period=60s \
  --timeout=10s \
  --regions=europe,usa
```

Yoki **GCP Console** → Monitoring → Uptime checks → Create:
- 5 ta endpoint uchun 5 ta uptime check yarating
- Alerting policy: 2 marta ketma-ket xato → email + SMS

---

## 4. Cloud Monitoring alert (ixtiyoriy)

```bash
# Alert kanali (email)
gcloud alpha monitoring channels create \
  --display-name="Marketplace Alerts" \
  --type=email \
  --channel-labels=email_address=admin@selliostore.uz
```

Keyin Console'da:
- CPU > 80% (5 daqiqa)
- Memory > 90% (5 daqiqa)
- Disk > 85%
- HTTP error rate > 5%

---

## 5. VM auto-restart (panic'da)

Compute Engine'da VM'ning **automaticRestart** sozlamasi yoqilgan bo'lishi kerak (default yoqilgan). Tekshirish:

```bash
gcloud compute instances describe yuksalish-server \
  --zone=europe-west3-a \
  --format='value(scheduling.automaticRestart)'
# Natija: True bo'lishi kerak
```

Agar False bo'lsa:
```bash
gcloud compute instances set-scheduling yuksalish-server \
  --zone=europe-west3-a \
  --restart-on-failure
```

---

## 6. Static IP (External IP doim bir xil bo'lsin)

Hozirgi External IP **ephemeral** (vaqtinchalik). VM restart bo'lsa IP o'zgarishi mumkin. Static qilish:

```bash
# Hozirgi IP'ni reserve qilish
gcloud compute addresses create yuksalish-static \
  --region=europe-west3 \
  --addresses=$(gcloud compute instances describe yuksalish-server \
    --zone=europe-west3-a \
    --format='value(networkInterfaces[0].accessConfigs[0].natIP)')
```

⚠️ Static IP **bepul emas** (oyiga ~$3) lekin DNS uchun shart.

---

## 7. Tezkor checklist

| Sozlama | Qayerda | Qachon |
| --- | --- | --- |
| Snapshot policy | GCP | Bir marta |
| GCS backup bucket | GCP | Bir marta |
| Uptime check | GCP Monitoring | Bir marta |
| Static IP | GCP Network | Bir marta |
| `automaticRestart` | VM scheduling | Tekshirish |
| Watchdog cron | Server | `07-reliability.sh` |
| DB backup cron | Server | `07-reliability.sh` |
| Fail2ban | Server | `07-reliability.sh` |
| Unattended-upgrades | Server | `07-reliability.sh` |
| Swap fayl | Server | `07-reliability.sh` |

---

## SLA hisoboti

Yuqoridagi sozlamalar bilan **realistik SLA**:

- **Uptime:** 99.5% (oyiga ~3.6 soat downtime budget)
- **RPO** (data loss tolerance): 24 soat (kunlik backup)
- **RTO** (recovery time): 5-15 daqiqa (snapshot'dan tiklash)
- **MTTR** (oddiy xato'dan tiklash): 1-2 daqiqa (watchdog auto-restart)

99.9%+ uchun kerak:
- Multi-region setup (Load Balancer + 2 ta VM)
- Managed PostgreSQL (Cloud SQL)
- CDN (Cloud CDN yoki Cloudflare)
- Bu hozirgi 1 ta VM setup'dan 5-10 baravar qimmat
