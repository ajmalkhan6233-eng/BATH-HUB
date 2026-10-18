'use strict';
// BUTTON-BY-BUTTON AUDIT (run on the shop PC by Claude Code, TEST_MODE only).
//   AUDIT_USER=... AUDIT_PASS=... node scripts/audit/crawl.js [baseUrl]      (default http://127.0.0.1:3100)
// For every page in public/*.html: opens it, records console errors, page crashes and failed /api calls (4xx/5xx),
// then clicks every visible button / tab / link-button that is not destructive and records what each click broke.
// REFUSES to run unless /api/test-mode says the shop is in TEST_MODE. Never clicks delete / void / reject / wipe / logout / send.
// Output: audit_out/crawl.json and audit_out/crawl.md (short, one line per finding).
const fs = require('fs'); const path = require('path');
const BASE = (process.argv[2] || process.env.AUDIT_BASE || 'http://127.0.0.1:3100').replace(/\/$/, '');
const OUT = path.join(__dirname, '..', '..', 'audit_out');
const SKIP_TEXT = /delete|remove|void|reject|wipe|reset|clear|logout|log out|sign out|send|whatsapp|disable|deactivate|restore|import|upload|take photo|download|print|confirm and file|^file$|cancel cheque|bounce|close day|lock/i;
const MAX_CLICKS = Number(process.env.AUDIT_MAX_CLICKS || 60);

(async () => {
  let pw; try { pw = require('playwright'); } catch (e) { console.error('Playwright is not installed. Run: npm i --no-save playwright'); process.exit(2); }
  const t = await fetch(BASE + '/api/test-mode').then((r) => r.json()).catch(() => ({}));
  if (!t.test) { console.error('REFUSED: the shop is not in TEST_MODE. Nothing was opened.'); process.exit(3); }
  fs.mkdirSync(OUT, { recursive: true });
  const pages = fs.readdirSync(path.join(__dirname, '..', '..', 'public')).filter((f) => f.endsWith('.html')).sort();
  let browser; try { browser = await pw.chromium.launch({ channel: 'chrome', headless: true }); } catch (e) { browser = await pw.chromium.launch({ headless: true }); }
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const login = await ctx.request.post(BASE + '/api/login', { data: { username: process.env.AUDIT_USER, password: process.env.AUDIT_PASS } });
  if (!login.ok()) { console.error('Login failed (' + login.status() + '). Set AUDIT_USER / AUDIT_PASS.'); process.exit(4); }

  const report = [];
  for (const file of pages) {
    const page = await ctx.newPage(); const rec = { page: file, load: 0, consoleErrors: [], pageErrors: [], badApi: [], clicked: 0, skipped: 0, clickFindings: [] };
    let phase = 'load';
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_BLOCKED|net::ERR_ABORTED/.test(m.text())) (phase === 'load' ? rec.consoleErrors : rec.clickFindings).push(phase === 'load' ? m.text().slice(0, 160) : { at: phase, console: m.text().slice(0, 160) }); });
    page.on('pageerror', (e) => (phase === 'load' ? rec.pageErrors : rec.clickFindings).push(phase === 'load' ? e.message.slice(0, 160) : { at: phase, crash: e.message.slice(0, 160) }));
    page.on('response', (r) => { const u = r.url(); if (u.includes('/api/') && r.status() >= 400 && r.status() !== 401) (phase === 'load' ? rec.badApi : rec.clickFindings).push(phase === 'load' ? `${r.status()} ${u.replace(BASE, '')}`.slice(0, 140) : { at: phase, api: `${r.status()} ${u.replace(BASE, '')}`.slice(0, 140) }); });
    try {
      const resp = await page.goto(`${BASE}/${file}`, { waitUntil: 'networkidle', timeout: 25000 }); rec.load = resp ? resp.status() : 0;
      await page.waitForTimeout(600);
      const sel = 'button, [role=tab], [role=button], .tab, .nav-item, input[type=button], a.btn';
      const total = await page.locator(sel).count();
      for (let i = 0; i < Math.min(total, MAX_CLICKS * 3) && rec.clicked < MAX_CLICKS; i++) {
        const el = page.locator(sel).nth(i);
        if (!(await el.isVisible().catch(() => false)) || !(await el.isEnabled().catch(() => false))) continue;
        const label = ((await el.innerText().catch(() => '')) || (await el.getAttribute('aria-label').catch(() => '')) || (await el.getAttribute('title').catch(() => '')) || (await el.getAttribute('onclick').catch(() => '')) || '').replace(/\s+/g, ' ').trim().slice(0, 40);
        if (SKIP_TEXT.test(label)) { rec.skipped++; continue; }
        phase = `click "${label || '(no label)'}"`;
        await el.click({ timeout: 2500, trial: false }).catch(() => {});
        await page.waitForTimeout(250); rec.clicked++;
        if (!page.url().startsWith(`${BASE}/${file}`)) { await page.goto(`${BASE}/${file}`, { waitUntil: 'domcontentloaded' }).catch(() => {}); await page.waitForTimeout(300); }
        phase = 'idle';
      }
    } catch (e) { rec.pageErrors.push('could not open: ' + e.message.slice(0, 120)); }
    await page.close(); report.push(rec);
    process.stdout.write(`${file}: load ${rec.load}, clicked ${rec.clicked}, findings ${rec.consoleErrors.length + rec.pageErrors.length + rec.badApi.length + rec.clickFindings.length}\n`);
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'crawl.json'), JSON.stringify(report, null, 1));
  const bad = report.filter((r) => r.load !== 200 || r.consoleErrors.length || r.pageErrors.length || r.badApi.length || r.clickFindings.length);
  const lines = [`# Crawl ${new Date().toISOString().slice(0, 16)}: ${report.length} pages, ${report.reduce((a, r) => a + r.clicked, 0)} buttons clicked, ${bad.length} pages with findings`];
  for (const r of bad) {
    lines.push(`- ${r.page} (load ${r.load}, clicked ${r.clicked})`);
    [...r.pageErrors.map((x) => 'CRASH ' + x), ...r.consoleErrors.map((x) => 'console ' + x), ...r.badApi.map((x) => 'api ' + x), ...r.clickFindings.map((x) => `${x.at}: ${x.crash || x.console || x.api}`)].slice(0, 8).forEach((x) => lines.push('    ' + x));
  }
  fs.writeFileSync(path.join(OUT, 'crawl.md'), lines.join('\n') + '\n');
  console.log(lines[0] + '\nFull list: audit_out/crawl.md');
})().catch((e) => { console.error('audit crashed:', e.message); process.exit(1); });
