#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Security hardening — VM tiklangach DARHOL ishga tushiring.
#
# Foydalanish:
#   sudo bash deploy/security-hardening.sh
#
# Bu skript bajaradi:
#   1. OS paketlarini yangilaydi
#   2. UFW firewall (faqat 22/80/443)
#   3. fail2ban (SSH brute-force himoyasi)
#   4. SSH parol autentifikatsiyasini o'chiradi
#   5. Avtomatik xavfsizlik yangilanishlari
#   6. PostgreSQL — faqat localhost
#   7. Eski .env.OLD.* fayllarni o'chiradi
#   8. Tasodifiy process'larni tekshiradi (mining belgilari)
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

if [ "$EUID" -ne 0 ]; then
    echo "✗ Root sifatida ishga tushiring: sudo bash $0" >&2
    exit 1
fi

LOG="/var/log/security-hardening-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG") 2>&1

section() { echo; echo "═══ $* ═══"; }
ok()      { echo "  ✓ $*"; }
warn()    { echo "  ⚠ $*"; }

# ─── 1. OS update ──────────────────────────────────────────────
section "1/8  OS paketlari yangilanmoqda"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get autoremove -y -qq
ok "OS paketlari yangilandi"

# ─── 2. UFW firewall ──────────────────────────────────────────
section "2/8  UFW firewall sozlanmoqda"
apt-get install -y -qq ufw
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   comment 'SSH'
ufw allow 80/tcp   comment 'HTTP'
ufw allow 443/tcp  comment 'HTTPS'
ufw --force enable
ok "UFW yoqildi (faqat 22/80/443)"
ufw status numbered | sed 's/^/    /'

# ─── 3. fail2ban ──────────────────────────────────────────────
section "3/8  fail2ban o'rnatilmoqda"
apt-get install -y -qq fail2ban
cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5
backend  = systemd

[sshd]
enabled = true
port    = ssh
EOF
systemctl enable fail2ban
systemctl restart fail2ban
ok "fail2ban faollashtirildi"

# ─── 4. SSH hardening ─────────────────────────────────────────
section "4/8  SSH konfiguratsiyasi mustahkamlanmoqda"
SSHD_CONF=/etc/ssh/sshd_config
cp "$SSHD_CONF" "${SSHD_CONF}.bak.$(date +%s)"

# Parol va root login'ni o'chirish
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' "$SSHD_CONF"
sed -i 's/^#\?ChallengeResponseAuthentication.*/ChallengeResponseAuthentication no/' "$SSHD_CONF"
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' "$SSHD_CONF"
sed -i 's/^#\?KbdInteractiveAuthentication.*/KbdInteractiveAuthentication no/' "$SSHD_CONF"

# Tekshirish va qayta yuklash
sshd -t
systemctl restart ssh
ok "SSH faqat key auth (parol o'chirildi)"

# ─── 5. Avtomatik xavfsizlik yangilanishlari ──────────────────
section "5/8  Avto-update sozlanmoqda"
apt-get install -y -qq unattended-upgrades apt-listchanges
dpkg-reconfigure -f noninteractive unattended-upgrades
echo 'APT::Periodic::Update-Package-Lists "1";' > /etc/apt/apt.conf.d/20auto-upgrades
echo 'APT::Periodic::Unattended-Upgrade "1";' >> /etc/apt/apt.conf.d/20auto-upgrades
ok "Har kunlik avtomatik xavfsizlik patch'lari"

# ─── 6. PostgreSQL — faqat localhost ─────────────────────────
section "6/8  PostgreSQL ulanish himoyasi"
PG_VER=$(ls /etc/postgresql/ 2>/dev/null | head -1 || echo "")
if [ -n "$PG_VER" ]; then
    PG_CONF=/etc/postgresql/${PG_VER}/main/postgresql.conf
    if grep -q "^listen_addresses" "$PG_CONF"; then
        sed -i "s/^listen_addresses.*/listen_addresses = 'localhost'/" "$PG_CONF"
    else
        echo "listen_addresses = 'localhost'" >> "$PG_CONF"
    fi
    systemctl restart postgresql
    ok "PostgreSQL ${PG_VER} faqat 127.0.0.1 da tinglaydi"
else
    warn "PostgreSQL topilmadi — o'tkazib yuborildi"
fi

# ─── 7. Eski sirli backup fayllar ────────────────────────────
section "7/8  Eski credential backup'lari tozalanmoqda"
DELETED=$(find /opt/marketplace -type f \( \
    -name "*.env.OLD.*" -o \
    -name "*.env.BAK*" -o \
    -name "*.env.bak*" -o \
    -name "*.env.backup*" -o \
    -name ":USERPROFILE*" \
\) 2>/dev/null | tee >(wc -l > /tmp/deleted_count))
if [ -n "$DELETED" ]; then
    echo "$DELETED" | xargs -r rm -fv
    ok "$(cat /tmp/deleted_count) ta xavfli fayl o'chirildi"
else
    ok "Xavfli backup fayl topilmadi"
fi
rm -f /tmp/deleted_count

# ─── 8. Mining gumonli process'larni tekshirish ──────────────
section "8/8  Mining/cryptocurrency belgilari"
SUSPICIOUS_NAMES="xmrig|minerd|cpuminer|kthreaddi|kdevtmpfsi|ccminer|monero|nicehash|ethminer"
PROCS=$(ps auxf 2>/dev/null | grep -EiI "$SUSPICIOUS_NAMES" | grep -v grep || true)
if [ -n "$PROCS" ]; then
    warn "GUMONLI PROCESS TOPILDI:"
    echo "$PROCS" | sed 's/^/    /'
    warn "QO'LDA TEKSHIRING — pid'larni o'chiring: kill -9 <PID>"
else
    ok "Mining process topilmadi"
fi

# Yuqori CPU iste'mol qiluvchi top 5 process
echo "  Eng CPU iste'mol qiluvchi 5 ta process (mining gumonida foydali):"
ps aux --sort=-%cpu --no-headers 2>/dev/null | head -5 | awk '{printf "    %s %s%% CPU — %s\n", $2, $3, $11}'

# Tarmoq ulanishlarini tekshirish
echo "  Tashqi tarmoq ulanishlari (mining pool'lar gumoni):"
ss -tunap 2>/dev/null | awk 'NR>1 && $5 !~ /127.0.0.1|::1|0.0.0.0/ {print "    "$5" → "$6}' | sort -u | head -10 || true

# ─── Yakuniy ─────────────────────────────────────────────────
section "✅ TUGADI"
echo
echo "  Log: $LOG"
echo
echo "  KEYINGI QO'LDA QILISH KERAK:"
echo "    1. Barcha credentials'ni almashtiring:"
echo "       - PostgreSQL parol:  sudo -u postgres psql -c \"ALTER USER marketplace_user PASSWORD '<YANGI>';\""
echo "       - .env'da:           DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, TELEGRAM_BOT_TOKEN"
echo "       - Admin paneli:      /admins sahifasi orqali"
echo "    2. PM2'ni yangilash:    pm2 reload ecosystem.config.cjs --update-env"
echo "    3. npm audit fix:       cd backend && npm audit fix && cd ../webapp && npm audit fix"
echo "    4. fail2ban tekshirish: sudo fail2ban-client status sshd"
echo "    5. Daily backup:        crontab -e bilan pg_dump qo'shing"
echo
