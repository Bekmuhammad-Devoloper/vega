#!/usr/bin/env bash
# Vega avtodeploy - TORTIB OLUVCHI (pull) usul.
#
# NEGA: GitHub Actions'dan serverga SSH bilan kirish ishlamadi (runner
# tomonidagi maxfiy kalit muammosi, uch marta tuzatishga urinildi). Repo
# PUBLIC, shuning uchun serverning o'zi GitHub'dan tortib olsa - hech
# qanday kalit, hech qanday secret kerak emas va sindiradigan joyi yo'q.
#
# Ishlashi: har daqiqada `git ls-remote` bilan `saas` boshini tekshiradi.
# Farq bo'lsa - o'sha commit uchun GitHub'dagi `check` (tsc + build)
# muvaffaqiyatli tugaganini kutadi va shundan keyingina deploy qiladi.
# Ya'ni sifat darvozasi saqlanib qoladi: buzuq kod serverga chiqmaydi.
set -u
# systemd oneshot muhitida HOME bo'lmaydi; pm2 unda /etc/.pm2 ga qarab
# ishlab turgan jarayonlarni topolmaydi ("Process not found").
export HOME="${HOME:-/root}"
export PM2_HOME="${PM2_HOME:-/root/.pm2}"
REPO="Bekmuhammad-Devoloper/vega"
BRANCH="saas"
APP="/opt/vega/app"
LOG="/opt/vega/autodeploy.log"

log() { echo "$(date '+%F %T') | $*" >> "$LOG"; }

cd "$APP" 2>/dev/null || { log "app papkasi yo'q"; exit 0; }

LOCAL=$(git rev-parse HEAD 2>/dev/null)
REMOTE=$(git ls-remote origin "refs/heads/$BRANCH" 2>/dev/null | cut -f1)
[ -n "$REMOTE" ] || { log "ls-remote javob bermadi"; exit 0; }
[ "$LOCAL" = "$REMOTE" ] && exit 0

# Yangi commit bor. `check` job holatini so'raymiz (anonim, public repo).
STATE=$(curl -s -m 25 "https://api.github.com/repos/$REPO/commits/$REMOTE/check-runs" \
  | python3 -c "
import sys, json
try: runs = json.load(sys.stdin).get('check_runs', [])
except Exception: print('API_XATO'); raise SystemExit
chk = [r for r in runs if r['name'] == 'check']
if not chk: print('YOQ')
elif any(r['status'] != 'completed' for r in chk): print('KETYAPTI')
elif all(r['conclusion'] == 'success' for r in chk): print('OK')
else: print('YIQILDI')
" 2>/dev/null)

# Commit yoshi: workflow'da `paths-ignore: **.md` bor, shuning uchun faqat
# hujjat o'zgargan commitda `check` UMUMAN ishga tushmaydi. Bunday commitni
# abadiy kutib qolmaslik uchun 5 daqiqadan keyin baribir deploy qilamiz.
git fetch --depth=1 -q origin "$BRANCH" 2>/dev/null
AGE=$(( $(date +%s) - $(git log -1 --format=%ct FETCH_HEAD 2>/dev/null || date +%s) ))

case "$STATE" in
  OK)        log "yangi commit ${REMOTE:0:7} - check o'tdi, deploy boshlandi" ;;
  KETYAPTI)  exit 0 ;;                      # hali tugamagan, keyingi daqiqada
  YIQILDI)   log "commit ${REMOTE:0:7} - check YIQILDI, deploy QILINMAYDI"; exit 0 ;;
  YOQ)       if [ "$AGE" -gt 300 ]; then
               log "commit ${REMOTE:0:7} - check yo'q (hujjat o'zgarishi bo'lsa kerak), ${AGE}s kutildi, deploy"
             else
               exit 0
             fi ;;
  *)         log "commit ${REMOTE:0:7} - check holati aniqlanmadi ($STATE), kutamiz"; exit 0 ;;
esac

if SKIP_FRONTEND="${SKIP_FRONTEND:-1}" bash /opt/vega/deploy.sh "$BRANCH" >> "$LOG" 2>&1; then
  NEW=$(git -C "$APP" rev-parse --short HEAD)
  for i in 1 2 3 4 5 6 7 8 9 10; do
    code=$(curl -s -o /dev/null -w '%{http_code}' -m 10 http://127.0.0.1:2400/api/catalog/services || echo 000)
    [ "$code" = "200" ] && { log "deploy TUGADI: $NEW (sog'liq $code)"; exit 0; }
    sleep 6
  done
  log "deploy tugadi ($NEW) lekin SOG'LIQ TEKSHIRUVI O'TMADI"
else
  log "deploy YIQILDI (yuqoridagi jurnalga qarang)"
fi
