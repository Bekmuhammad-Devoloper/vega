#!/bin/bash
echo "=== PORTS 2000-2500 in use ==="
ss -tln | awk 'NR>1 {split($4,a,":"); p=a[length(a)]; if (p>=2000 && p<=2500) print p}' | sort -u
echo "=== Disk ==="
df -h / | tail -1
echo "=== RAM ==="
free -h | head -2
echo "=== certbot ==="
which certbot && certbot --version || echo "certbot: NOT installed"
echo "=== redis ==="
which redis-server && redis-cli --version || echo "redis: NOT installed"
echo "=== PG access ==="
sudo -u postgres psql -tc "SELECT version();" 2>/dev/null | head -1 || echo "PG access: FAIL"
echo "=== Existing marketplace folder ==="
ls -la /opt/marketplace 2>/dev/null || echo "NOT exists"
ls -la /var/www/marketplace 2>/dev/null || echo "NOT exists"
echo "=== HTTP listening ==="
ss -tln | grep -E ':80 |:443 ' || echo "no http"
echo "=== /etc/nginx/sites-enabled ==="
ls /etc/nginx/sites-enabled/
echo "=== Existing PG databases ==="
sudo -u postgres psql -l 2>/dev/null | awk 'NR>3 && /^[ ]+[a-z]/ {print $1}' | grep -v template
