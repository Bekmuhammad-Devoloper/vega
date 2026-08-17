#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# YANGI SERVER UCHUN BITTA SKRIPT — 0 dan production gacha.
# Ubuntu 22.04 LTS · root sifatida ishga tushiring.
#
# 1) Quyidagi CONFIG blokini to'ldiring (FILL_ME larni almashtiring)
# 2) Ishga tushiring:
#       sudo bash deploy/fresh-server.sh
#    yoki repo hali clone qilinmagan bo'lsa:
#       curl -fsSL https://raw.githubusercontent.com/Ziyodillokh/marketplace/main/deploy/fresh-server.sh -o fresh-server.sh
#       nano fresh-server.sh    # CONFIG ni to'ldiring
#       sudo bash fresh-server.sh
#
# Skript: tizim paketlari + PostgreSQL + Nginx + PM2 + .env + migrate +
# build (5 app) + pm2 start + (ixtiyoriy) SSL — hammasini qiladi.
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

# ╔═══════════════════════════════════════════════════════════════╗
# ║  CONFIG — SHU YERNI TO'LDIRING                                ║
# ║  (yoki environment orqali bering: TELEGRAM_BOT_TOKEN=... ...) ║
# ╚═══════════════════════════════════════════════════════════════╝
REPO_URL="${REPO_URL:-https://github.com/Ziyodillokh/marketplace.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="/opt/marketplace"

# ── Domenlar (DNS A-yozuvlari SHU server IP siga yo'naltirilgan bo'lsin) ──
ROOT_DOMAIN="${ROOT_DOMAIN:-selliostore.uz}"             # landing + /api
WEBAPP_DOMAIN="${WEBAPP_DOMAIN:-clients.selliostore.uz}" # mijoz do'koni
ADMIN_DOMAIN="${ADMIN_DOMAIN:-admin.selliostore.uz}"     # sotuvchi paneli
SUPERADMIN_DOMAIN="${SUPERADMIN_DOMAIN:-dev.selliostore.uz}"
LE_EMAIL="${LE_EMAIL:-bekmuhammad.devoloper@gmail.com}"  # Let's Encrypt

# ── Telegram (asosiy Sellio bot — BotFather /newbot) ──
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-FILL_ME}"
TELEGRAM_BOT_USERNAME="${TELEGRAM_BOT_USERNAME:-selliostorebot}"   # @ siz
TELEGRAM_ORDERS_CHANNEL_ID="${TELEGRAM_ORDERS_CHANNEL_ID:-FILL_ME}" # -100...
TELEGRAM_PAYMENTS_CHAT_ID="${TELEGRAM_PAYMENTS_CHAT_ID:-}"          # tarif cheki kanali (ixtiyoriy)
TELEGRAM_SUPPORT_CHAT_ID="${TELEGRAM_SUPPORT_CHAT_ID:-}"           # ixtiyoriy

# ── Seed adminlar (birinchi ishga tushishda yaratiladi) ──
ADMIN_SEED_EMAIL="${ADMIN_SEED_EMAIL:-admin@selliostore.uz}"
ADMIN_SEED_PASSWORD="${ADMIN_SEED_PASSWORD:-FILL_ME}"
SUPER_SEED_EMAIL="${SUPER_SEED_EMAIL:-owner@selliostore.uz}"
SUPER_SEED_PASSWORD="${SUPER_SEED_PASSWORD:-FILL_ME}"

# ── OpenAI (AI rasm yaxshilash / avto-to'ldirish) — ixtiyoriy ──
OPENAI_API_KEY="${OPENAI_API_KEY:-}"

# ── SSL: DNS tayyor bo'lsa 1, hali yo'naltirilmagan bo'lsa 0 ──
SETUP_SSL="${SETUP_SSL:-1}"

# ╔═══════════════════════════════════════════════════════════════╗
# ║  Bundan keyin tahrirlash shart emas                          ║
# ╚═══════════════════════════════════════════════════════════════╝

if [ "$EUID" -ne 0 ]; then
  echo "❌ Root sifatida ishga tushiring: sudo bash $0"; exit 1
