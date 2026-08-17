#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Atomik deploy skripti — git pull → build → migrate → PM2 reload
#
# Xususiyatlari:
#   - Hozirgi commit'ni saqlaydi (rollback uchun)
#   - Build muvaffaqiyatsiz bo'lsa avtomatik rollback
#   - Telegram'ga natija xabar yuboradi (agar TELEGRAM_NOTIFY_TOKEN bor bo'lsa)
#   - Health check bilan tekshiradi
#
# Foydalanish:
#   bash deploy/deploy.sh                # main branch'dan deploy
#   BRANCH=staging bash deploy/deploy.sh # boshqa branch
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

APP_DIR="/opt/marketplace"
BRANCH="${BRANCH:-main}"
START_TIME=$(date +%s)
LOG_FILE="/opt/marketplace/logs/deploy-$(date +%Y%m%d-%H%M%S).log"

cd "${APP_DIR}"
mkdir -p logs

# Telegram bildirishnoma yuborish (ixtiyoriy)
notify() {
    local emoji="$1"
    local title="$2"
    local body="$3"

    # Bildirishnomani logga yozish
    echo "${emoji} ${title}: ${body}" | tee -a "${LOG_FILE}"

    # Telegram (agar token bor bo'lsa)
    local token="${TELEGRAM_NOTIFY_TOKEN:-}"
    local chat_id="${TELEGRAM_NOTIFY_CHAT_ID:-}"
    if [ -n "${token}" ] && [ -n "${chat_id}" ]; then
        local message="${emoji} *${title}*%0A${body}"
        curl -s -X POST "https://api.telegram.org/bot${token}/sendMessage" \
            -d "chat_id=${chat_id}" \
            -d "parse_mode=Markdown" \
            -d "text=${message}" \
            > /dev/null || true
    fi
}

# Xato bo'lganda rollback
on_error() {
    local exit_code=$?
    if [ -n "${PREV_COMMIT:-}" ] && [ "$exit_code" -ne 0 ]; then
        echo ""
        echo "❌ XATO YUZ BERDI (exit ${exit_code}) — ROLLBACK..."
        git reset --hard "${PREV_COMMIT}"
        # Eski build bilan PM2'ni restart qilamiz (yangi build buzilgan bo'lishi mumkin)
        pm2 reload ecosystem.config.cjs 2>&1 | tail -5
        notify "❌" "Deploy MUVAFFAQIYATSIZ" "Rollback ${PREV_COMMIT:0:7} ga qilindi. Log: ${LOG_FILE}"
    fi
}
trap on_error ERR

echo "═══════════════════════════════════════════════════════════"
echo "  Atomik deploy boshlandi"
echo "  Branch: ${BRANCH}"
echo "  Vaqt:   $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════════════════"
{
    echo "Deploy started: $(date)"
    echo "Branch: ${BRANCH}"
} >> "${LOG_FILE}"

# ─── 1. Git pull ──────────────────────────────────────────
echo ""
echo "▶ [1/6] Git pull..."
PREV_COMMIT=$(git rev-parse HEAD)
echo "  Avvalgi: ${PREV_COMMIT:0:7}"
git fetch origin
git reset --hard "origin/${BRANCH}"
NEW_COMMIT=$(git rev-parse HEAD)
COMMIT_MSG=$(git log -1 --pretty=%s)
echo "  Yangi:   ${NEW_COMMIT:0:7} — ${COMMIT_MSG}"

if [ "${PREV_COMMIT}" = "${NEW_COMMIT}" ]; then
    echo "  ⚠ Hech narsa o'zgarmadi (skip qilamiz)"
    notify "ℹ️" "Deploy o'tkazib yuborildi" "Yangi commit yo'q: ${NEW_COMMIT:0:7}"
    exit 0
fi

# ─── 2. O'zgargan fayllar tahlili ──────────────────────────
echo ""
echo "▶ [2/6] O'zgargan komponentlar tahlili..."
CHANGED=$(git diff --name-only "${PREV_COMMIT}" "${NEW_COMMIT}")
DEPLOY_BACKEND=false
DEPLOY_WEBAPP=false
DEPLOY_ADMIN=false
DEPLOY_SUPERADMIN=false
DEPLOY_LANDING=false
DEPLOY_DB=false

echo "${CHANGED}" | grep -q "^backend/" && DEPLOY_BACKEND=true
echo "${CHANGED}" | grep -q "^webapp/" && DEPLOY_WEBAPP=true
echo "${CHANGED}" | grep -q "^admin/" && DEPLOY_ADMIN=true
echo "${CHANGED}" | grep -q "^superadmin/" && DEPLOY_SUPERADMIN=true
echo "${CHANGED}" | grep -q "^landing/" && DEPLOY_LANDING=true
echo "${CHANGED}" | grep -q "^backend/prisma/migrations/" && DEPLOY_DB=true

