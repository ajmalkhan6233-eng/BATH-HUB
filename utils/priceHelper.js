'use strict';
// PRICE HELPER (AJ 24 Oct 2026): suggests a selling price for items that have none yet, from the way AJ prices (docs/AJ_LEARNED.md, 22 Oct):
// multiple of cost by band: under 400 = 2.8x, 400-800 = 4x, 800-1500 = 3.3x, 1500-2500 = 2.5x, over 2500 = 2.1x; prices end in 50 or 00.
// NEVER applied by itself: AJ taps Apply on each one (or edits the number first).
const BANDS = [[400, 2.8], [800, 4], [1500, 3.3], [2500, 2.5], [Infinity, 2.1]];
const multiple = cost => (BANDS.find(b => cost < b[0]) || BANDS[BANDS.length - 1])[1];
const to50 = n => Math.round(n / 50) * 50;
function suggest(cost) {
  const c = Number(cost); if (!(c > 0)) return null;
  const m = multiple(c); let p = to50(c * m); if (p < c * 1.3) p = to50(c * 1.3 + 49);   // never below a 30% mark-up
  return { price: p, multiple: Math.round((p / c) * 100) / 100 };
}
async function missing(pool) {
  const r = await pool.query(`SELECT item_code, name, avg_cost, stock_level, category FROM products WHERE active IS NOT FALSE AND COALESCE(selling_price,0) <= 0 AND COALESCE(avg_cost,0) > 0 ORDER BY item_code`);
  return r.rows.map(x => ({ item_code: x.item_code, name: x.name, cost: Number(x.avg_cost), stock: Number(x.stock_level || 0), category: x.category, ...suggest(x.avg_cost) }));
}
async function apply(pool, code, price) {
  const p = Number(price); if (!(p > 0) || !isFinite(p)) return { error: 'price must be more than 0', code: 400 };
  const r = await pool.query(`UPDATE products SET selling_price = $2 WHERE item_code = $1 AND active IS NOT FALSE RETURNING item_code, name, avg_cost, selling_price`, [code, p]);
  if (!r.rows.length) return { error: 'item not found', code: 404 };
  const row = r.rows[0]; return { ok: true, item: row, below_cost: Number(row.avg_cost) > 0 && p < Number(row.avg_cost) };
}
module.exports = { suggest, multiple, missing, apply };
