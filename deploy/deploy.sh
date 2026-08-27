#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# SERVERDA turadi: /opt/vega/deploy.sh
# GitHub Actions shuni chaqiradi:  bash /opt/vega/deploy.sh saas
#
# Repo PUBLIC — server to'g'ridan-to'g'ri GitHub'dan tortadi, kalit kerak emas.
# .env, node_modules, uploads kuzatilmagan -> git tegmaydi.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

BRANCH="${1:-saas}"
APP_DIR="${APP_DIR:-/opt/vega/app}"
SKIP_FRONTEND="${SKIP_FRONTEND:-1}"
PM2_API="${PM2_API:-vega-backend}"

log() { echo "──> $*"; }

cd "$APP_DIR"

log "Kod tortilmoqda ($BRANCH)"
git fetch --depth=1 origin "$BRANCH"
OLD_SHA=$(git rev-parse HEAD 2>/dev/null || echo "yo'q")
git reset --hard "origin/$BRANCH"
NEW_SHA=$(git rev-parse --short HEAD)
log "  $OLD_SHA -> $NEW_SHA"

cd "$APP_DIR/backend"

log "Bog'liqliklar"
# DIQQAT: --omit=dev ISHLATMANG. prisma, @nestjs/cli, typescript va hatto
# @prisma/client ham devDependencies'da — ularsiz `npx prisma` internetdan
# eng yangi (mos kelmaydigan) versiyani tortadi va build yiqiladi.
npm ci --no-audit --no-fund

log "Prisma"
# npx emas, lokal binar — versiya qat'iy package.json dan olinsin.
./node_modules/.bin/prisma generate
# Migratsiya fayllari bo'lsa qo'llanadi; bo'lmasa sxema push qilinadi.
if [ -d prisma/migrations ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  ./node_modules/.bin/prisma migrate deploy
else
  echo "    migrations papkasi bo'sh — db push (ma'lumot yo'qotmaydi)"
  ./node_modules/.bin/prisma db push --skip-generate
fi

log "Build"
./node_modules/.bin/nest build

log "pm2 reload: $PM2_API"
pm2 reload "$PM2_API" --update-env
sleep 3
pm2 describe "$PM2_API" | grep -E "status|restart" || true

if [ "$SKIP_FRONTEND" != "1" ]; then
  for app in webapp admin superadmin; do
    [ -d "$APP_DIR/$app" ] || continue
    log "Frontend: $app"
    cd "$APP_DIR/$app"
    npm ci --no-audit --no-fund
    npm run build
    pm2 reload "vega-$app" --update-env || true
  done
fi

log "✅ Deploy tugadi ($NEW_SHA)"