echo "  Backend:    ${DEPLOY_BACKEND}"
echo "  Webapp:     ${DEPLOY_WEBAPP}"
echo "  Admin:      ${DEPLOY_ADMIN}"
echo "  SuperAdmin: ${DEPLOY_SUPERADMIN}"
echo "  Landing:    ${DEPLOY_LANDING}"
echo "  DB migrate: ${DEPLOY_DB}"

# ─── 3. Build (parallel)─────────────────────────────────
echo ""
echo "▶ [3/6] Build (faqat o'zgargan qismlar)..."

build_app() {
    local name=$1
    local dir=$2
    local install_args=$3
    echo "  → ${name}..."
    cd "${APP_DIR}/${dir}"
    npm install ${install_args} --no-audit --no-fund 2>&1 | tail -2
    npm run build 2>&1 | tail -5
    cd "${APP_DIR}"
}

if [ "${DEPLOY_BACKEND}" = "true" ] || [ "${DEPLOY_DB}" = "true" ]; then
    cd "${APP_DIR}/backend"
    npm install --no-audit --no-fund 2>&1 | tail -2
    npx prisma generate 2>&1 | tail -2
    if [ "${DEPLOY_DB}" = "true" ]; then
        echo "  → DB migrate..."
        npx prisma migrate deploy 2>&1 | tail -5
    fi
    npm run build 2>&1 | tail -3
    cd "${APP_DIR}"
fi

[ "${DEPLOY_WEBAPP}" = "true" ] && build_app "webapp" "webapp" "--legacy-peer-deps"
[ "${DEPLOY_ADMIN}" = "true" ] && build_app "admin" "admin" "--legacy-peer-deps"
[ "${DEPLOY_SUPERADMIN}" = "true" ] && build_app "superadmin" "superadmin" "--legacy-peer-deps"
[ "${DEPLOY_LANDING}" = "true" ] && (cd "${APP_DIR}/landing" && npm install --no-audit --no-fund 2>&1 | tail -2)

# ─── 4. PM2 zero-downtime reload ──────────────────────────
echo ""
echo "▶ [4/6] PM2 reload (zero-downtime)..."

reload_app() {
    local name=$1
    pm2 reload "${name}" --update-env 2>&1 | tail -3
}

[ "${DEPLOY_BACKEND}" = "true" ] && reload_app marketplace-api
[ "${DEPLOY_WEBAPP}" = "true" ] && reload_app marketplace-webapp
[ "${DEPLOY_ADMIN}" = "true" ] && reload_app marketplace-admin
[ "${DEPLOY_SUPERADMIN}" = "true" ] && reload_app marketplace-superadmin
[ "${DEPLOY_LANDING}" = "true" ] && reload_app marketplace-landing

# ─── 5. Health check ──────────────────────────────────────
echo ""
echo "▶ [5/6] Health check (10s kutish)..."
sleep 10

HEALTH_OK=true
declare -A SERVICES=(
    [Landing]="https://selliostore.uz/"
    [Admin]="https://admin.selliostore.uz/login"
    [SuperAdmin]="https://dev.selliostore.uz/login"
    [Webapp]="https://clients.selliostore.uz/"
    [API]="https://selliostore.uz/api/health"
)

for name in "${!SERVICES[@]}"; do
    url="${SERVICES[$name]}"
    code=$(curl -s -o /dev/null -m 10 -w "%{http_code}" "$url" 2>/dev/null || echo "ERR")
    if [[ "$code" =~ ^[23] ]]; then
        echo "  ✓ ${name}: ${code}"
    else
        echo "  ✗ ${name}: ${code} — ${url}"
        HEALTH_OK=false
    fi
done

if [ "$HEALTH_OK" != "true" ]; then
    echo ""
    echo "❌ Health check muvaffaqiyatsiz — rollback boshlanmoqda"
    false
fi

# ─── 6. Yakuni ────────────────────────────────────────────
ELAPSED=$(($(date +%s) - START_TIME))
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ DEPLOY MUVAFFAQIYATLI"
echo "  Vaqt: ${ELAPSED} sek"
echo "  Commit: ${NEW_COMMIT:0:7} — ${COMMIT_MSG}"
echo "═══════════════════════════════════════════════════════════"

# Trap'ni o'chiramiz (muvaffaqiyatli tugadi)
trap - ERR

notify "✅" "Deploy MUVAFFAQIYATLI" "\`${NEW_COMMIT:0:7}\` — ${COMMIT_MSG}%0AVaqt: ${ELAPSED}s"
