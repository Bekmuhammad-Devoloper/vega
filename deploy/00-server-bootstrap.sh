#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Server bootstrap — Ubuntu 22.04 LTS uchun
#
# Bu skript serverda KERAK BO'LADIGAN HAMMA NARSANI o'rnatadi:
#   - Node.js 20 LTS
#   - PostgreSQL 17
#   - Nginx
#   - PM2 (global)
#   - Certbot (Let's Encrypt)
#   - UFW (firewall)
#
# Faqat BIR MARTA ishga tushiriladi (yangi serverda).
# Keyin: ./01-clone-and-prepare.sh ni ishga tushiring.
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

# Root tekshirish
if [ "$EUID" -ne 0 ]; then
    echo "❌ Root sifatida ishga tushiring: sudo bash $0"
    exit 1
fi

echo "═══════════════════════════════════════════════════════════"
echo "  Sellio Store — Server Bootstrap"
echo "  Ubuntu 22.04 LTS uchun"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ─── 1. Sistema yangilash ───────────────────────────────────
# MUHIM: noninteractive rejim — aks holda openssh-server/grub yangilanishi
# debconf prompt'da qotib, SSH sessiyasini uzib yuboradi. confold/confdef
# bilan mavjud config fayllarni saqlaymiz (sshd_config o'zgarmaydi).
echo "▶ [1/8] Sistema yangilash..."
export DEBIAN_FRONTEND=noninteractive
APT_OPTS='-o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold'
apt-get update -qq
apt-get upgrade -y -qq ${APT_OPTS}
apt-get install -y -qq ${APT_OPTS} curl wget git build-essential ca-certificates gnupg lsb-release ufw htop unzip

# ─── 2. Node.js 20 LTS (NodeSource) ─────────────────────────
echo "▶ [2/8] Node.js 20 LTS o'rnatish..."
if ! command -v node >/dev/null 2>&1 || ! node -v | grep -q "v20\."; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
echo "  ✓ Node.js: $(node -v)"
echo "  ✓ npm: $(npm -v)"

# ─── 3. PostgreSQL 17 ───────────────────────────────────────
echo "▶ [3/8] PostgreSQL 17 o'rnatish..."
if ! command -v psql >/dev/null 2>&1; then
    install -d /usr/share/postgresql-common/pgdg
    curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
        --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc
    echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
        > /etc/apt/sources.list.d/pgdg.list
    apt-get update -qq
    apt-get install -y postgresql-17 postgresql-client-17
fi
systemctl enable --now postgresql
echo "  ✓ PostgreSQL: $(sudo -u postgres psql -tAc 'SHOW server_version;' | tr -d ' ')"

# ─── 4. Postgres user va database ───────────────────────────
echo "▶ [4/8] Postgres user yaratish..."
DB_USER="marketplace"
DB_NAME="marketplace"
# Random kuchli parol agar yangi bo'lsa
DB_PASS_FILE="/root/.marketplace-db-password"
if [ ! -f "$DB_PASS_FILE" ]; then
    DB_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
    echo "$DB_PASS" > "$DB_PASS_FILE"
    chmod 600 "$DB_PASS_FILE"
else
    DB_PASS=$(cat "$DB_PASS_FILE")
fi

# User va DB yaratish (faqat agar yo'q bo'lsa)
sudo -u postgres psql <<EOF
DO \$\$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN
      CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';
   ELSE
      ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASS}';
   END IF;
END
\$\$;
SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
EOF
echo "  ✓ DB: ${DB_NAME} | User: ${DB_USER}"
echo "  ✓ Parol saqlangan: ${DB_PASS_FILE}"

# ─── 5. Nginx ───────────────────────────────────────────────
echo "▶ [5/8] Nginx o'rnatish..."
apt-get install -y -qq nginx
systemctl enable --now nginx
echo "  ✓ Nginx: $(nginx -v 2>&1)"

# ─── 6. Certbot (Let's Encrypt) ─────────────────────────────
echo "▶ [6/8] Certbot o'rnatish..."
apt-get install -y -qq certbot python3-certbot-nginx
mkdir -p /var/www/certbot
echo "  ✓ Certbot: $(certbot --version 2>&1 | head -1)"

# ─── 7. PM2 ─────────────────────────────────────────────────
echo "▶ [7/8] PM2 o'rnatish..."
npm install -g pm2 --silent
pm2 install pm2-logrotate >/dev/null 2>&1 || true
pm2 set pm2-logrotate:max_size 50M >/dev/null
pm2 set pm2-logrotate:retain 7 >/dev/null
echo "  ✓ PM2: $(pm2 -v)"

# ─── 8. Firewall (UFW) ──────────────────────────────────────
echo "▶ [8/8] Firewall sozlash..."
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp comment 'SSH' >/dev/null
ufw allow 80/tcp comment 'HTTP' >/dev/null
ufw allow 443/tcp comment 'HTTPS' >/dev/null
ufw --force enable >/dev/null
echo "  ✓ UFW yoqildi: 22, 80, 443"

# ─── Project papka tayyorlash ───────────────────────────────
mkdir -p /opt/marketplace/{logs,uploads,backend}
chown -R "$(logname 2>/dev/null || echo $SUDO_USER || echo root):$(logname 2>/dev/null || echo $SUDO_USER || echo root)" /opt/marketplace

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ BOOTSTRAP TUGADI"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📝 Postgres ma'lumotlari:"
echo "   User: ${DB_USER}"
echo "   DB:   ${DB_NAME}"
echo "   Pass: ${DB_PASS}"
echo "   File: ${DB_PASS_FILE}"
echo ""
echo "📋 Keyingi qadamlar:"
echo "   1. DNS yozuvlarini sozlang (selliostore.uz, admin., clients., dev.)"
echo "   2. ./deploy/01-clone-and-prepare.sh"
echo "   3. /opt/marketplace/backend/.env ni .env.production.example dan tuzing"
echo "   4. ./deploy/03-install-build-migrate.sh"
echo "   5. ./deploy/04-pm2-start.sh"
echo "   6. ./deploy/05-nginx-and-ssl.sh"
echo ""
