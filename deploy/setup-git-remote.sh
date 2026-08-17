#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# SERVERDA BIR MARTA ishga tushiriladi:  bash setup-git-remote.sh
#
# Bare repo + post-receive hook yaratadi. Shundan keyin lokal mashinadan
# `git push production master` qilsangiz — avtomatik build va pm2 reload.
#
# Faqat BACKEND'ni qayta quradi. Frontendlar (webapp/admin/superadmin/landing)
# tegilmaydi — ular kamdan-kam o'zgaradi va build'i og'ir. Ularni yangilash
# uchun pastdagi izohga qarang.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

REPO_DIR="${REPO_DIR:-/root/repos/vega-saas.git}"
WORK_DIR="${WORK_DIR:-/var/www/vega-saas}"
PM2_NAME="${PM2_NAME:-vega-backend}"

echo "==> Tekshiruv"
[ -d "$WORK_DIR" ] || { echo "XATO: $WORK_DIR yo'q. WORK_DIR=... bering"; exit 1; }
command -v pm2 >/dev/null || { echo "XATO: pm2 topilmadi"; exit 1; }

echo "==> Bare repo: $REPO_DIR"
mkdir -p "$(dirname "$REPO_DIR")"
if [ -d "$REPO_DIR" ]; then
  echo "    allaqachon bor — o'tkazildi"
else
  git init --bare -q "$REPO_DIR"
  echo "    yaratildi"
fi

echo "==> post-receive hook"
cat > "$REPO_DIR/hooks/post-receive" <<HOOK
#!/usr/bin/env bash
set -euo pipefail
WORK_DIR="$WORK_DIR"
PM2_NAME="$PM2_NAME"

echo "──> Kod yoyilmoqda -> \$WORK_DIR"
# .env, node_modules, dist kuzatilmagan -> tegilmaydi
git --work-tree="\$WORK_DIR" --git-dir="$REPO_DIR" checkout -f master

cd "\$WORK_DIR/backend"
echo "──> npm ci"
npm ci --omit=dev --no-audit --no-fund || npm install --no-audit --no-fund

echo "──> prisma generate"
npx prisma generate

echo "──> build"
npx nest build

echo "──> pm2 reload \$PM2_NAME"
pm2 reload "\$PM2_NAME" --update-env
sleep 3
pm2 describe "\$PM2_NAME" | grep -E "status" || true
echo "──> ✅ backend yangilandi"
echo "    Frontend kerak bo'lsa qo'lda:"
echo "      cd \$WORK_DIR/<webapp|admin|superadmin> && npm ci && npm run build && pm2 reload vega-<nom>"
HOOK
chmod +x "$REPO_DIR/hooks/post-receive"
echo "    yozildi"

echo
echo "✅ Tayyor. Endi LOKAL mashinangizda:"
echo
echo "   cd /c/Users/user/Desktop/vega"
echo "   git remote add production root@$(hostname -I 2>/dev/null | awk '{print $1}'):$REPO_DIR"
echo "   git push production master"
echo
echo "   Diqqat: .env serverda o'zgarmaydi — iStar kalitini alohida qo'shing:"
echo "     cd $WORK_DIR/backend && grep -q ISTAR_API_KEY .env || cat >> .env"
