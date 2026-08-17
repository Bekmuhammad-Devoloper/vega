#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Watchdog — serverda har 1 daqiqada cron orqali ishga tushadi.
#
# Vazifasi:
#   1. Barcha 5 endpoint'ni tekshiradi (5xx yoki timeout = xato)
#   2. Ketma-ket 3 marta xato bo'lsa — mos PM2 jarayonini restart qiladi
#   3. Restart'dan keyin ham xato bo'lsa — Telegram'ga alert
#   4. PG va Nginx ishlamayotgan bo'lsa — restart qiladi
#   5. Disk > 90% bo'lsa — Telegram'ga ogohlantirish
#
# Holat /var/lib/marketplace-watchdog/ ichida saqlanadi.
# ═══════════════════════════════════════════════════════════════════
set -uo pipefail

STATE_DIR="/var/lib/marketplace-watchdog"
LOG_FILE="/var/log/marketplace-watchdog.log"
ENV_FILE="/etc/marketplace-watchdog.env"
FAIL_THRESHOLD=3

mkdir -p "${STATE_DIR}"
touch "${LOG_FILE}"

# Telegram credentials (alohida fayldan, /etc/ ichida)
if [ -f "${ENV_FILE}" ]; then
    # shellcheck disable=SC1090
    source "${ENV_FILE}"
fi
TG_TOKEN="${TELEGRAM_NOTIFY_TOKEN:-}"
TG_CHAT="${TELEGRAM_NOTIFY_CHAT_ID:-}"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "${LOG_FILE}"
}

notify() {
    local emoji="$1" title="$2" body="$3"
    log "${emoji} ${title}: ${body}"
    [ -z "${TG_TOKEN}" ] || [ -z "${TG_CHAT}" ] && return 0
    local message="${emoji} *${title}*%0A${body}%0A%0A_$(hostname) — $(date '+%H:%M:%S')_"
    curl -s -X POST "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
        -d "chat_id=${TG_CHAT}" \
        -d "parse_mode=Markdown" \
        -d "text=${message}" > /dev/null 2>&1 || true
}

# Bir endpoint tekshirish va kerak bo'lsa restart
check_endpoint() {
    local name="$1"      # Telegram'da ko'rinadigan nom
    local pm2_name="$2"  # PM2 jarayon nomi (restart uchun)
    local url="$3"
    local fail_file="${STATE_DIR}/${pm2_name}.fails"
    local alerted_file="${STATE_DIR}/${pm2_name}.alerted"

    local code
    code=$(curl -s -o /dev/null -m 10 -w "%{http_code}" "$url" 2>/dev/null || echo "000")

    if [[ "$code" =~ ^[23] ]]; then
        # Sog'lom — counter reset
        if [ -f "${fail_file}" ]; then
            rm -f "${fail_file}"
            if [ -f "${alerted_file}" ]; then
                notify "✅" "${name} TIKLANDI" "Endpoint qaytadan ishlayapti (HTTP ${code})"
                rm -f "${alerted_file}"
            fi
        fi
        return 0
    fi

    # Xato — counter oshiramiz
    local fails=1
    [ -f "${fail_file}" ] && fails=$(($(cat "${fail_file}") + 1))
    echo "${fails}" > "${fail_file}"
    log "✗ ${name} (${url}) → HTTP ${code} (xato ${fails}/${FAIL_THRESHOLD})"

    if [ "${fails}" -ge "${FAIL_THRESHOLD}" ]; then
        log "▶ ${name} ${fails} marta xato — PM2 restart"
        pm2 restart "${pm2_name}" --update-env >> "${LOG_FILE}" 2>&1 || true
        sleep 10

        # Restart'dan keyin qayta tekshirish
        code=$(curl -s -o /dev/null -m 10 -w "%{http_code}" "$url" 2>/dev/null || echo "000")
        if [[ "$code" =~ ^[23] ]]; then
            notify "🔄" "${name} avtomatik tiklandi" "PM2 restart muvaffaqiyatli (HTTP ${code})"
            rm -f "${fail_file}"
            rm -f "${alerted_file}"
        else
            # Hali ham xato — faqat birinchi marta alert
            if [ ! -f "${alerted_file}" ]; then
                notify "🚨" "${name} ISHLAMAYAPTI" "Restart yordam bermadi (HTTP ${code})%0AURL: ${url}"
                touch "${alerted_file}"
            fi
        fi
    fi
}

# ─── Endpoint'lar ────────────────────────────────────────────
check_endpoint "Landing"    "marketplace-landing"    "https://selliostore.uz/"
check_endpoint "Webapp"     "marketplace-webapp"     "https://clients.selliostore.uz/"
check_endpoint "Admin"      "marketplace-admin"      "https://admin.selliostore.uz/login"
check_endpoint "SuperAdmin" "marketplace-superadmin" "https://dev.selliostore.uz/login"
check_endpoint "API"        "marketplace-api"        "https://selliostore.uz/api/health"

# ─── Tizim servislari ────────────────────────────────────────
check_service() {
    local name="$1"
    if ! systemctl is-active --quiet "$name"; then
        log "✗ ${name} ishlamayapti — start qilamiz"
        systemctl start "$name" >> "${LOG_FILE}" 2>&1 || true
        sleep 3
        if systemctl is-active --quiet "$name"; then
            notify "🔄" "${name} qayta yoqildi" "Avtomatik start muvaffaqiyatli"
        else
            local alerted_file="${STATE_DIR}/${name}.alerted"
            if [ ! -f "${alerted_file}" ]; then
                notify "🚨" "${name} ISHLAMAYAPTI" "Start xato berdi — qo'lda tekshiring"
                touch "${alerted_file}"
            fi
        fi
    else
        rm -f "${STATE_DIR}/${name}.alerted"
    fi
}

check_service postgresql
check_service nginx

# ─── Disk monitoring ─────────────────────────────────────────
DISK_USE=$(df / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
DISK_ALERT_FILE="${STATE_DIR}/disk.alerted"
if [ "${DISK_USE}" -ge 90 ]; then
    if [ ! -f "${DISK_ALERT_FILE}" ]; then
        notify "💾" "Disk to'lib bormoqda" "Foydalanish: ${DISK_USE}%25%0Adf -h / | tail -1"
        touch "${DISK_ALERT_FILE}"
    fi
elif [ "${DISK_USE}" -lt 80 ] && [ -f "${DISK_ALERT_FILE}" ]; then
    notify "✅" "Disk normal holatga qaytdi" "Foydalanish: ${DISK_USE}%25"
    rm -f "${DISK_ALERT_FILE}"
fi

# ─── RAM monitoring ──────────────────────────────────────────
RAM_USE=$(free | awk '/Mem:/ {printf("%.0f", $3*100/$2)}')
RAM_ALERT_FILE="${STATE_DIR}/ram.alerted"
if [ "${RAM_USE}" -ge 90 ]; then
    if [ ! -f "${RAM_ALERT_FILE}" ]; then
        notify "🧠" "RAM to'lib bormoqda" "Foydalanish: ${RAM_USE}%25%0Atop -bn1 | head -10"
        touch "${RAM_ALERT_FILE}"
    fi
elif [ "${RAM_USE}" -lt 80 ] && [ -f "${RAM_ALERT_FILE}" ]; then
    rm -f "${RAM_ALERT_FILE}"
fi
