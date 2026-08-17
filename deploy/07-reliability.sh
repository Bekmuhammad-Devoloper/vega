#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# 24/7 ishonchli ishlash uchun qo'shimcha qatlamlar:
#   1. Swap fayl (RAM kam bo'lsa OOM kill bo'lmasligi uchun)
#   2. Fail2ban (SSH brute-force himoyasi)
#   3. Unattended-upgrades (xavfsizlik yangilanishlari avtomatik)
#   4. Log rotation (/opt/marketplace/logs uchun)
#   5. Watchdog cron (har 1 daqiqada health check + auto-restart)
#   6. Backup cron (har kuni 03:00 da PG backup)
#   7. PostgreSQL tuning (kuchli parametrlar)
#   8. Systemd PM2 service (qo'shimcha kafolat)
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

APP_DIR="/opt/marketplace"
ENV_FILE="/etc/marketplace-watchdog.env"

if [ "$EUID" -ne 0 ]; then
    echo "❌ Root sifatida ishga tushiring: sudo bash $0"
    exit 1
fi

echo "═══════════════════════════════════════════════════════════"
echo "  24/7 ishonchli ishlash sozlamalari"
echo "═══════════════════════════════════════════════════════════"

# ─── 1. Swap fayl ────────────────────────────────────────────
echo ""
echo "▶ [1/8] Swap fayl..."
TOTAL_RAM_MB=$(free -m | awk '/Mem:/ {print $2}')
SWAP_MB=$(free -m | awk '/Swap:/ {print $2}')

if [ "${SWAP_MB}" -lt 1024 ]; then
    # RAM dan 2 baravar (lekin maks 4GB)
    NEW_SWAP_GB=$(( TOTAL_RAM_MB * 2 / 1024 ))
    [ "${NEW_SWAP_GB}" -gt 4 ] && NEW_SWAP_GB=4
    [ "${NEW_SWAP_GB}" -lt 2 ] && NEW_SWAP_GB=2

    echo "  RAM: ${TOTAL_RAM_MB}MB, swap yo'q — ${NEW_SWAP_GB}GB swap yaratilmoqda"
    fallocate -l "${NEW_SWAP_GB}G" /swapfile
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null
    swapon /swapfile

    # /etc/fstab ga qo'shish (reboot'da avtomatik)
    if ! grep -q "/swapfile" /etc/fstab; then
        echo "/swapfile none swap sw 0 0" >> /etc/fstab
    fi

    # Swappiness pasaytirish (faqat zarurat'da swap ishlatish)
    sysctl -w vm.swappiness=10 >/dev/null
    echo "vm.swappiness=10" > /etc/sysctl.d/99-marketplace-swappiness.conf

    echo "  ✓ Swap: ${NEW_SWAP_GB}GB (swappiness=10)"
else
    echo "  ✓ Swap allaqachon bor (${SWAP_MB}MB)"
fi

# ─── 2. Fail2ban (SSH himoya) ────────────────────────────────
echo ""
echo "▶ [2/8] Fail2ban..."
apt-get install -y -qq fail2ban

cat > /etc/fail2ban/jail.d/marketplace.conf <<'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port = 22
filter = sshd
logpath = %(sshd_log)s
maxretry = 3
bantime = 24h
EOF

systemctl enable --now fail2ban
systemctl restart fail2ban
echo "  ✓ Fail2ban: SSH 3 xato urinish → 24h ban"

# ─── 3. Unattended-upgrades ──────────────────────────────────
echo ""
echo "▶ [3/8] Avtomatik xavfsizlik yangilanishlari..."
apt-get install -y -qq unattended-upgrades apt-listchanges

cat > /etc/apt/apt.conf.d/50unattended-upgrades <<'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};
Unattended-Upgrade::Package-Blacklist {
    "nodejs";
    "postgresql-*";
    "nginx";
};
Unattended-Upgrade::DevRelease "auto";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
EOF

cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Unattended-Upgrade "1";
EOF

systemctl enable --now unattended-upgrades
echo "  ✓ Faqat security update'lar avtomatik (Node/PG/Nginx blocked)"

# ─── 4. Log rotation ─────────────────────────────────────────
echo ""
echo "▶ [4/8] Log rotation..."

