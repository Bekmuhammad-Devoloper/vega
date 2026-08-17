#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Yangi Google Cloud server uchun BIR BUYRUQ orqali bootstrap.
#
# 00 → 06 bosqichlarini ketma-ket ishga tushiradi va xato bo'lsa to'xtaydi.
#
# Foydalanish (root sifatida, faqat YANGI serverda):
#   sudo bash deploy/bootstrap.sh
#
# Yoki tarmoqdan (repo hali clone qilinmagan):
#   curl -fsSL https://raw.githubusercontent.com/Ziyodillokh/marketplace/main/deploy/bootstrap.sh \
#     | sudo bash
#
# Avtomatik (interactive bo'lmagan) rejim:
#   sudo NON_INTERACTIVE=1 bash deploy/bootstrap.sh
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

APP_DIR="/opt/marketplace"
REPO_URL="${REPO_URL:-https://github.com/Ziyodillokh/marketplace.git}"
BRANCH="${BRANCH:-main}"
NON_INTERACTIVE="${NON_INTERACTIVE:-0}"

# Root tekshirish
if [ "$EUID" -ne 0 ]; then
    echo "❌ Root sifatida ishga tushiring: sudo bash $0"
    exit 1
fi

# Repo clone qilingan joydan bootstrap'ni ishga tushirish kerak —
# agar curl orqali ishlatilsa, oldin repo'ni clone qilamiz.
if [ ! -d "$(dirname "$0")/../deploy" ] || [ ! -f "$(dirname "$0")/00-server-bootstrap.sh" ]; then
    echo "▶ Repo topilmadi — ${APP_DIR} ga clone qilamiz..."
    apt-get update -qq && apt-get install -y -qq git
    mkdir -p "${APP_DIR}"
    if [ -d "${APP_DIR}/.git" ]; then
        cd "${APP_DIR}" && git fetch origin && git reset --hard "origin/${BRANCH}"
    else
        git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
    fi
    exec sudo bash "${APP_DIR}/deploy/bootstrap.sh" "$@"
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

step() {
    local n=$1
    local title=$2
    local script=$3
    echo ""
    echo "███████████████████████████████████████████████████████████████"
    echo "█  [${n}] ${title}"
    echo "███████████████████████████████████████████████████████████████"
    bash "${SCRIPT_DIR}/${script}"
}

confirm() {
    local prompt=$1
    if [ "${NON_INTERACTIVE}" = "1" ]; then
        return 0
    fi
    read -p "${prompt} [Y/n] " ans
    [[ ! "$ans" =~ ^[Nn] ]]
}

echo "═══════════════════════════════════════════════════════════"
echo "  YANGI GOOGLE SERVER BOOTSTRAP — selliostore.uz"
echo "  Repo:   ${REPO_URL}"
echo "  Branch: ${BRANCH}"
echo "  Dir:    ${APP_DIR}"
echo "  Non-interactive: ${NON_INTERACTIVE}"
echo "═══════════════════════════════════════════════════════════"

# ─── 1. System bootstrap (Node, Postgres, Nginx, PM2, UFW) ───
step "1/6" "Server bootstrap (Node + PG + Nginx + PM2 + UFW)" "00-server-bootstrap.sh"

# ─── 2. Repo clone/pull ──────────────────────────────────────
step "2/6" "Repo clone/pull" "01-clone-and-prepare.sh"

# ─── 3. .env yaratish (interactive bo'lmasa skip) ────────────
if [ -f "${APP_DIR}/backend/.env" ]; then
    echo ""
    echo "ℹ ${APP_DIR}/backend/.env allaqachon mavjud — env-setup skip"
elif [ "${NON_INTERACTIVE}" = "1" ]; then
    echo ""
    echo "⚠ NON_INTERACTIVE=1 — .env'ni qo'lda yarating va keyin qayta ishga tushiring:"
    echo "   sudo bash ${SCRIPT_DIR}/02-env-setup.sh"
    echo "   sudo bash ${SCRIPT_DIR}/bootstrap.sh"
    exit 0
else
    if confirm "▶ [3/6] Backend .env yaratamizmi?"; then
        step "3/6" "Backend .env yaratish" "02-env-setup.sh"
    fi
fi

# ─── 4. Install + build + migrate ────────────────────────────
step "4/6" "Install + Build + Migrate (5 app)" "03-install-build-migrate.sh"

# ─── 5. PM2 start ────────────────────────────────────────────
step "5/6" "PM2 start (5 ta jarayon)" "04-pm2-start.sh"

# PM2 reboot avtomatik start uchun
if confirm "▶ PM2 reboot'da avto-start sozlanmasinmi?"; then
    pm2 startup systemd -u "$(logname 2>/dev/null || echo root)" \
        --hp "$(getent passwd "$(logname 2>/dev/null || echo root)" | cut -d: -f6)" 2>&1 | tail -5 || true
    pm2 save 2>&1 | tail -2
fi

# ─── 6. Nginx + SSL ──────────────────────────────────────────
if confirm "▶ [6/7] Nginx + Let's Encrypt SSL sozlasinmi? (DNS yozuvlari to'g'rilanganmi?)"; then
    step "6/7" "Nginx + SSL (Let's Encrypt)" "05-nginx-and-ssl.sh"
fi

# ─── 7. 24/7 ishonchlilik qatlamlari ─────────────────────────
if confirm "▶ [7/7] 24/7 ishonchlilik (swap + fail2ban + watchdog + backup) sozlasinmi?"; then
    step "7/7" "24/7 Reliability (watchdog + backup + fail2ban)" "07-reliability.sh"
fi

# ─── Health check ────────────────────────────────────────────
echo ""
echo "███████████████████████████████████████████████████████████████"
echo "█  Yakuniy health check"
echo "███████████████████████████████████████████████████████████████"
bash "${SCRIPT_DIR}/06-health-check.sh" || true

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ BOOTSTRAP YAKUNLANDI"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Keyingi qadamlar:"
echo "  • GitHub Actions secret'larini sozlang (deploy/DEPLOY.md ko'ring)"
echo "  • Telegram webhook'ini ulang: backend dan post /api/telegram/webhook"
echo "  • pm2 logs marketplace-api"
echo "  • bash deploy/06-health-check.sh"
