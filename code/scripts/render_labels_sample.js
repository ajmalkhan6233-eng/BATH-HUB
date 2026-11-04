'use strict';
// Draws ONE sample A4 sticker sheet (40 labels) to public/print/labels_a4_sample.pdf with fake items. Needs no login and no database.
// node scripts/render_labels_sample.js
const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, '..', 'public');
const FAKE = [
  ['099', 'ORVEL SQUARE SHELF UNBREAKABLE', 3500], ['100', '3" POP WASTE NIKAL FULL THREAD FULLCAP', 2950], ['106', '6" SANDWICH SHOWER', 3750],
  ['107', 'HALF SQUARE BIDET GREY HOSE ORIN', 4350], ['109', 'MATT KITCHEN SINK TAP', 4850], ['110', 'SQUARE TOWEL BAR HEAVY', 4950],
  ['111', 'SQUARE SINGLE FOLDING TOWELBAR', 4850], ['142', 'BLACK SINGLE FOLDING TOWELBAR', 5550],
].map((r, i) => ({ id: i + 1, item_code: r[0], name: r[1], selling_price: r[2], stock_level: 3, avg_cost: [1600, 900, 1250, 1700, 1300, 1500, 2200, 2200][i] }));
(async () => {
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', req => {
      const u = new URL(req.url());
      if (u.pathname === '/api/products') return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE) });
      const f = path.join(root, u.pathname === '/' ? 'labels_a4.html' : u.pathname);
      if (u.hostname === 'sample.local' && fs.existsSync(f)) return req.respond({ status: 200, body: fs.readFileSync(f), contentType: u.pathname.endsWith('.png') ? 'image/png' : u.pathname.endsWith('.js') ? 'application/javascript' : 'text/html' });
      return req.abort();
    });
    await page.goto('http://sample.local/', { waitUntil: 'load' });
    await page.evaluate(() => generateSample());
    await page.emulateMediaType('print');
    const out = path.join(root, 'print', 'labels_a4_sample.pdf');
    await page.pdf({ path: out, preferCSSPageSize: true, printBackground: true });
    const pages = (fs.readFileSync(out).toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    console.log('wrote', out, 'pages:', pages);
  } finally { await browser.close(); }
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
