/* Auto-reconnecting localtunnel keeper.
 * Tunnel uziladigan bo'lsa avtomatik qayta ulanadi va URL ni log'ga yozadi.
 */
const localtunnel = require('localtunnel');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.TUNNEL_PORT || 5174);
const SUBDOMAIN = process.env.TUNNEL_SUBDOMAIN || undefined;
const URL_FILE = path.join(__dirname, '..', '.tunnel-url');
const RETRY_MS = 3000;

let current = null;

function writeUrl(url) {
  try {
    fs.writeFileSync(URL_FILE, url + '\n');
  } catch (e) { /* ignore */ }
}

async function connect() {
  try {
    console.log(`[tunnel] connecting on port ${PORT}...`);
    current = await localtunnel({ port: PORT, subdomain: SUBDOMAIN });
    console.log(`[tunnel] URL: ${current.url}`);
    writeUrl(current.url);

    current.on('error', (err) => {
      console.error(`[tunnel] error: ${err.message}`);
      reconnect();
    });
    current.on('close', () => {
      console.warn('[tunnel] closed — reconnecting');
      reconnect();
    });
  } catch (err) {
    console.error(`[tunnel] connect failed: ${err.message}`);
    setTimeout(connect, RETRY_MS);
  }
}

function reconnect() {
  try { current && current.close && current.close(); } catch (e) { /* ignore */ }
  current = null;
  setTimeout(connect, RETRY_MS);
}

process.on('SIGINT', () => {
  if (current) current.close();
  process.exit(0);
});

connect();
