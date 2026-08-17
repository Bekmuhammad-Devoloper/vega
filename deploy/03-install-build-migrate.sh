#!/usr/bin/env bash
# Hamma loyihalarni install + build qiladi + Prisma migrate
set -euo pipefail
APP_DIR="/opt/marketplace"

echo "═══════════════════════════════════════════════════════════"
echo "  Install + Build + Migrate"
echo "═══════════════════════════════════════════════════════════"

# ─── 1. BACKEND ───────────────────────────────────────────────
echo ""
echo "▶ [1/5] BACKEND: install + prisma + build"
cd "${APP_DIR}/backend"
npm install --no-audit --no-fund 2>&1 | tail -5
echo "  → npm install"
npx prisma generate 2>&1 | tail -3
echo "  → prisma generate"
npx prisma migrate deploy 2>&1 | tail -10
echo "  → prisma migrate deploy"
npx prisma db seed 2>&1 | tail -10 || echo "  ⚠ seed o'tkazib yuborildi"
# Super admin seed (faqat boshlang'ich)
SUPER_SEED_DEMO=0 npx ts-node prisma/seed-super.ts 2>&1 | tail -10 || echo "  ⚠ super seed o'tkazib yuborildi"
echo "  → seeds"
npm run build 2>&1 | tail -5
echo "  ✓ backend build tugadi"
ls -la dist/src/main.js >/dev/null && echo "  ✓ dist/src/main.js mavjud"

# ─── 2. WEBAPP ────────────────────────────────────────────────
echo ""
echo "▶ [2/5] WEBAPP: install + build"
cd "${APP_DIR}/webapp"
npm install --legacy-peer-deps --no-audit --no-fund 2>&1 | tail -3
echo "  → install"
npm run build 2>&1 | tail -8
echo "  ✓ webapp build tugadi"

# ─── 3. ADMIN ─────────────────────────────────────────────────
echo ""
echo "▶ [3/5] ADMIN: install + build"
cd "${APP_DIR}/admin"
npm install --legacy-peer-deps --no-audit --no-fund 2>&1 | tail -3
echo "  → install"
npm run build 2>&1 | tail -8
echo "  ✓ admin build tugadi"

# ─── 4. SUPERADMIN ────────────────────────────────────────────
echo ""
echo "▶ [4/5] SUPERADMIN: install + build"
cd "${APP_DIR}/superadmin"
npm install --legacy-peer-deps --no-audit --no-fund 2>&1 | tail -3
echo "  → install"
npm run build 2>&1 | tail -8
echo "  ✓ superadmin build tugadi"

# ─── 5. LANDING ───────────────────────────────────────────────
echo ""
echo "▶ [5/5] LANDING: install (build kerakmas)"
cd "${APP_DIR}/landing"
npm install --no-audit --no-fund 2>&1 | tail -3
echo "  ✓ landing tayyor"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ HAMMA BUILD TAYYOR"
echo "═══════════════════════════════════════════════════════════"
# Artefakt tekshiruvi — informatsion (set -e ni uzmasin)
ls -la \
    "${APP_DIR}/backend/dist/src/main.js" \
    "${APP_DIR}/webapp/.next/BUILD_ID" \
    "${APP_DIR}/admin/.next/BUILD_ID" \
    "${APP_DIR}/superadmin/.next/BUILD_ID" \
    "${APP_DIR}/landing/server/index.js" 2>&1 || true
