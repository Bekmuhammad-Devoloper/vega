#!/usr/bin/env bash
# Repo'ni clone qiladi yoki pull qiladi
set -euo pipefail

APP_DIR="/opt/marketplace"
REPO_URL="${REPO_URL:-https://github.com/Ziyodillokh/marketplace.git}"
BRANCH="${BRANCH:-main}"

echo "═══════════════════════════════════════════════════════════"
echo "  Repo clone / pull"
echo "  URL:    ${REPO_URL}"
echo "  Branch: ${BRANCH}"
echo "  Dir:    ${APP_DIR}"
echo "═══════════════════════════════════════════════════════════"

mkdir -p "${APP_DIR}/logs" "${APP_DIR}/uploads"

if [ -d "${APP_DIR}/.git" ]; then
    echo "▶ Repo bor — pull qilamiz"
    cd "${APP_DIR}"
    git fetch origin
    git reset --hard "origin/${BRANCH}"
else
    echo "▶ Repo'ni clone qilamiz"
    if [ "$(ls -A "${APP_DIR}" 2>/dev/null)" ]; then
        echo "  ⚠ ${APP_DIR} bo'sh emas, content nusxalanadi"
        TMP_DIR=$(mktemp -d)
        git clone --branch "${BRANCH}" "${REPO_URL}" "${TMP_DIR}/repo"
        shopt -s dotglob
        cp -r "${TMP_DIR}/repo"/* "${APP_DIR}/"
        cp -r "${TMP_DIR}/repo"/.git "${APP_DIR}/"
        rm -rf "${TMP_DIR}"
    else
        git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
    fi
fi

cd "${APP_DIR}"
echo ""
echo "▶ Oxirgi 3 commit:"
git log --oneline -3
echo ""
echo "▶ Loyiha tarkibi:"
ls -la
echo ""
echo "✓ Repo tayyor"