fi

# ── Sirlar to'ldirilganini tekshirish ──
miss=0
for v in TELEGRAM_BOT_TOKEN TELEGRAM_ORDERS_CHANNEL_ID ADMIN_SEED_PASSWORD SUPER_SEED_PASSWORD; do
  if [ "${!v}" = "FILL_ME" ] || [ -z "${!v}" ]; then
    echo "❌ CONFIG to'ldirilmagan: $v"; miss=1
  fi
done
[ "$miss" = "1" ] && { echo ""; echo "Skript boshidagi CONFIG blokini to'ldiring."; exit 1; }

echo "═══════════════════════════════════════════════════════════"
echo "  YANGI SERVER DEPLOY — ${ROOT_DOMAIN}"
echo "  Repo: ${REPO_URL} (${BRANCH})"
echo "  SSL:  ${SETUP_SSL}"
echo "═══════════════════════════════════════════════════════════"

# ─── 1. Repo clone/pull ──────────────────────────────────────
echo "▶ [1/7] Repo tayyorlash..."
apt-get update -qq && apt-get install -y -qq git
mkdir -p "${APP_DIR}"
if [ -d "${APP_DIR}/.git" ]; then
  git -C "${APP_DIR}" fetch origin --quiet && git -C "${APP_DIR}" reset --hard "origin/${BRANCH}"
else
  git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
fi
cd "${APP_DIR}"

# ─── 2. Tizim bootstrap (Node + PG + Nginx + PM2 + UFW + DB) ──
echo "▶ [2/7] Tizim paketlari + PostgreSQL + Nginx + PM2..."
bash "${APP_DIR}/deploy/00-server-bootstrap.sh"

# ─── 3. backend/.env yozish (non-interaktiv) ─────────────────
echo "▶ [3/7] backend/.env yaratish..."
ENV_FILE="${APP_DIR}/backend/.env"
DB_PASS="$(cat /root/.marketplace-db-password)"
gen() { openssl rand -base64 48 | tr -d '/+=' | head -c 48; }

if [ -f "${ENV_FILE}" ]; then
  cp "${ENV_FILE}" "${ENV_FILE}.backup-$(date +%s)"
  echo "  ℹ Eski .env zaxiralandi"
fi

cat > "${ENV_FILE}" <<EOF
NODE_ENV=production
PORT=2400

DATABASE_URL=postgresql://marketplace:${DB_PASS}@127.0.0.1:5432/marketplace?schema=public
REDIS_URL=redis://127.0.0.1:6379

JWT_ACCESS_SECRET=$(gen)
JWT_REFRESH_SECRET=$(gen)
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d

SUPER_JWT_ACCESS_SECRET=$(gen)
SUPER_JWT_REFRESH_SECRET=$(gen)
SUPER_JWT_ACCESS_TTL=15m
SUPER_JWT_REFRESH_TTL=7d

# Telegram
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
TELEGRAM_BOT_USERNAME=${TELEGRAM_BOT_USERNAME}
TELEGRAM_ORDERS_CHANNEL_ID=${TELEGRAM_ORDERS_CHANNEL_ID}
TELEGRAM_PAYMENTS_CHAT_ID=${TELEGRAM_PAYMENTS_CHAT_ID}
TELEGRAM_SUPPORT_CHAT_ID=${TELEGRAM_SUPPORT_CHAT_ID}
TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 16)
TELEGRAM_USE_WEBHOOK=true

# Domenlar
APP_URL=https://${ROOT_DOMAIN}
WEBAPP_URL=https://${WEBAPP_DOMAIN}
ADMIN_URL=https://${ADMIN_DOMAIN}
SUPERADMIN_URL=https://${SUPERADMIN_DOMAIN}
LANDING_URL=https://${ROOT_DOMAIN}
# Bot /start shu URL ni ochadi — /register Telegram orqali avtomatik kiritadi
# (ro'yxatdan o'tgan bo'lsa panel, bo'lmasa onboarding). Login/parol EMAS.
ADMIN_PANEL_URL=https://${ADMIN_DOMAIN}/register

