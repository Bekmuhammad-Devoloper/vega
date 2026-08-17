#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Vega — iStar (Stars/Premium avto-yetkazish) deploy skripti
# SERVERDA ishga tushiriladi: bash deploy-istar.sh
# Fayllar oldindan scp bilan yuborilgan bo'lishi kerak.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/vega-saas/backend}"
PM2_NAME="${PM2_NAME:-vega-backend}"
# Kalit shu faylda SAQLANMAYDI (repo'ga tushmasligi uchun) — chaqirishda beriladi:
#   ISTAR_KEY='...' bash deploy-istar.sh
ISTAR_KEY="${ISTAR_KEY:-}"

echo "==> 1/5  Papka va pm2 tekshiruvi"
[ -d "$APP_DIR" ] || { echo "XATO: $APP_DIR topilmadi. APP_DIR=... bilan qayta urinib ko'ring"; exit 1; }
pm2 describe "$PM2_NAME" >/dev/null 2>&1 || { echo "XATO: pm2 '$PM2_NAME' yo'q. 'pm2 list' bilan tekshiring"; exit 1; }
cd "$APP_DIR"

echo "==> 2/5  Yangi fayllar yetib kelganmi"
for f in src/modules/providers/istar.provider.ts \
         src/modules/providers/telegram-gift.provider.ts \
         src/modules/digital/digital.service.ts; do
  [ -f "$f" ] || { echo "XATO: $f yo'q — avval scp qiling"; exit 1; }
done
grep -q "IstarProvider" src/modules/providers/providers.module.ts \
  || { echo "XATO: providers.module.ts eski — qayta scp qiling"; exit 1; }

echo "==> 3/5  .env ga iStar sozlamalari"
# Zaxira nusxa — .env ni hech qachon ko'r-ko'rona o'zgartirmaymiz
cp .env ".env.bak.$(date +%s)"
if grep -q "^ISTAR_API_KEY=" .env; then
  echo "    ISTAR_API_KEY allaqachon bor — qo'shilmadi"
elif [ -z "$ISTAR_KEY" ]; then
  echo "    OGOHLANTIRISH: ISTAR_KEY berilmadi — .env ga qo'shilmadi."
  echo "    Kalitni keyin qo'lda qo'shing yoki qayta ishga tushiring:"
  echo "      ISTAR_KEY='...' bash deploy-istar.sh"
else
  cat >> .env <<EOF

# iStar — Stars/Premium avto-yetkazish (bo'sh -> SMM/qo'lda yo'liga tushadi)
ISTAR_API_KEY=${ISTAR_KEY}
ISTAR_BASE_URL=https://v1.fragmentapi.com/api/v1/partner
ISTAR_WALLET=TON
EOF
  echo "    qo'shildi"
fi

echo "==> 4/5  Build"
npx nest build

echo "==> 5/5  Qayta ishga tushirish"
pm2 reload "$PM2_NAME" --update-env
sleep 4
pm2 describe "$PM2_NAME" | grep -E "status|restarts" || true

echo
echo "✅ Tugadi. Loglarni ko'rish:  pm2 logs $PM2_NAME --lines 40"
echo "   Tekshirish (401 kutiladi, 404 EMAS):"
echo "   curl -s -o /dev/null -w '%{http_code}\\n' https://api.vega.yuksalish.dev/api/super-admin/digital/delivery-status"
