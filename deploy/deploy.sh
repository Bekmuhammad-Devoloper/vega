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

# Bog'liqliklar FAQAT package-lock.json o'zgargandagina qayta o'rnatiladi.
#
# Nega: `npm ci` node_modules'ni butunlay o'chirib qayta yozadi. Ishlab turgan
# jarayon shu paytda modul yuklamoqchi bo'lsa halok bo'ladi (pm2 max_restarts
# tugasa ilova butunlay o'ladi). Uni har deploy'da to'xtatib turish esa har
# safar 3-4 daqiqa uzilish demak. Kodgina o'zgargan odatiy deploy'da
# o'rnatish umuman shart emas — shuning uchun lockfile hash'ini solishtiramiz:
# o'zgarmagan bo'lsa o'rnatish O'TKAZIB YUBORILADI va uzilish bo'lmaydi.
LOCK_HASH_FILE="${LOCK_HASH_FILE:-/opt/vega/.lockhash}"
NEW_LOCK=$(sha256sum package-lock.json 2>/dev/null | cut -d' ' -f1)
OLD_LOCK=$(cat "$LOCK_HASH_FILE" 2>/dev/null || echo "")
NEEDS_INSTALL=0
[ -d node_modules ] || NEEDS_INSTALL=1
[ "$NEW_LOCK" != "$OLD_LOCK" ] && NEEDS_INSTALL=1

if [ "$NEEDS_INSTALL" = "1" ]; then
  log "Bog'liqliklar o'zgargan — jarayon to'xtatilib qayta o'rnatiladi"
  pm2 stop "$PM2_API" >/dev/null 2>&1 || true
  # --omit=dev ISHLATMANG: prisma, @nestjs/cli, typescript va @prisma/client
  # hammasi devDependencies'da — ularsiz build yiqiladi.
  npm ci --no-audit --no-fund
  mkdir -p "$(dirname "$LOCK_HASH_FILE")"
  printf '%s' "$NEW_LOCK" > "$LOCK_HASH_FILE"
else
  log "Bog'liqliklar o'zgarmagan — o'rnatish o'tkazib yuborildi (uzilishsiz)"
fi

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

log "pm2 start: $PM2_API"
# `start` — to'xtatilgan jarayonni ko'taradi; allaqachon ishlayotgan bo'lsa
# reload bilan yangilaymiz. Beqaror qayta ishga tushishlar hisoblagichini ham
# tozalaymiz, aks holda keyingi deploy'da limit tezroq tugaydi.
pm2 start "$PM2_API" --update-env >/dev/null 2>&1 || pm2 reload "$PM2_API" --update-env
pm2 reset "$PM2_API" >/dev/null 2>&1 || true
sleep 3
pm2 describe "$PM2_API" | grep -E "status|restart" || true

if [ "$SKIP_FRONTEND" != "1" ]; then
  for app in webapp admin superadmin; do
    [ -d "$APP_DIR/$app" ] || continue
    log "Frontend: $app"
    cd "$APP_DIR/$app"

    # Backend'dagi bilan bir xil mantiq: lockfile o'zgarmagan bo'lsa `npm ci`
    # umuman ishlatilmaydi. Bu tezlik uchun emas — kichik serverda har
    # deploy'da uch marta `npm ci` xotirani tugatib, OOM killer jarayonni
    # o'ldirardi (exit 137) va deploy yarim yo'lda uzilardi.
    FE_LOCK_FILE="/opt/vega/.lockhash-$app"
    FE_NEW=$(sha256sum package-lock.json 2>/dev/null | cut -d' ' -f1)
    FE_OLD=$(cat "$FE_LOCK_FILE" 2>/dev/null || echo "")
    FE_INSTALL=0
    [ -d node_modules ] || FE_INSTALL=1
    # npm bu faylni o'rnatish MUVAFFAQIYATLI tugagandagina yozadi. Yarim
    # uzilgan o'rnatishdan keyin (masalan OOM'da o'ldirilgan `npm ci`)
    # node_modules bor, lekin yaroqsiz — shuni aynan shu bilan aniqlaymiz.
    [ -f node_modules/.package-lock.json ] || FE_INSTALL=1
    [ "$FE_NEW" != "$FE_OLD" ] && FE_INSTALL=1
    # node_modules bor, lekin hash hali yozilmagan (bu himoya qo'shilgandan
    # keyingi BIRINCHI deploy). Uni shu lockfile'dan o'rnatilgan deb
    # hisoblaymiz — aks holda birinchi deploy yana keraksiz `npm ci` qilardi.
    if [ "$FE_INSTALL" = "0" ] && [ -z "$FE_OLD" ]; then
      FE_INSTALL=0
      mkdir -p "$(dirname "$FE_LOCK_FILE")"
      printf '%s' "$FE_NEW" > "$FE_LOCK_FILE"
    fi

    if [ "$FE_INSTALL" = "1" ]; then
      # O'rnatish kerak bo'lsa — shu app'ning O'ZINI vaqtincha to'xtatib
      # xotirani bo'shatamiz (boshqa ilovalarga tegmaymiz) va npm heap'ini
      # cheklaymiz, shunda OOM killer aralashmaydi.
      log "  bog'liqliklar o'zgargan — o'rnatilmoqda (shu app vaqtincha to'xtaydi)"
      pm2 stop "vega-$app" >/dev/null 2>&1 || true
      # Yiqilsa app TO'XTAGAN holicha qolmasligi kerak — aks holda bitta
      # muvaffaqiyatsiz deploy butun panelni o'chirib qo'yadi. Avval qaytarib
      # ko'taramiz, keyin deploy'ni xato bilan tugatamiz.
      if ! NODE_OPTIONS=--max-old-space-size=768 npm ci --no-audit --no-fund; then
        pm2 start "vega-$app" --update-env >/dev/null 2>&1 || true
        log "  XATO: $app bog'liqliklari o'rnatilmadi (xotira yetmagan bo'lishi mumkin)"
        exit 1
      fi
      mkdir -p "$(dirname "$FE_LOCK_FILE")"
      printf '%s' "$FE_NEW" > "$FE_LOCK_FILE"
    else
      log "  bog'liqliklar o'zgarmagan — o'rnatish o'tkazib yuborildi"
    fi

    if ! NODE_OPTIONS=--max-old-space-size=1024 npm run build; then
      pm2 start "vega-$app" --update-env >/dev/null 2>&1 || true
      log "  XATO: $app build qilinmadi"
      exit 1
    fi
    pm2 start "vega-$app" --update-env >/dev/null 2>&1 || pm2 reload "vega-$app" --update-env || true
  done
fi

log "✅ Deploy tugadi ($NEW_SHA)"
