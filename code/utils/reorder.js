'use strict';
// REORDER BY VENDOR (AJ 24 Oct 2026): items at or under their reorder level, grouped by the vendor we last bought them from, with a ready WhatsApp order text.
// Suggested quantity = enough to reach twice the reorder level. Suggestions only: nothing is ordered or sent by itself.
const need = (stock, thr) => Math.max(0, Math.ceil(Number(thr) * 2 - Math.max(0, Number(stock) || 0)));
function group(rows) {
  const by = {}; rows.forEach(r => { const v = r.vendor || 'Unknown vendor'; (by[v] = by[v] || []).push({ item_code: r.item_code, name: r.name, stock: Number(r.stock_level) || 0, level: Number(r.reorder_threshold), order_qty: need(r.stock_level, r.reorder_threshold) }); });
  return Object.keys(by).sort().map(v => ({ vendor: v, items: by[v], text: text(v, by[v]) }));
}
function text(vendor, items) { return 'Order for ' + vendor + ' (Royal Bath Hub):\n' + items.map(i => '- ' + i.name + ' x ' + i.order_qty).join('\n') + '\nPlease confirm availability and price. Thank you.'; }
async function load(pool) {
  const r = await pool.query(`SELECT p.item_code, p.name, p.stock_level, p.reorder_threshold,
      (SELECT g.supplier_name FROM grn_records g WHERE g.item_description LIKE p.item_code || ' - %' ORDER BY g.id DESC LIMIT 1) AS vendor
    FROM products p WHERE p.active IS NOT FALSE AND COALESCE(p.reorder_threshold,0) > 0 AND COALESCE(p.stock_level,0) <= p.reorder_threshold ORDER BY p.name`);
  return group(r.rows);
}
module.exports = { need, group, text, load };