# Uploads
UPLOAD_DIR=/opt/marketplace/uploads
UPLOAD_MAX_SIZE_MB=10
PUBLIC_UPLOADS_URL=https://${ROOT_DOMAIN}/uploads

# AI (ixtiyoriy)
OPENAI_API_KEY=${OPENAI_API_KEY}

# Seed
ADMIN_SEED_EMAIL=${ADMIN_SEED_EMAIL}
ADMIN_SEED_PASSWORD=${ADMIN_SEED_PASSWORD}
ADMIN_SEED_FULLNAME=Sellio Admin
SUPER_SEED_EMAIL=${SUPER_SEED_EMAIL}
SUPER_SEED_PASSWORD=${SUPER_SEED_PASSWORD}
SUPER_SEED_FULLNAME=Sellio Owner
SUPER_SEED_DEMO=0

# Business
MIN_ORDER_AMOUNT=30000
DELIVERY_FEE=25000
FREE_DELIVERY_THRESHOLD=500000
DEFAULT_CURRENCY=UZS

# Analytics
EVENTS_RETENTION_DAYS=90
WEEKLY_AGGREGATION_CRON=0 3 * * 1
EOF
chmod 600 "${ENV_FILE}"
echo "  ✓ ${ENV_FILE} yozildi (600)"

# ─── 4. Install + build + migrate (5 app) ────────────────────
echo "▶ [4/7] Install + build + migrate (backend, webapp, admin, superadmin, landing)..."
bash "${APP_DIR}/deploy/03-install-build-migrate.sh"

# Build root sifatida ishlagani uchun .next/node_modules root'ники bo'ladi —
# egalikni chaqirgan foydalanuvchiga qaytaramiz (keyin sudo'siz build qilinadi).
DEPLOY_USER="${SUDO_USER:-}"
if [ -n "${DEPLOY_USER}" ] && [ "${DEPLOY_USER}" != "root" ]; then
  chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${APP_DIR}" 2>/dev/null || true
  chmod 600 "${ENV_FILE}" 2>/dev/null || true
fi

# ─── 5. PM2 start + boot avtostart ───────────────────────────
echo "▶ [5/7] PM2 start..."
# backend/.env root-only (600) — shuning uchun PM2 ham root sifatida ishlaydi
bash "${APP_DIR}/deploy/04-pm2-start.sh"
pm2 startup systemd -u root --hp /root 2>&1 | tail -3 || true
pm2 save 2>&1 | tail -2 || true

# ─── 6. Nginx + SSL ──────────────────────────────────────────
if [ "${SETUP_SSL}" = "1" ]; then
  echo "▶ [6/7] Nginx + Let's Encrypt SSL..."
  LE_EMAIL="${LE_EMAIL}" bash "${APP_DIR}/deploy/05-nginx-and-ssl.sh"
else
  echo "▶ [6/7] SSL o'tkazib yuborildi (SETUP_SSL=0). DNS tayyor bo'lgach:"
  echo "    LE_EMAIL=${LE_EMAIL} bash ${APP_DIR}/deploy/05-nginx-and-ssl.sh"
fi

# ─── 7. Health check ─────────────────────────────────────────
echo "▶ [7/7] Health check..."
bash "${APP_DIR}/deploy/06-health-check.sh" || true

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ DEPLOY YAKUNLANDI — ${ROOT_DOMAIN}"
echo "═══════════════════════════════════════════════════════════"
echo "  pm2 list"
echo "  pm2 logs marketplace-api --lines 100"
echo ""
echo "  Telegram webhook: bot startda avtomatik o'rnatiladi (TELEGRAM_USE_WEBHOOK=true)."
echo "  Tekshirish: pm2 logs marketplace-api | grep -i webhook"
echo ""
echo "  ⚠ Eski serverdan ko'chsangiz — PostgreSQL bazani dump/restore qiling:"
echo "     (eski) pg_dump -Fc marketplace > db.dump"
echo "     (yangi) pg_restore -d marketplace --clean --no-owner db.dump"
echo "     so'ng: cd backend && npx prisma migrate deploy && pm2 reload all"
