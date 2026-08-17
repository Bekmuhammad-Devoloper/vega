#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# PostgreSQL kunlik backup — cron orqali har kuni 03:00 da ishlaydi.
#
# Saqlash siyosati:
#   - Oxirgi 7 ta kunlik backup
#   - Oxirgi 4 ta haftalik (yakshanba) backup
#   - Oxirgi 6 ta oylik backup (oyning birinchi yakshanbasi)
#
# Backup'lar /opt/marketplace/backups/ ichida saqlanadi.
# Agar GCS_BACKUP_BUCKET env'i bor bo'lsa, GCS'ga ham yuklaydi.
# ═══════════════════════════════════════════════════════════════════
set -uo pipefail

BACKUP_DIR="/opt/marketplace/backups"
DB_NAME="${DB_NAME:-marketplace}"
DB_USER="${DB_USER:-marketplace}"
ENV_FILE="/etc/marketplace-watchdog.env"
LOG_FILE="/var/log/marketplace-backup.log"

mkdir -p "${BACKUP_DIR}/daily" "${BACKUP_DIR}/weekly" "${BACKUP_DIR}/monthly"

# Telegram credentials
if [ -f "${ENV_FILE}" ]; then
    # shellcheck disable=SC1090
    source "${ENV_FILE}"
fi
TG_TOKEN="${TELEGRAM_NOTIFY_TOKEN:-}"
TG_CHAT="${TELEGRAM_NOTIFY_CHAT_ID:-}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_FILE}"; }

notify() {
    local emoji="$1" title="$2" body="$3"
    [ -z "${TG_TOKEN}" ] || [ -z "${TG_CHAT}" ] && return 0
    local message="${emoji} *${title}*%0A${body}"
    curl -s -X POST "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
        -d "chat_id=${TG_CHAT}" \
        -d "parse_mode=Markdown" \
        -d "text=${message}" > /dev/null 2>&1 || true
}

DATE=$(date +%Y-%m-%d)
DAY_OF_WEEK=$(date +%u)   # 1=Mon...7=Sun
DAY_OF_MONTH=$(date +%d)
START_TIME=$(date +%s)

DAILY_FILE="${BACKUP_DIR}/daily/db-${DATE}.sql.gz"

log "▶ Backup boshlandi: ${DB_NAME}"

# ─── 1. pg_dump ──────────────────────────────────────────────
if ! sudo -u postgres pg_dump --no-owner --no-privileges --format=plain "${DB_NAME}" \
    | gzip -9 > "${DAILY_FILE}.tmp"
then
    log "✗ pg_dump XATO"
    notify "🚨" "Backup XATO" "pg_dump muvaffaqiyatsiz tugadi — log: ${LOG_FILE}"
    rm -f "${DAILY_FILE}.tmp"
    exit 1
fi
mv "${DAILY_FILE}.tmp" "${DAILY_FILE}"

SIZE=$(du -h "${DAILY_FILE}" | cut -f1)
log "✓ Daily backup: ${DAILY_FILE} (${SIZE})"

# ─── 2. Hafta/oy backup nusxalari ────────────────────────────
if [ "${DAY_OF_WEEK}" = "7" ]; then
    cp "${DAILY_FILE}" "${BACKUP_DIR}/weekly/db-${DATE}.sql.gz"
    log "✓ Weekly backup nusxalandi"

    # Oyning birinchi yakshanbasi → monthly
    if [ "${DAY_OF_MONTH}" -le 7 ]; then
        cp "${DAILY_FILE}" "${BACKUP_DIR}/monthly/db-${DATE}.sql.gz"
        log "✓ Monthly backup nusxalandi"
    fi
fi

# ─── 3. Retention (eski backup'larni o'chirish) ──────────────
# Daily: oxirgi 7 ta
find "${BACKUP_DIR}/daily" -name "db-*.sql.gz" -type f | sort -r | tail -n +8 | xargs -r rm -f
# Weekly: oxirgi 4 ta
find "${BACKUP_DIR}/weekly" -name "db-*.sql.gz" -type f | sort -r | tail -n +5 | xargs -r rm -f
# Monthly: oxirgi 6 ta
find "${BACKUP_DIR}/monthly" -name "db-*.sql.gz" -type f | sort -r | tail -n +7 | xargs -r rm -f

# ─── 4. GCS upload (ixtiyoriy) ───────────────────────────────
if [ -n "${GCS_BACKUP_BUCKET:-}" ] && command -v gsutil >/dev/null 2>&1; then
    if gsutil -q cp "${DAILY_FILE}" "gs://${GCS_BACKUP_BUCKET}/db/$(date +%Y/%m)/"; then
        log "✓ GCS upload: gs://${GCS_BACKUP_BUCKET}/db/$(date +%Y/%m)/"
    else
        log "⚠ GCS upload xato"
    fi
fi

# ─── 5. Uploads papka backup (haftada bir marta) ─────────────
if [ "${DAY_OF_WEEK}" = "7" ] && [ -d "/opt/marketplace/uploads" ]; then
    UPLOADS_FILE="${BACKUP_DIR}/weekly/uploads-${DATE}.tar.gz"
    tar -czf "${UPLOADS_FILE}" -C /opt/marketplace uploads/ 2>/dev/null || true
    log "✓ Uploads backup: $(du -h "${UPLOADS_FILE}" 2>/dev/null | cut -f1)"
    find "${BACKUP_DIR}/weekly" -name "uploads-*.tar.gz" -type f | sort -r | tail -n +5 | xargs -r rm -f
fi

# ─── Yakuni ──────────────────────────────────────────────────
ELAPSED=$(($(date +%s) - START_TIME))
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)
log "✅ Backup tugadi (${ELAPSED}s, jami: ${TOTAL_SIZE})"

# Faqat haftada bir marta xabar yuborish (juda ko'p bo'lmasin)
if [ "${DAY_OF_WEEK}" = "1" ]; then
    notify "💾" "Haftalik backup hisoboti" "Bugungi: ${SIZE}%0AJami saqlangan: ${TOTAL_SIZE}%0AVaqt: ${ELAPSED}s"
fi
