#!/usr/bin/env bash
# Backend .env faylini yaratadi (production)
set -euo pipefail

APP_DIR="/opt/marketplace"
ENV_FILE="${APP_DIR}/backend/.env"
DB_PASS_FILE="/root/.marketplace-db-password"

echo "═══════════════════════════════════════════════════════════"
echo "  Backend .env tayyorlash"
echo "═══════════════════════════════════════════════════════════"

if [ -f "${ENV_FILE}" ]; then
    echo "⚠ ${ENV_FILE} allaqachon bor"
    echo "  Almashtirasizmi? [y/N]"
    read -r answer
    if [[ ! "$answer" =~ ^[Yy] ]]; then
        echo "✗ Bekor qilindi"
        exit 0
    fi
    cp "${ENV_FILE}" "${ENV_FILE}.backup-$(date +%s)"
fi

# DB parolni o'qish (bootstrap'da yaratilgan)
if [ -f "${DB_PASS_FILE}" ]; then
    DB_PASS=$(cat "${DB_PASS_FILE}")
else
    echo "⚠ ${DB_PASS_FILE} topilmadi"
    echo "  Postgres parolini kiriting:"
    read -rs DB_PASS
fi

# Random secret'lar
JWT_ACCESS=$(openssl rand -base64 48 | tr -d '/+=' | head -c 48)
JWT_REFRESH=$(openssl rand -base64 48 | tr -d '/+=' | head -c 48)
SUPER_JWT_ACCESS=$(openssl rand -base64 48 | tr -d '/+=' | head -c 48)
SUPER_JWT_REFRESH=$(openssl rand -base64 48 | tr -d '/+=' | head -c 48)
WEBHOOK_SECRET=$(openssl rand -hex 16)

# Telegram bot ma'lumotlari (interaktiv)
echo ""
echo "▶ Telegram bot ma'lumotlari (BotFather'dan oling)"
read -p "  TELEGRAM_BOT_TOKEN: " BOT_TOKEN
read -p "  TELEGRAM_BOT_USERNAME (без @): " BOT_USERNAME
read -p "  TELEGRAM_ORDERS_CHANNEL_ID (manfiy raqam, masalan -100...): " CHANNEL_ID

echo ""
echo "▶ Admin va Super Admin parollari"
read -p "  ADMIN_SEED_EMAIL [admin@selliostore.uz]: " ADMIN_EMAIL
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@selliostore.uz}
read -p "  ADMIN_SEED_PASSWORD: " -s ADMIN_PASS
echo ""
read -p "  SUPER_SEED_EMAIL [owner@selliostore.uz]: " SUPER_EMAIL
SUPER_EMAIL=${SUPER_EMAIL:-owner@selliostore.uz}
read -p "  SUPER_SEED_PASSWORD: " -s SUPER_PASS
echo ""

cat > "${ENV_FILE}" <<EOF
NODE_ENV=production
PORT=2400

# Postgres
DATABASE_URL=postgresql://marketplace:${DB_PASS}@127.0.0.1:5432/marketplace?schema=public

# Redis (optional)
REDIS_URL=redis://127.0.0.1:6379

# Admin JWT
JWT_ACCESS_SECRET=${JWT_ACCESS}
JWT_REFRESH_SECRET=${JWT_REFRESH}
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d

# Super Admin JWT
SUPER_JWT_ACCESS_SECRET=${SUPER_JWT_ACCESS}
SUPER_JWT_REFRESH_SECRET=${SUPER_JWT_REFRESH}
SUPER_JWT_ACCESS_TTL=15m
SUPER_JWT_REFRESH_TTL=7d

# Telegram
TELEGRAM_BOT_TOKEN=${BOT_TOKEN}
TELEGRAM_BOT_USERNAME=${BOT_USERNAME}
TELEGRAM_ORDERS_CHANNEL_ID=${CHANNEL_ID}
TELEGRAM_WEBHOOK_SECRET=${WEBHOOK_SECRET}
TELEGRAM_USE_WEBHOOK=true

# Uploads
UPLOAD_DIR=/opt/marketplace/uploads
UPLOAD_MAX_SIZE_MB=10
PUBLIC_UPLOADS_URL=https://selliostore.uz/uploads

# Admin seed
ADMIN_SEED_EMAIL=${ADMIN_EMAIL}
ADMIN_SEED_PASSWORD=${ADMIN_PASS}
ADMIN_SEED_FULLNAME=Sellio Admin

# Super Admin seed
SUPER_SEED_EMAIL=${SUPER_EMAIL}
SUPER_SEED_PASSWORD=${SUPER_PASS}
SUPER_SEED_FULLNAME=Sellio Owner
SUPER_SEED_DEMO=0

# Domenlar
APP_URL=https://selliostore.uz
WEBAPP_URL=https://clients.selliostore.uz
ADMIN_URL=https://admin.selliostore.uz
SUPERADMIN_URL=https://dev.selliostore.uz
LANDING_URL=https://selliostore.uz

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
echo ""
echo "✓ ${ENV_FILE} yaratildi (permissions: 600)"
echo "  $(wc -l < ${ENV_FILE}) qator"