cat > /etc/logrotate.d/marketplace <<EOF
${APP_DIR}/logs/*.log /var/log/marketplace-*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
    sharedscripts
}
EOF
echo "  ✓ Marketplace loglari 14 kun saqlanadi"

# PM2 logrotate (allaqachon bootstrap'da o'rnatilgan, lekin tekshiramiz)
pm2 set pm2-logrotate:max_size 50M >/dev/null 2>&1 || true
pm2 set pm2-logrotate:retain 14 >/dev/null 2>&1 || true
pm2 set pm2-logrotate:compress true >/dev/null 2>&1 || true

# ─── 5. Watchdog + Backup credentials ────────────────────────
echo ""
echo "▶ [5/8] Watchdog credentials..."
if [ ! -f "${ENV_FILE}" ]; then
    cat > "${ENV_FILE}" <<'EOF'
# Telegram bildirishnoma uchun (watchdog va backup ishlatadi)
TELEGRAM_NOTIFY_TOKEN=
TELEGRAM_NOTIFY_CHAT_ID=

# Ixtiyoriy: GCS backup bucket
# GCS_BACKUP_BUCKET=
EOF
    chmod 600 "${ENV_FILE}"
    echo "  ⚠ ${ENV_FILE} yaratildi — Telegram qiymatlarini kiriting:"
    echo "    sudo nano ${ENV_FILE}"
else
    echo "  ✓ ${ENV_FILE} allaqachon bor"
fi

# ─── 6. Watchdog cron (har 1 daqiqada) ───────────────────────
echo ""
echo "▶ [6/8] Watchdog cron..."
chmod +x "${APP_DIR}/deploy/watchdog.sh"

cat > /etc/cron.d/marketplace-watchdog <<EOF
# Marketplace 24/7 watchdog — har 1 daqiqada health check + auto-restart
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
* * * * * root ${APP_DIR}/deploy/watchdog.sh
EOF
chmod 644 /etc/cron.d/marketplace-watchdog
echo "  ✓ Watchdog har 1 daqiqada ishga tushadi"

# ─── 7. Backup cron (har kuni 03:00) ─────────────────────────
echo ""
echo "▶ [7/8] Backup cron..."
chmod +x "${APP_DIR}/deploy/backup.sh"

cat > /etc/cron.d/marketplace-backup <<EOF
# Marketplace PostgreSQL kunlik backup — soat 03:00 da
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
0 3 * * * root ${APP_DIR}/deploy/backup.sh
EOF
chmod 644 /etc/cron.d/marketplace-backup
echo "  ✓ Backup har kuni 03:00 da ishlaydi"

# ─── 8. PostgreSQL tuning ────────────────────────────────────
echo ""
echo "▶ [8/8] PostgreSQL tuning..."
PG_VERSION=$(sudo -u postgres psql -tAc 'SHOW server_version;' | cut -d. -f1)
PG_CONF="/etc/postgresql/${PG_VERSION}/main/postgresql.conf"

if [ -f "${PG_CONF}" ] && ! grep -q "# marketplace tuning" "${PG_CONF}"; then
    # RAM ga qarab shared_buffers va effective_cache_size hisoblash
    SHARED_BUFFERS_MB=$((TOTAL_RAM_MB / 4))
    EFFECTIVE_CACHE_MB=$((TOTAL_RAM_MB * 3 / 4))

    cat >> "${PG_CONF}" <<EOF

# marketplace tuning ($(date +%Y-%m-%d))
shared_buffers = ${SHARED_BUFFERS_MB}MB
effective_cache_size = ${EFFECTIVE_CACHE_MB}MB
work_mem = 16MB
maintenance_work_mem = 128MB
max_connections = 100
wal_buffers = 16MB
checkpoint_completion_target = 0.9
random_page_cost = 1.1
EOF
    systemctl restart postgresql
    echo "  ✓ PG tuned: shared_buffers=${SHARED_BUFFERS_MB}MB"
else
    echo "  ✓ PG allaqachon tuned (yoki conf topilmadi)"
fi

# ─── Yakuni ──────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ 24/7 ishonchlilik sozlandi"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Tekshirish:"
echo "  • Watchdog log:   tail -f /var/log/marketplace-watchdog.log"
echo "  • Backup log:     tail -f /var/log/marketplace-backup.log"
echo "  • Fail2ban:       sudo fail2ban-client status sshd"
echo "  • Cron'lar:       cat /etc/cron.d/marketplace-*"
echo "  • Swap:           free -h"
echo ""
echo "Telegram bildirishnoma uchun (agar hali kiritmagan bo'lsangiz):"
echo "  sudo nano ${ENV_FILE}"
echo ""
echo "Qo'lda backup test:"
echo "  sudo bash ${APP_DIR}/deploy/backup.sh"
echo ""
echo "Qo'lda watchdog test:"
echo "  sudo bash ${APP_DIR}/deploy/watchdog.sh"
