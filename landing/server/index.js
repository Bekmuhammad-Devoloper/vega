const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 2404;
const ROOT = path.join(__dirname, '..');

app.disable('x-powered-by');

// Statik fayllar (rasmlar, css, js) — root'dagi va public/ ichidagi
app.use(express.static(ROOT, {
  maxAge: '1d',
  extensions: ['html'],
  index: false,
}));

const publicDir = path.join(ROOT, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir, { maxAge: '1d', index: false }));
}

// /signup — agar mavjud bo'lsa signup.html, yo'q bo'lsa index.html
app.get('/signup', (_req, res) => {
  const signupPath = path.join(ROOT, 'signup.html');
  const publicSignup = path.join(publicDir, 'signup.html');
  if (fs.existsSync(signupPath)) return res.sendFile(signupPath);
  if (fs.existsSync(publicSignup)) return res.sendFile(publicSignup);
  res.redirect('/');
});

// Root — index.html
app.get('/', (_req, res) => {
  const rootIndex = path.join(ROOT, 'index.html');
  const publicIndex = path.join(publicDir, 'index.html');
  if (fs.existsSync(rootIndex)) return res.sendFile(rootIndex);
  if (fs.existsSync(publicIndex)) return res.sendFile(publicIndex);
  res.status(404).send('Landing index.html not found');
});

// SPA fallback (har qanday boshqa yo'l → index.html)
app.get(/^\/(?!api|assets|.*\.(?:jpg|jpeg|png|gif|webp|svg|ico|css|js|woff2?|ttf|map)$).*/, (_req, res) => {
  const rootIndex = path.join(ROOT, 'index.html');
  if (fs.existsSync(rootIndex)) return res.sendFile(rootIndex);
  res.status(404).send('Not found');
});

// Health
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'landing' }));

app.listen(PORT, () => {
  console.log(`✅ Landing server running on http://localhost:${PORT}`);
  console.log(`   /          → index.html`);
  console.log(`   /signup    → signup.html (yoki index)`);
  console.log(`   /health    → JSON status`);
  console.log(`   /<file>    → static assets (jpg/png/css/js)`);
});
