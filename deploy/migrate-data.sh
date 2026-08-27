#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Postgres ma'lumotlarini ESKI serverdan YANGISIGA ko'chirish.
#
#   ESKI serverda:   bash migrate-data.sh dump
#   (fayl ko'chiriladi: scp ...)
#   YANGI serverda:  bash migrate-data.sh restore /tmp/vega-XXXX.dump
#
# DIQQAT: to'liq mos ko'chirish uchun dump paytida yozuv bo'lmasligi kerak —
# `dump` avval backendni to'xtatishni taklif qiladi (--stop bilan avtomatik).
# ─────────────────────────────────────────────────────────────
set -euo pipefail

CONTAINER="${CONTAINER:-vega-postgres}"
DB_USER="${DB_USER:-vega}"
DB_NAME="${DB_NAME:-vega}"
PM2_API="${PM2_API:-vega-backend}"
CMD="${1:-}"

case "$CMD" in
  dump)
    OUT="/tmp/vega-$(date +%Y%m%d-%H%M%S).dump"
    if [ "${2:-}" = "--stop" ]; then
      echo "──> Backend to'xtatilmoqda (yozuv bo'lmasligi uchun)"
      pm2 stop "$PM2_API"
      trap 'echo "──> Backend qayta yoqilmoqda"; pm2 start "$PM2_API"' EXIT
    else
      echo "⚠️  Backend ishlayapti — dump paytida yangi buyurtma kelsa yo'qoladi."
      echo "   To'liq ko'chirish uchun: bash migrate-data.sh dump --stop"
    fi

    echo "──> pg_dump ($CONTAINER / $DB_NAME)"
    docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$OUT"
    echo "✅ $OUT  ($(du -h "$OUT" | cut -f1))"
    echo
    echo "Keyingi qadam — yangi serverga yuboring:"
    echo "  scp $OUT root@<YANGI_IP>:/tmp/"
    ;;

  restore)
    FILE="${2:-}"
    [ -f "$FILE" ] || { echo "XATO: dump fayli berilmadi/topilmadi"; exit 1; }

    echo "⚠️  $DB_NAME bazasi TO'LIQ almashtiriladi. Davom etilsinmi? (yozing: ha)"
    read -r ans; [ "$ans" = "ha" ] || { echo "bekor qilindi"; exit 1; }

    echo "──> Zaxira (xavfsizlik uchun)"
    docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc \
      > "/tmp/before-restore-$(date +%s).dump" 2>/dev/null || echo "    (bo'sh baza — zaxira o'tkazildi)"

    echo "──> Tiklanmoqda"
    docker exec -i "$CONTAINER" pg_restore -U "$DB_USER" -d "$DB_NAME" \
      --clean --if-exists --no-owner --no-privileges < "$FILE"

    echo "──> Tekshiruv"
    docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c \
      'SELECT (SELECT count(*) FROM "Tenant") AS dokonlar,
              (SELECT count(*) FROM "User") AS mijozlar,
              (SELECT count(*) FROM "NumberOrder") AS raqam_buyurtma,
              (SELECT count(*) FROM "DigitalOrder") AS digital_buyurtma;'
    echo "✅ Tiklandi"
    ;;

  *)
    echo "Foydalanish:"
    echo "  bash migrate-data.sh dump [--stop]"
    echo "  bash migrate-data.sh restore /tmp/vega-XXXX.dump"
    exit 1
    ;;
esac
