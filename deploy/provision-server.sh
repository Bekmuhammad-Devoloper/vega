#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# YANGI SERVERNI NOLDAN TAYYORLASH (Ubuntu 22.04/24.04, root).
#   bash provision-server.sh
#
# O'rnatadi: Node 20, pm2, Docker, Postgres+Redis (konteyner), nginx, certbot
# Repo'ni /opt/vega/app ga klonlaydi va .env shablonini yaratadi.
# Idempotent — qayta ishga tushirish xavfsiz.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

REPO="${REPO:-https://github.com/Bekmuhammad-Devoloper/vega.git}"
BRANCH="${BRANCH:-saas}"
BASE="${BASE:-/opt/vega}"
APP="$BASE/app"
PG_PORT="${PG_PORT:-5433}"
REDIS_PORT="${REDIS_PORT:-6399}"
PG_PASS="${PG_PASS:-}"

log() { echo; echo "══> $*"; }
[ "$(id -u)" = "0" ] || { echo "root kerak (sudo -i)"; exit 1; }

log "1/7 Tizim paketlari"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git nginx certbot python3-certbot-nginx ca-certificates gnupg ufw >/dev/null

log "2/7 Node 20 + pm2"
if ! command -v node >/dev/null || [ "$(node -v | cut -c2-3)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
command -v pm2 >/dev/null || npm i -g pm2 >/dev/null
node -v; pm2 -v

log "3/7 Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh >/dev/null
fi
systemctl enable --now docker >/dev/null 2>&1 || true

log "4/7 Postgres + Redis konteynerlari"
if [ -z "$PG_PASS" ]; then
  if [ -f "$BASE/.pgpass" ]; then PG_PASS=$(cat "$BASE/.pgpass")
  else PG_PASS=$(openssl rand -hex 24); mkdir -p "$BASE"; printf '%s' "$PG_PASS" > "$BASE/.pgpass"; chmod 600 "$BASE/.pgpass"; fi
fi
docker ps -a --format '{{.Names}}' | grep -qx vega-postgres || \
  docker run -d --name vega-postgres --restart unless-stopped \
    -e POSTGRES_USER=vega -e POSTGRES_PASSWORD="$PG_PASS" -e POSTGRES_DB=vega \
    -p 127.0.0.1:$PG_PORT:5432 -v vega_pgdata:/var/lib/postgresql/data postgres:16-alpine
docker ps -a --format '{{.Names}}' | grep -qx vega-redis || \
  docker run -d --name vega-redis --restart unless-stopped \
    -p 127.0.0.1:$REDIS_PORT:6379 redis:7-alpine
docker start vega-postgres vega-redis >/dev/null 2>&1 || true
sleep 4; docker ps --filter name=vega- --format '  {{.Names}}  {{.Status}}'

log "5/7 Repo: $APP"
mkdir -p "$BASE"
if [ -d "$APP/.git" ]; then
  git -C "$APP" fetch --depth=1 origin "$BRANCH" && git -C "$APP" reset --hard "origin/$BRANCH"
else
  git clone --depth=1 -b "$BRANCH" "$REPO" "$APP"
fi
cp "$APP/deploy/deploy.sh" "$BASE/deploy.sh" && chmod +x "$BASE/deploy.sh"

log "6/7 .env shabloni"
ENVF="$APP/backend/.env"
if [ -f "$ENVF" ]; then
  echo "  .env allaqachon bor — tegilmadi"
else
  cat > "$ENVF" <<ENV
NODE_ENV=production
PORT=2400
DATABASE_URL=postgresql://vega:$PG_PASS@127.0.0.1:$PG_PORT/vega
REDIS_URL=redis://127.0.0.1:$REDIS_PORT

JWT_ACCESS_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
SUPER_JWT_ACCESS_SECRET=$(openssl rand -hex 32)
SUPER_JWT_REFRESH_SECRET=$(openssl rand -hex 32)

# ↓↓↓ QO'LDA TO'LDIRING ↓↓↓
TELEGRAM_BOT_TOKEN=
SPIDER_API_KEY=
SPIDER_BASE_URL=https://api.spider-service.com
HEROSMS_API_KEY=
ISTAR_API_KEY=
ISTAR_BASE_URL=https://v1.fragmentapi.com/api/v1/partner
ISTAR_WALLET=TON

USD_TO_UZS=12000
MARKUP_PERCENT=15
ENV
  chmod 600 "$ENVF"
  echo "  yaratildi: $ENVF  (kalitlarni to'ldiring!)"
fi

log "7/7 Deploy uchun SSH kaliti"
if [ ! -f "$BASE/gh-deploy-key" ]; then
  ssh-keygen -t ed25519 -N "" -C "github-actions-vega" -f "$BASE/gh-deploy-key" >/dev/null
  cat "$BASE/gh-deploy-key.pub" >> ~/.ssh/authorized_keys
  chmod 600 ~/.ssh/authorized_keys
fi

echo
echo "════════════════════════════════════════════════════════"
echo "✅ Server tayyor."
echo
echo "1) Kalitlarni to'ldiring:   nano $ENVF"
echo "2) Ma'lumot ko'chirish:     bash $APP/deploy/migrate-data.sh restore /tmp/<dump>"
echo "   (yoki toza boshlash:     cd $APP/backend && npx prisma db push && npx prisma db seed)"
echo "3) Birinchi ishga tushirish:"
echo "     cd $APP/backend && npm ci && npx prisma generate && npx nest build"
echo "     pm2 start dist/src/main.js --name vega-backend --update-env"
echo "     pm2 save && pm2 startup"
echo
echo "4) GitHub Secrets (Settings -> Secrets -> Actions):"
echo "     SSH_HOST = $(hostname -I | awk '{print $1}')"
echo "     SSH_USER = root"
echo "     SSH_KEY  = ↓ quyidagi MAXFIY kalit ↓"
echo "════════════════════════════════════════════════════════"
cat "$BASE/gh-deploy-key"
echo "════════════════════════════════════════════════════════"
