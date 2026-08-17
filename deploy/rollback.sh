#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Manual rollback — oldingi commit'ga qaytarish
#
# Foydalanish:
#   bash deploy/rollback.sh                # 1 commit orqaga (so'raydi)
#   bash deploy/rollback.sh HEAD~3         # 3 commit orqaga
#   bash deploy/rollback.sh abc1234        # aniq commit'ga
#   YES=1 bash deploy/rollback.sh abc1234  # so'ramasdan (CI uchun)
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

APP_DIR="/opt/marketplace"
TARGET="${1:-HEAD~1}"
YES="${YES:-0}"
START_TIME=$(date +%s)

cd "${APP_DIR}"

CURRENT=$(git rev-parse HEAD)
TARGET_HASH=$(git rev-parse "${TARGET}")

echo "═══════════════════════════════════════════════════════════"
echo "  Rollback"
echo "  Hozirgi: ${CURRENT:0:7} — $(git log -1 --pretty=%s)"
echo "  Maqsad:  ${TARGET_HASH:0:7} — $(git log -1 --pretty=%s "${TARGET_HASH}")"
echo "═══════════════════════════════════════════════════════════"

if [ "${CURRENT}" = "${TARGET_HASH}" ]; then
    echo "ℹ Allaqachon shu commit'da — hech narsa qilinmaydi"
    exit 0
fi

if [ "${YES}" != "1" ]; then
    read -p "Davom etasizmi? [y/N] " answer
    [[ "${answer}" =~ ^[Yy] ]] || { echo "✗ Bekor qilindi"; exit 0; }
fi

# Telegram bildirishnoma
notify() {
    local emoji="$1" title="$2" body="$3"
    local token="${TELEGRAM_NOTIFY_TOKEN:-}"
    local chat_id="${TELEGRAM_NOTIFY_CHAT_ID:-}"
    [ -z "${token}" ] || [ -z "${chat_id}" ] && return 0
    local message="${emoji} *${title}*%0A${body}"
    curl -s -X POST "https://api.telegram.org/bot${token}/sendMessage" \
        -d "chat_id=${chat_id}" \
        -d "parse_mode=Markdown" \
        -d "text=${message}" > /dev/null || true
}

echo ""
echo "▶ [1/4] Git reset → ${TARGET_HASH:0:7}"
git reset --hard "${TARGET_HASH}"

echo ""
echo "▶ [2/4] Backend re-build + prisma generate"
cd "${APP_DIR}/backend"
npm install --no-audit --no-fund 2>&1 | tail -2
npx prisma generate 2>&1 | tail -2
npm run build 2>&1 | tail -3

echo ""
echo "▶ [3/4] Frontend re-build (webapp, admin, superadmin)"
for app in webapp admin superadmin; do
    echo "  → ${app}..."
    cd "${APP_DIR}/${app}"
    npm install --legacy-peer-deps --no-audit --no-fund 2>&1 | tail -2
    npm run build 2>&1 | tail -3
done

if [ -d "${APP_DIR}/landing" ]; then
    cd "${APP_DIR}/landing"
    npm install --no-audit --no-fund 2>&1 | tail -2
fi

echo ""
echo "▶ [4/4] PM2 reload (zero-downtime)"
cd "${APP_DIR}"
pm2 reload ecosystem.config.cjs --update-env 2>&1 | tail -10

# Health check
echo ""
echo "▶ Health check (10s kutish)..."
sleep 10
HEALTH_OK=true
for url in \
    "https://selliostore.uz/" \
    "https://admin.selliostore.uz/login" \
    "https://clients.selliostore.uz/" \
    "https://dev.selliostore.uz/login" \
    "https://selliostore.uz/api/health"
do
    code=$(curl -s -o /dev/null -m 10 -w "%{http_code}" "$url" 2>/dev/null || echo "ERR")
    if [[ "$code" =~ ^[23] ]]; then
        echo "  ✓ ${url} → ${code}"
    else
        echo "  ✗ ${url} → ${code}"
        HEALTH_OK=false
    fi
done

ELAPSED=$(($(date +%s) - START_TIME))
echo ""
if [ "$HEALTH_OK" = "true" ]; then
    echo "═══════════════════════════════════════════════════════════"
    echo "  ✅ Rollback ${TARGET_HASH:0:7} ga muvaffaqiyatli (${ELAPSED}s)"
    echo "═══════════════════════════════════════════════════════════"
    notify "↩️" "Rollback MUVAFFAQIYATLI" "\`${CURRENT:0:7}\` → \`${TARGET_HASH:0:7}\`%0AVaqt: ${ELAPSED}s"
else
    echo "═══════════════════════════════════════════════════════════"
    echo "  ⚠ Rollback bajarildi, lekin health check'da xato bor!"
    echo "═══════════════════════════════════════════════════════════"
    notify "⚠️" "Rollback (health check FAIL)" "\`${CURRENT:0:7}\` → \`${TARGET_HASH:0:7}\`"
    exit 2
fi
