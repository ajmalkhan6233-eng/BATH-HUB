'use strict';
// Load Metro selling prices into the app by item code (run AFTER renumber_items.js --yes).
//   node scripts/load_selling_prices.js <file>          -> shows the plan only (nothing changes)
//   node scripts/load_selling_prices.js <file> --yes    -> does it, all-or-nothing. Take a backup first.
// File lines: code|price|name   (# lines ignored). Only selling_price changes. Every name must match the item with that code, else STOPPED.
require('dotenv').config({ quiet: true });
const fs = require('fs');
const pool = require('../utils/pool');
const YES = process.argv.includes('--yes');
const file = process.argv.slice(2).find(a => !a.startsWith('--'));
const norm = s => String(s).toUpperCase().replace('ACCESORIES', 'ACCESSORIES').replace('CHINESE BASIN TAP', 'CHINESE SQUARE BASIN TAP').replace(/[^A-Z0-9]/g, '');
(async () => {
  if (!file) { console.error('give the price file path'); process.exitCode = 1; return; }
  const rows = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#')).map(l => { const [code, price, ...n] = l.split('|'); return { code: code.trim(), price: Number(price), name: n.join('|').trim() }; });
  if (rows.some(r => !/^\d{3}$/.test(r.code) || !Number.isInteger(r.price) || r.price <= 0)) { console.error('STOPPED: bad line in file'); process.exitCode = 1; return; }
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const bad = []; let n = 0;
    for (const r of rows) {
      const p = (await c.query('SELECT id, name, avg_cost FROM products WHERE active = true AND item_code = $1', [r.code])).rows[0];
      if (!p) { bad.push(`${r.code}: no live item`); continue; }
      if (norm(p.name) !== norm(r.name)) { bad.push(`${r.code}: app says "${p.name}" file says "${r.name}"`); continue; }
      if (YES) await c.query('UPDATE products SET selling_price = $1 WHERE id = $2', [r.price, p.id]);
      n++; if (n <= 3) console.log(`${r.code} ${p.name}: cost ${p.avg_cost} -> price ${r.price}`);
    }
    if (bad.length) throw new Error('STOPPED, nothing changed:\n' + bad.join('\n'));
    if (!YES) { await c.query('ROLLBACK'); console.log(`REHEARSAL only: ${n} of ${rows.length} prices would load. Add --yes.`); return; }
    const chk = (await c.query(`SELECT COUNT(*)::int AS n FROM products WHERE active = true AND selling_price > 0`)).rows[0].n;
    await c.query('COMMIT'); console.log(`DONE: ${n} prices loaded; live items with a price now: ${chk}`);
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); console.error(e.message); process.exitCode = 1; }
  finally { c.release(); await pool.end().catch(() => {}); }
})();
