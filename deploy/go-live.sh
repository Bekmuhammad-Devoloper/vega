#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# uz-simcard.uz DNS tarqalgandan KEYIN serverda ishga tushiriladi:
#   bash /opt/vega/app/deploy/go-live.sh
#
# 1) DNS haqiqatan yangi serverga qarayotganini tekshiradi (aks holda TO'XTAYDI)
# 2) Beshala domenga SSL o'rnatadi
# 3) backend .env dagi URL'larni yangi domenlarga o'tkazadi
# 4) qayta ishga tushirib, hammasini tekshiradi
# ─────────────────────────────────────────────────────────────
set -euo pipefail
IP="${IP:-34.159.2.151}"
ENVF=/opt/vega/app/backend/.env
EMAIL="${EMAIL:-khamidovonline@gmail.com}"
DOMAINS=(uz-simcard.uz www.uz-simcard.uz api.uz-simcard.uz app.uz-simcard.uz admin.uz-simcard.uz)

echo "══> 1/4 DNS tekshiruvi"
FAIL=0
for d in "${DOMAINS[@]}"; do
  R=$(dig +short "$d" A @8.8.8.8 2>/dev/null | tail -1)
  if [ "$R" = "$IP" ]; then printf "  %-26s %s OK\n" "$d" "$R"
  else printf "  %-26s %s ✗\n" "$d" "${R:-yo_q}"; FAIL=1; fi
done
[ "$FAIL" = "0" ] || { echo; echo "❌ DNS hali tayyor emas — to'xtatildi (SSL so'rovini behuda sarflamaymiz)"; exit 1; }

echo; echo "══> 2/4 SSL"
ARGS=(); for d in "${DOMAINS[@]}"; do ARGS+=(-d "$d"); done
sudo certbot --nginx "${ARGS[@]}" --non-interactive --agree-tos -m "$EMAIL" --redirect 2>&1 | tail -6

echo; echo "══> 3/4 .env URL'lari"
setv(){ if grep -q "^$1=" "$ENVF"; then sudo sed -i "s|^$1=.*|$1=$2|" "$ENVF"; else echo "$1=$2" | sudo tee -a "$ENVF" >/dev/null; fi; echo "  $1=$2"; }
setv APP_URL            "https://api.uz-simcard.uz"
setv WEBAPP_URL         "https://app.uz-simcard.uz"
setv ADMIN_URL          "https://admin.uz-simcard.uz"
setv SUPERADMIN_URL     "https://vega.yuksalish.dev"
setv LANDING_URL        "https://uz-simcard.uz"
setv PUBLIC_UPLOADS_URL "https://api.uz-simcard.uz/uploads"

echo; echo "══> 4/4 Qayta ishga tushirish va tekshirish"
pm2 restart vega-backend --update-env >/dev/null; sleep 8
for u in "https://uz-simcard.uz/" "https://api.uz-simcard.uz/api/catalog/services" \
         "https://app.uz-simcard.uz/" "https://admin.uz-simcard.uz/" "https://vega.yuksalish.dev/"; do
  printf "  %-46s HTTP %s\n" "$u" "$(curl -s -o /dev/null -w '%{http_code}' -m 20 "$u" || echo 000)"
done
echo; echo "✅ Tayyor. Bot menyu tugmasi endi https://admin.uz-simcard.uz/register ga qaraydi."
