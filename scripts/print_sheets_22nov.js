'use strict';
// READ-ONLY. Makes two A4 PDFs on the Desktop (AJ 22 Nov). Changes nothing in the database.
//   1) RBH_STOCK_COUNT_SHEET.pdf : every item on sale, sorted by code, with the app stock and an empty box for the counted number.
//   2) RBH_LABELS_REPRINT_22NOV.pdf : price labels for every ON-SALE item whose code changed on 22 Nov (read from CODE_MAP_22NOV.md).
// node scripts/print_sheets_22nov.js [path\to\CODE_MAP_22NOV.md] [outDir]
// Defaults: C:\Users\Sony\ai-bridge\AI_BRIDGE\CODE_MAP_22NOV.md and the user's Desktop.
require('dotenv').config({ quiet: true });
const fs = require('fs');
const os = require('os');
const path = require('path');

const codeMapPath = process.argv[2] || path.join(os.homedir(), 'ai-bridge', 'AI_BRIDGE', 'CODE_MAP_22NOV.md');
const outDir = process.argv[3] || path.join(os.homedir(), 'Desktop');
const publicDir = path.join(__dirname, '..', 'public');

// Rows look like: | old | new | on sale | vendor | item |
function changedOnSaleCodes(md) {
  const out = [];
  for (const line of md.split(/\r?\n/)) {
    const c = line.split('|').map(s => s.trim());
    if (c.length < 6 || !/^\d+$/.test(c[1]) || !/^\d+$/.test(c[2])) continue;
    if (c[1] !== c[2] && c[3].toLowerCase() === 'yes') out.push(c[2]);
  }
  return [...new Set(out)];
}

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

function countSheetHtml(rows) {
  const today = new Date().toLocaleDateString('en-GB');
  const body = rows.map(r => `<tr><td>${esc(r.item_code)}</td><td>${esc(r.name)}</td><td class=n>${Number(r.stock_level) || 0}</td><td class=box></td><td class=box></td></tr>`).join('');
  return `<!doctype html><html><head><meta charset=utf-8><style>
@page{size:A4;margin:12mm}body{font:10pt Arial,sans-serif;color:#0B0B0C}h1{font-size:14pt;margin:0 0 2mm}p{margin:0 0 4mm;color:#555}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:3px 5px}th{background:#eee;text-align:left}
thead{display:table-header-group}tr{page-break-inside:avoid}.n{text-align:right;width:16mm}.box{width:24mm}td:first-child{width:14mm}
</style></head><body><h1>Royal Bath Hub - Stock count sheet</h1><p>Printed ${today}. ${rows.length} items on sale. Write the real count in "Counted". Nothing is changed in the app until the counts are entered.</p>
<table><thead><tr><th>Code</th><th>Item</th><th class=n>App</th><th>Counted</th><th>Note</th></tr></thead><tbody>${body}</tbody></table></body></html>`;
}

(async () => {
  const pool = require('../utils/pool');
  const puppeteer = require('puppeteer');
  let browser;
  try {
    const all = (await pool.query(
      'SELECT id, item_code, name, selling_price, stock_level FROM products WHERE active = true ORDER BY item_code')).rows;
    if (!all.length) throw new Error('no items on sale found');

    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

    // 1) stock count sheet
    const p1 = await browser.newPage();
    await p1.setContent(countSheetHtml(all), { waitUntil: 'load' });
    const countOut = path.join(outDir, 'RBH_STOCK_COUNT_SHEET.pdf');
    await p1.pdf({ path: countOut, format: 'A4', printBackground: true });
    console.log('wrote', countOut, 'items:', all.length);

    // 2) reprint labels
    if (!fs.existsSync(codeMapPath)) { console.log('SKIPPED labels: code map not found at', codeMapPath); return; }
    const want = new Set(changedOnSaleCodes(fs.readFileSync(codeMapPath, 'utf8')));
    const items = all.filter(r => want.has(String(r.item_code)));
    if (!items.length) { console.log('SKIPPED labels: no changed on-sale codes found in the code map'); return; }
    const p2 = await browser.newPage();
    await p2.setRequestInterception(true);
    p2.on('request', req => {
      const u = new URL(req.url());
      if (u.pathname === '/api/products') return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(items) });
      const f = path.join(publicDir, u.pathname === '/' ? 'labels_a4.html' : u.pathname);
      if (u.hostname === 'labels.local' && f.startsWith(publicDir) && fs.existsSync(f)) {
        const type = f.endsWith('.png') ? 'image/png' : f.endsWith('.js') ? 'application/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html';
        return req.respond({ status: 200, body: fs.readFileSync(f), contentType: type });
      }
      return req.abort();
    });
    await p2.goto('http://labels.local/', { waitUntil: 'networkidle0' });
    await p2.emulateMediaType('print');
    const labelOut = path.join(outDir, 'RBH_LABELS_REPRINT_22NOV.pdf');
    await p2.pdf({ path: labelOut, preferCSSPageSize: true, printBackground: true });
    console.log('wrote', labelOut, 'items:', items.length, 'of', want.size, 'changed codes');
  } catch (e) {
    console.error('FAILED:', e.message); process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    await pool_end();
  }
  async function pool_end() { try { await require('../utils/pool').end(); } catch (_) {} }
})();

module.exports = { changedOnSaleCodes, countSheetHtml };
