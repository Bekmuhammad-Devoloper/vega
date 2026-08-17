#!/usr/bin/env bash
# Nginx + Let's Encrypt sertifikati o'rnatadi (selliostore.uz uchun)
set -euo pipefail

APP_DIR="/opt/marketplace"
DOMAIN="selliostore.uz"
EMAIL="${LE_EMAIL:-admin@selliostore.uz}"

SUBDOMAINS=(
    "selliostore.uz"
    "www.selliostore.uz"
    "admin.selliostore.uz"
    "clients.selliostore.uz"
    "dev.selliostore.uz"
)

echo "═══════════════════════════════════════════════════════════"
echo "  Nginx + SSL (Let's Encrypt) o'rnatish"
echo "  Domain: ${DOMAIN}"
echo "  Email:  ${EMAIL}"
echo "═══════════════════════════════════════════════════════════"

# ─── 1. Nginx bootstrap config (HTTP-only) ────────────────
echo ""
echo "▶ [1/4] Bootstrap Nginx config..."

mkdir -p /var/www/certbot

cat > /etc/nginx/sites-available/${DOMAIN} <<'NGINX_EOF'
# Vaqtinchalik HTTP — sertifikat olingach 4-bosqichda almashtiriladi
server {
    listen 80;
    listen [::]:80;
    server_name selliostore.uz www.selliostore.uz
                admin.selliostore.uz clients.selliostore.uz dev.selliostore.uz;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'OK — bootstrap mode';
        add_header Content-Type text/plain;
    }
}
NGINX_EOF

ln -sfn /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/${DOMAIN}
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
echo "  ✓ Bootstrap config faol"

# ─── 2. DNS tekshiruv ──────────────────────────────────────
echo ""
echo "▶ [2/4] DNS tekshiruv..."

SERVER_IP=$(curl -s -m 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
echo "  Server IP: ${SERVER_IP}"

dns_ok=true
for sub in "${SUBDOMAINS[@]}"; do
    resolved=$(dig +short "$sub" A | head -1)
    if [ "$resolved" = "$SERVER_IP" ]; then
        echo "  ✓ ${sub} → ${resolved}"
    else
        echo "  ✗ ${sub} → ${resolved:-NOT FOUND} (kutilgan: ${SERVER_IP})"
        dns_ok=false
    fi
done

if [ "$dns_ok" != "true" ]; then
    echo ""
    echo "⚠ DNS yozuvlari to'liq sozlanmagan. Certbot xato berishi mumkin."
    echo "  Davom etasizmi? [Y/n]"
    read -r answer
    if [[ "$answer" =~ ^[Nn] ]]; then
        exit 1
    fi
fi

# ─── 3. Sertifikat olish ───────────────────────────────────
echo ""
echo "▶ [3/4] Let's Encrypt sertifikati..."

CERT_DOMAINS=()
for sub in "${SUBDOMAINS[@]}"; do
    CERT_DOMAINS+=(-d "$sub")
done

certbot certonly \
    --webroot -w /var/www/certbot \
    "${CERT_DOMAINS[@]}" \
    --email "${EMAIL}" \
    --agree-tos --no-eff-email \
    --non-interactive \
    --expand 2>&1 | tail -15

if [ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
    echo "❌ Sertifikat olishda xato"
    exit 1
fi
echo "  ✓ Sertifikat: /etc/letsencrypt/live/${DOMAIN}/"

# ─── 4. To'liq Nginx config ─────────────────────────────────
echo ""
echo "▶ [4/4] To'liq Nginx config..."

cp "${APP_DIR}/deploy/selliostore.uz.nginx" /etc/nginx/sites-available/${DOMAIN}
nginx -t
systemctl reload nginx
echo "  ✓ Nginx reload"

# ─── HTTPS test ─────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  HTTPS test"
echo "═══════════════════════════════════════════════════════════"
sleep 2

for sub in "selliostore.uz" "admin.selliostore.uz" "clients.selliostore.uz" "dev.selliostore.uz"; do
    code=$(curl -s -o /dev/null -m 15 -w "%{http_code}" "https://${sub}/" 2>/dev/null || echo "ERR")
    if [[ "$code" =~ ^[23] ]]; then
        echo "  ✓ https://${sub}/ → ${code}"
    else
        echo "  ⚠ https://${sub}/ → ${code}"
    fi
done

# Auto-renewal
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Auto-renewal"
echo "═══════════════════════════════════════════════════════════"
systemctl enable --now certbot.timer 2>/dev/null || true
systemctl list-timers certbot.timer --no-pager | head -3 || true

echo ""
echo "✓ Nginx + SSL tayyor"
echo ""
echo "  Manual renewal test:"
echo "    certbot renew --dry-run"
