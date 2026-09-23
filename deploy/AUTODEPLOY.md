# Avtodeploy (tortib oluvchi usul)

Server **62.171.184.14**. Kod `saas` branchidan serverga **o'zi** tushadi —
GitHub'dan serverga SSH qilinmaydi.

## Nega bunday

Avvalgi sxema GitHub Actions'dan serverga SSH kaliti bilan kirardi. Yangi
server (62.171.184.14) esa **parol bilan ishlaydi — unda SSH kaliti yo'q**,
GitHub Actions'dan parol bilan kirish esa xavfsiz emas va ishlamaydi.

Repo public, shuning uchun serverning o'zi tortib olishi eng sodda yo'l:
hech qanday kalit, hech qanday secret kerak emas, sindiradigan joyi yo'q.
Shu sababli workflow'dagi `deploy` job butunlay olib tashlandi va
`.github/workflows/check.yml` faqat sifat darvozasi bo'lib qoldi.

## Qanday ishlaydi

`vega-autodeploy.timer` (systemd) har daqiqada `/opt/vega/autodeploy.sh` ni
chaqiradi. Skript:

1. `git ls-remote` bilan `saas` boshini joriy HEAD bilan solishtiradi;
2. farq bo'lsa — o'sha commit uchun GitHub'dagi **`check`** job (tsc + nest
   build) muvaffaqiyatli tugaganini tekshiradi. **Sifat darvozasi shu yerda
   saqlanadi: `check` yiqilsa kod serverga chiqmaydi;**
3. `check` umuman yo'q bo'lsa (workflow'da `paths-ignore: **.md` bor, faqat
   hujjat o'zgarsa u ishga tushmaydi) — 5 daqiqa kutib, keyin deploy qiladi;
4. `/opt/vega/deploy.sh saas` ni ishga tushiradi va `127.0.0.1:2400` sog'lig'ini
   tekshiradi.

Jurnal: `/opt/vega/autodeploy.log`.

## Foydali buyruqlar

```bash
systemctl list-timers vega-autodeploy     # keyingi ishga tushish vaqti
tail -f /opt/vega/autodeploy.log          # jarayonni kuzatish
bash /opt/vega/autodeploy.sh              # darhol tekshirish (kutmasdan)
systemctl disable --now vega-autodeploy.timer   # vaqtincha to'xtatish
```

## Tuzoqlar

- **`HOME` o'rnatilishi shart.** systemd `oneshot` muhitida `HOME` bo'lmaydi
  va pm2 `/root/.pm2` o'rniga `/etc/.pm2` ga qaraydi — natijada ishlab turgan
  jarayonlarni topolmay `Process or Namespace vega-backend not found` beradi.
  Service faylida `Environment=HOME=/root` va `PM2_HOME=/root/.pm2` bor.
- **`flock`** bilan bir vaqtda bitta nusxa ishlaydi (deploy 1 daqiqadan uzoq
  cho'zilsa keyingi taymer uni bosib ketmasin).
- Bu serverda **boshqa loyihalar bor** — `pm2 delete all`, `docker system
  prune`, `systemctl restart nginx` kabi umumiy buyruqlar berilmaydi.
