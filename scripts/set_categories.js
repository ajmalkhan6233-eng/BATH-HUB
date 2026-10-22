'use strict';
// Give every active item without a category one of: Accessories, Fittings, Bathroom, Tiles (by words in its name).
//   node scripts/set_categories.js          -> shows counts and examples only (nothing changes)
//   node scripts/set_categories.js --yes    -> does it, all-or-nothing. Items that already have a category are NOT touched.
const RULES = [
  ['Tiles', /\b(TILE|TILES|PORCELAIN|MOSAIC)\b/],
  ['Bathroom', /MIRROR|COMMODE (SET|SEAT)|VANITY|CABINET|BATH ?TUB|SHOWER (ROOM|ENCLOSURE)/],
  ['Accessories', /TOWEL ?BAR|HOOK|SOAP DISH|BRUSH HOLDER|TISSUE HOLDER|SHELF|ACCESSORIES SET|ACCESORIES SET|PAPER HOLDER|ROBE/],
];
const pick = n => { const u = String(n).toUpperCase(); for (const [c, re] of RULES) if (re.test(u)) return c; return 'Fittings'; };
module.exports = { pick };
if (require.main === module) (async () => {
  require('dotenv').config({ quiet: true });
  const pool = require('../utils/pool'); const YES = process.argv.includes('--yes'); const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const rows = (await c.query(`SELECT id, item_code, name FROM products WHERE active = true AND (category IS NULL OR btrim(category) = '') ORDER BY item_code`)).rows;
    const by = {}; rows.forEach(r => { const k = pick(r.name); (by[k] = by[k] || []).push(r); });
    for (const k of Object.keys(by)) console.log(`${k}: ${by[k].length}  e.g. ${by[k].slice(0, 3).map(r => r.item_code + ' ' + r.name).join(' | ')}`);
    if (!YES) { await c.query('ROLLBACK'); console.log(`REHEARSAL only: ${rows.length} items would get a category. Add --yes.`); return; }
    for (const r of rows) await c.query('UPDATE products SET category = $1 WHERE id = $2', [pick(r.name), r.id]);
    const left = (await c.query(`SELECT COUNT(*)::int AS n FROM products WHERE active = true AND (category IS NULL OR btrim(category) = '')`)).rows[0].n;
    if (left) throw new Error('CHECK FAILED: ' + left + ' items still without category. Rolled back.');
    await c.query('COMMIT'); console.log(`DONE: ${rows.length} items categorised`);
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); console.error(e.message); process.exitCode = 1; }
  finally { c.release(); await pool.end().catch(() => {}); }
})();
