'use strict';
// REORDER FORECAST (queue job 2): how fast each item really sells, how many days of stock are left, and how much to order to cover the next 30 days.
// Suggestions only. Nothing is ordered or sent by itself; the owner approves. Own module: reads POS sales, writes nothing.
const RO = require('./reorder');
const WINDOW_DAYS = 60, COVER_DAYS = 30, WARN_DAYS = 14;
const round1 = n => Math.round(n * 10) / 10;
// rows: { item_code, name, stock_level, reorder_threshold, vendor, sold } where sold = units sold in the last WINDOW_DAYS days
function suggest(rows) {
  return rows.map(r => {
    const stock = Math.max(0, Number(r.stock_level) || 0), sold = Math.max(0, Number(r.sold) || 0), level = Number(r.reorder_threshold) || 0;
    const perDay = sold / WINDOW_DAYS;
    const daysLeft = perDay > 0 ? stock / perDay : null;
    const low = (level > 0 && stock <= level) || (daysLeft !== null && daysLeft <= WARN_DAYS);
    const orderQty = low ? Math.max(0, Math.ceil(perDay * COVER_DAYS - stock)) : 0;
    return { item_code: r.item_code, name: r.name, vendor: r.vendor || 'Unknown vendor', stock, per_day: round1(perDay), days_left: daysLeft === null ? null : Math.floor(daysLeft), order_qty: orderQty, low };
  }).filter(x => x.low && x.order_qty > 0).sort((a, b) => (a.days_left === null) - (b.days_left === null) || a.days_left - b.days_left);
}
function byVendor(list) {
  const by = {}; list.forEach(i => { (by[i.vendor] = by[i.vendor] || []).push(i); });
  return Object.keys(by).sort().map(v => ({ vendor: v, items: by[v], text: RO.text(v, by[v]) }));
}
async function load(pool) {
  const r = await pool.query(`SELECT p.item_code, p.name, p.stock_level, p.reorder_threshold,
      (SELECT g.supplier_name FROM grn_records g WHERE g.item_description LIKE p.item_code || ' - %' ORDER BY g.id DESC LIMIT 1) AS vendor,
      COALESCE((SELECT SUM(i.qty) FROM pos_bill_items i JOIN pos_bills b ON b.id = i.bill_id
        WHERE i.item_code = p.item_code AND b.created_at >= NOW() - INTERVAL '${WINDOW_DAYS} days'
        AND NOT EXISTS (SELECT 1 FROM pos_bill_voids v WHERE v.bill_id = b.id)), 0) AS sold
    FROM products p WHERE p.active IS NOT FALSE ORDER BY p.name`);
  const list = suggest(r.rows);
  return { window_days: WINDOW_DAYS, cover_days: COVER_DAYS, items: list, vendors: byVendor(list) };
}
module.exports = { suggest, byVendor, load, WINDOW_DAYS, COVER_DAYS, WARN_DAYS };
