/* Robust auto-tunnel keeper.
 * Provider'lar tartibi: tunnelmole → localtunnel → ngrok (authtoken bilan).
 * Health check qiladi va URL'ni .tunnel-url ga yozadi.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORT = Number(process.env.TUNNEL_PORT || 5174);
const SUBDOMAIN = process.env.TUNNEL_SUBDOMAIN || undefined;
const NGROK_TOKEN = process.env.NGROK_AUTHTOKEN || '';
const URL_FILE = path.join(__dirname, '.tunnel-url');
const RETRY_MS = 5000;
const HEALTH_CHECK_INTERVAL_MS = 60_000;

let currentTunnel = null;
let currentUrl = null;

function writeUrl(url) {
  try {
    fs.writeFileSync(URL_FILE, (url || '') + '\n');
    console.log(`[tunnel] wrote URL: ${url}`);
  } catch (e) {
    console.error(`[tunnel] failed to write URL: ${e.message}`);
  }
}

function clearUrl() {
  try { fs.existsSync(URL_FILE) && fs.unlinkSync(URL_FILE); } catch { /* ignore */ }
}

function singleCheck(url, timeoutMs) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const req = https.request(
        {
          hostname: u.hostname,
          port: u.port || 443,
          path: '/api/banners?placement=home',
          method: 'GET',
          headers: {
            'bypass-tunnel-reminder': '1',
            'user-agent': 'Mozilla/5.0',
            'ngrok-skip-browser-warning': '1',
          },
          timeout: timeoutMs,
        },
        (res) => {
          const ok = res.statusCode >= 200 && res.statusCode < 400;
          resolve(ok);
          res.resume();
        },
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.end();
    } catch {
      resolve(false);
    }
  });
}

/** 5 marta urinib ko'radi — tunnel cold-start ko'p vaqt oladi. */
async function checkUrl(url) {
  for (const timeout of [25_000, 20_000, 15_000, 15_000, 15_000]) {
    const ok = await singleCheck(url, timeout);
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

async function tryTunnelmole() {
  // tunnelmole is ESM, use dynamic import
  const mod = await import('tunnelmole');
  const tunnelmole = mod.tunnelmole || mod.default;
  const url = await tunnelmole({ port: PORT });
  return {
    name: 'tunnelmole',
    url,
    close: async () => { /* exit handles */ },
    onClose: () => { /* no event */ },
    onError: () => { /* no event */ },
  };
}

async function tryLocaltunnel() {
  const localtunnel = require('localtunnel');
  const tunnel = await localtunnel({ port: PORT, ...(SUBDOMAIN ? { subdomain: SUBDOMAIN } : {}) });
  return {
    name: 'localtunnel',
    url: tunnel.url,
    close: () => tunnel.close && tunnel.close(),
    onClose: (cb) => tunnel.on('close', cb),
    onError: (cb) => tunnel.on('error', cb),
  };
}

async function tryNgrok() {
  if (!NGROK_TOKEN) throw new Error('NGROK_AUTHTOKEN not set');
  const ngrok = require('@ngrok/ngrok');
  const listener = await ngrok.forward({ addr: PORT, authtoken: NGROK_TOKEN });
  return {
    name: 'ngrok',
    url: listener.url(),
    close: async () => { try { await listener.close(); } catch { /* ignore */ } },
    onClose: () => { /* no event */ },
    onError: () => { /* no event */ },
  };
}

// Tartibi: localtunnel birinchi (tunnelmole rate-limited), keyin tunnelmole, keyin ngrok
const PROVIDERS = [
  { name: 'localtunnel', fn: tryLocaltunnel },
  { name: 'tunnelmole', fn: tryTunnelmole },
  { name: 'ngrok', fn: tryNgrok },
];

async function connect() {
  for (const provider of PROVIDERS) {
    try {
      console.log(`[tunnel] trying ${provider.name} on port ${PORT}...`);
      const t = await Promise.race([
        provider.fn(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('start timeout')), 30_000)),
      ]);
      console.log(`[tunnel] ${provider.name} ulandi: ${t.url}`);

      const ok = await checkUrl(t.url);
      if (!ok) {
        console.warn(`[tunnel] ${provider.name} health check FAILED, keyingisini sinaymiz...`);
        try { await t.close(); } catch { /* ignore */ }
        continue;
      }

      currentTunnel = t;
      currentUrl = t.url;
      writeUrl(t.url);
      console.log(`[tunnel] ✓ READY: ${t.url}`);

      if (t.onError) t.onError((err) => {
        console.error(`[tunnel] runtime error: ${err.message}`);
        reconnect();
      });
      if (t.onClose) t.onClose(() => {
        console.warn('[tunnel] closed — reconnecting');
        reconnect();
      });
      return;
    } catch (err) {
      console.error(`[tunnel] ${provider.name} failed: ${err.message}`);
    }
  }
  console.warn(`[tunnel] no provider worked, retry in ${RETRY_MS}ms...`);
  setTimeout(connect, RETRY_MS);
}

let reconnecting = false;
function reconnect() {
  if (reconnecting) return;
  reconnecting = true;
  setTimeout(async () => {
    try { currentTunnel && (await currentTunnel.close()); } catch { /* ignore */ }
    currentTunnel = null;
    currentUrl = null;
    clearUrl();
    reconnecting = false;
    connect();
  }, RETRY_MS);
}

// Periodic health check — faqat KETMA-KET 3 marta fail bo'lsa reconnect qiladi.
// Bu tunnel'ni stabilroq qiladi va network blip'lar uchun URL'ni o'zgartirib yubormaydi.
let failStreak = 0;
const MAX_FAIL_STREAK = 3;
setInterval(async () => {
  if (!currentUrl) return;
  const ok = await checkUrl(currentUrl);
  if (!ok) {
    failStreak += 1;
    console.warn(`[tunnel] health check failed (${failStreak}/${MAX_FAIL_STREAK})`);
    if (failStreak >= MAX_FAIL_STREAK) {
      console.warn('[tunnel] reconnecting...');
      failStreak = 0;
      reconnect();
    }
  } else {
    if (failStreak > 0) console.log('[tunnel] health restored');
    failStreak = 0;
  }
}, HEALTH_CHECK_INTERVAL_MS);

process.on('SIGINT', async () => {
  try { currentTunnel && (await currentTunnel.close()); } catch { /* ignore */ }
  clearUrl();
  process.exit(0);
});

connect();
