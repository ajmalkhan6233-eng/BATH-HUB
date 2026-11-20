'use strict';
// SCREEN GUARD: after any front-end change, every screen AJ uses must still be there.
//  STATIC check (always works, no browser): compares the app folder with golden/screens.golden.json, made from the known-good copy
//    (branch claude/rbh-good-20nov, 20 Nov): every page file, every menu entry (key + label), every route file the server loads.
//  RUNTIME check (when GUARD_APP_URL is set and Chrome is there): opens the app, looks for every menu label, no console or page errors.
//  node src/screen_guard.js --make-golden <appDir>      write the golden list from a known-good folder
//  node src/screen_guard.js --check <appDir> [--url http://localhost:3000]
const fs = require('fs'); const path = require('path');
const GOLDEN = path.join(__dirname, '..', 'golden', 'screens.golden.json');
function manifest(dir) {
  const pub = path.join(dir, 'public'); const m = { pages: [], menu: [], routes: [] };
  if (fs.existsSync(pub)) m.pages = fs.readdirSync(pub).filter((f) => f.endsWith('.html')).sort();
  const mb = path.join(pub, 'menubar.js');
  if (fs.existsSync(mb)) {
    const t = fs.readFileSync(mb, 'utf8'); const seen = new Set();
    for (const x of t.matchAll(/\[\s*'([A-Za-z0-9:_-]+)'\s*,\s*'((?:[^'\\]|\\.)*)'/g)) { if (x[1] === '--') continue; const k = x[1] + '|' + x[2]; if (!seen.has(k)) { seen.add(k); m.menu.push(k); } }
    for (const x of t.matchAll(/key:\s*'([A-Za-z0-9_-]+)'\s*,\s*label:\s*'((?:[^'\\]|\\.)*)'/g)) { const k = x[1] + '|' + x[2]; if (!seen.has(k)) { seen.add(k); m.menu.push(k); } }
  }
  const sv = path.join(dir, 'server.js');
  if (fs.existsSync(sv)) { const s = new Set(); for (const x of fs.readFileSync(sv, 'utf8').matchAll(/require\('\.\/routes\/([A-Za-z0-9_]+)'\)/g)) s.add(x[1]); m.routes = [...s].sort(); }
  m.menu.sort(); return m;
}
function check(dir) {
  const g = JSON.parse(fs.readFileSync(GOLDEN, 'utf8')); const now = manifest(dir); const fails = [];
  for (const k of ['pages', 'menu', 'routes']) { const have = new Set(now[k]); for (const x of g[k]) if (!have.has(x)) fails.push(`missing ${({ pages: 'page', menu: 'menu entry', routes: 'route' })[k]}: ${x}`); }
  return { ok: fails.length === 0, fails, counts: { pages: g.pages.length, menu: g.menu.length, routes: g.routes.length } };
}
async function runtime(url) {
  const g = JSON.parse(fs.readFileSync(GOLDEN, 'utf8')); const fails = [];
  let chromium; try { ({ chromium } = require('playwright')); } catch (e) { return { ok: null, fails: ['runtime check skipped: playwright is not installed'] }; }
  const exe = process.env.GUARD_CHROME || ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p));
  const br = await chromium.launch({ executablePath: exe, headless: true });
  try {
    const pg = await br.newPage(); const errs = [];
    pg.on('pageerror', (e) => errs.push('page error: ' + e.message)); pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text().slice(0, 120)); });
    const res = await pg.goto(url, { waitUntil: 'load', timeout: 30000 }); if (!res || res.status() >= 400) fails.push(`${url} answered ${res && res.status()}`);
    await pg.waitForTimeout(1500);
    const text = await pg.evaluate(() => document.body.innerText + ' ' + Array.from(document.querySelectorAll('[aria-label],[title]')).map((e) => (e.getAttribute('aria-label') || '') + ' ' + (e.getAttribute('title') || '')).join(' '));
    const top = (g.menu_groups || []).filter((x) => !text.includes(x)); top.forEach((x) => fails.push('menu group not visible: ' + x));
    errs.slice(0, 5).forEach((e) => fails.push(e));
  } finally { await br.close(); }
  return { ok: fails.length === 0, fails };
}
if (require.main === module) {
  const a = process.argv.slice(2);
  (async () => {
    if (a[0] === '--make-golden') { const m = manifest(a[1]); m.menu_groups = ['Inventory', 'Vendors', 'Sales', 'Banking & Money', 'Customers & Online', 'Layla', 'Reports', 'File']; fs.writeFileSync(GOLDEN, JSON.stringify(m, null, 1)); console.log(`golden written: ${m.pages.length} pages, ${m.menu.length} menu entries, ${m.routes.length} routes`); return; }
    if (a[0] === '--check') { const r = check(a[1]); console.log(r.ok ? `SCREENS OK (${r.counts.pages} pages, ${r.counts.menu} menu entries, ${r.counts.routes} routes)` : 'SCREENS MISSING:\n  ' + r.fails.join('\n  '));
      const u = a.includes('--url') ? a[a.indexOf('--url') + 1] : null; if (u) { const q = await runtime(u); console.log(q.ok === null ? q.fails[0] : q.ok ? 'RUNTIME OK' : 'RUNTIME FAIL:\n  ' + q.fails.join('\n  ')); if (q.ok === false) process.exitCode = 1; }
      if (!r.ok) process.exitCode = 1; return; }
    console.log('usage: --make-golden <appDir> | --check <appDir> [--url URL]');
  })();
}
module.exports = { manifest, check, runtime };
