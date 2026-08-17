#!/usr/bin/env bash
# PM2 orqali hamma processlarni ishga tushiradi
set -euo pipefail
APP_DIR="/opt/marketplace"
cd "${APP_DIR}"

echo "═══════════════════════════════════════════════════════════"
echo "  PM2 start — 5 ta jarayon"
echo "═══════════════════════════════════════════════════════════"

# Eski processlarni to'xtatish (qayta deploy uchun)
for p in marketplace-api marketplace-webapp marketplace-admin marketplace-superadmin marketplace-landing; do
    pm2 delete "$p" 2>/dev/null || true
done

# Ecosystem'dan ishga tushirish
pm2 start "${APP_DIR}/ecosystem.config.cjs"

# 5 sekund kutish (Next start uchun)
echo ""
echo "▶ 5 sekund kutilmoqda (Next.js boot)..."
sleep 5

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  PM2 holatlari"
echo "═══════════════════════════════════════════════════════════"
pm2 list

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Internal portlar tekshiruvi"
echo "═══════════════════════════════════════════════════════════"

check_port() {
    local name=$1
    local port=$2
    local path=${3:-/}
    local code
    code=$(curl -s -o /dev/null -m 10 -w "%{http_code}" "http://127.0.0.1:${port}${path}" 2>/dev/null || echo "ERR")
    if [[ "$code" =~ ^[23] ]]; then
        echo "  ✓ ${name} (${port}) → HTTP ${code}"
    else
        echo "  ✗ ${name} (${port}) → ${code}"
    fi
}

check_port "Backend API" 2400 /api/health
check_port "Webapp"      2401 /
check_port "Admin"       2402 /
check_port "SuperAdmin"  2403 /
check_port "Landing"     2404 /

# PM2 holatini saqlash (reboot'dan keyin avto-start uchun)
pm2 save 2>&1 | tail -2

echo ""
echo "✓ PM2 tayyor. Reboot'da avto-start:"
echo "    pm2 startup    (faqat bir marta, root sifatida)"
