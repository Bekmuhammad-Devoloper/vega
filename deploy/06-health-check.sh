#!/usr/bin/env bash
# Production health-check: barcha 4 subdomain + backend + DB + PM2
echo "═══════════════════════════════════════════════════════════"
echo "  PRODUCTION HEALTH CHECK — selliostore.uz"
echo "═══════════════════════════════════════════════════════════"

SUBS=(selliostore.uz admin.selliostore.uz clients.selliostore.uz dev.selliostore.uz)

# ─── 1. PUBLIC ENDPOINTS ───────────────────────────────────
echo ""
echo "▶ [1/7] Public HTTPS endpoint'lar"
for d in "${SUBS[@]}"; do
    code=$(curl -s -o /dev/null -m 10 -w "%{http_code}" "https://${d}/" 2>/dev/null || echo "ERR")
    time_total=$(curl -s -o /dev/null -m 10 -w "%{time_total}" "https://${d}/" 2>/dev/null || echo "-")
    if [[ "$code" =~ ^[23] ]]; then
        echo "  ✓ https://${d}/ → ${code} (${time_total}s)"
    else
        echo "  ✗ https://${d}/ → ${code}"
    fi
done

# ─── 2. LANDING SIGNUP API ─────────────────────────────────
echo ""
echo "▶ [2/7] Landing signup endpoint"
code=$(curl -s -o /dev/null -m 10 -w "%{http_code}" -X POST \
    -H 'Content-Type: application/json' \
    -d '{"invalid":true}' \
    "https://selliostore.uz/api/public/signup" 2>/dev/null || echo "ERR")
# 400 = validation error (yaxshi, endpoint javob beradi)
echo "  Signup (validation): HTTP ${code} (400 = OK)"

# ─── 3. ADMIN AUTH ─────────────────────────────────────────
echo ""
echo "▶ [3/7] Admin login API"
LOGIN_RESP=$(curl -s -m 10 -X POST \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"${ADMIN_EMAIL:-admin@selliostore.uz}\",\"password\":\"${ADMIN_PASS:-Admin12345!}\"}" \
    https://admin.selliostore.uz/api/admin/auth/login 2>/dev/null)
TOKEN=$(echo "$LOGIN_RESP" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("accessToken","FAIL"))' 2>/dev/null || echo "FAIL")
if [ "$TOKEN" != "FAIL" ] && [ -n "$TOKEN" ]; then
    echo "  ✓ Admin login OK: ${TOKEN:0:30}..."
else
    echo "  ✗ Admin login FAIL"
    echo "$LOGIN_RESP" | head -c 200
fi

# ─── 4. SUPER ADMIN AUTH ───────────────────────────────────
echo ""
echo "▶ [4/7] Super Admin login"
SUPER_RESP=$(curl -s -m 10 -X POST \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"${SUPER_EMAIL:-owner@selliostore.uz}\",\"password\":\"${SUPER_PASS:-SuperOwner123!}\"}" \
    https://dev.selliostore.uz/api/super-admin/auth/login 2>/dev/null)
SUPER_TOKEN=$(echo "$SUPER_RESP" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("accessToken","FAIL"))' 2>/dev/null || echo "FAIL")
if [ "$SUPER_TOKEN" != "FAIL" ] && [ -n "$SUPER_TOKEN" ]; then
    echo "  ✓ Super Admin login OK"
else
    echo "  ✗ Super Admin login FAIL"
fi

# ─── 5. PM2 STATUS ─────────────────────────────────────────
echo ""
echo "▶ [5/7] PM2 jarayonlar"
pm2 jlist 2>/dev/null | python3 -c '
import json, sys
try:
    ps = json.load(sys.stdin)
    for p in ps:
        if p["name"].startswith("marketplace-"):
            env = p["pm2_env"]
            mem = p["monit"]["memory"] // 1024 // 1024
            cpu = p["monit"]["cpu"]
            restarts = env.get("restart_time", 0)
            status = env["status"]
            mark = "✓" if status == "online" else "✗"
            print(f"  {mark} {p[\"name\"]:30s} {status:8s} restarts: {restarts:3d}  RAM: {mem:4d} MB  CPU: {cpu}%")
except Exception as e:
    print("  ✗ PM2 list failed:", e)
'

# ─── 6. NGINX ──────────────────────────────────────────────
echo ""
echo "▶ [6/7] Nginx"
nginx -t 2>&1 | tail -2
echo "  Active connections: $(curl -s http://127.0.0.1/nginx_status 2>/dev/null | head -1 || echo '?')"

# ─── 7. SSL ────────────────────────────────────────────────
echo ""
echo "▶ [7/7] SSL sertifikat muddati"
for d in selliostore.uz admin.selliostore.uz clients.selliostore.uz dev.selliostore.uz; do
    exp=$(echo | openssl s_client -servername "$d" -connect "${d}:443" 2>/dev/null \
        | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
    if [ -n "$exp" ]; then
        echo "  ✓ ${d} → ${exp}"
    else
        echo "  ✗ ${d} → sertifikat o'qib bo'lmadi"
    fi
done

# ─── 8. DB ─────────────────────────────────────────────────
echo ""
echo "▶ [8/8] Database statistika"
sudo -u postgres psql -d marketplace -c '
SELECT
  (SELECT count(*) FROM "User") AS users,
  (SELECT count(*) FROM "Tenant") AS tenants,
  (SELECT count(*) FROM "Product") AS products,
  (SELECT count(*) FROM "Order") AS orders,
  (SELECT count(*) FROM "Admin") AS admins,
  (SELECT count(*) FROM "PlatformAdmin") AS platform_admins,
  (SELECT count(*) FROM "AICreditUsage") AS ai_calls;
' 2>&1 | head -10 || echo "  ✗ DB connection failed"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✓ HEALTH CHECK TUGADI"
echo "═══════════════════════════════════════════════════════════"
