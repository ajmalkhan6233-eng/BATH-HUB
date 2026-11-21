'use strict';
// Stock holding cost (estimate, report only). Money tied up in stock, shelf space and damage cost a little for every day an item sits.
// This is NOT interest: nothing is lent or borrowed, it is a shop estimate. charge = cost x rate% per month x (days in stock / 30).
// Days in stock = sale date minus the latest GRN date of that item on or before the sale. No GRN date found = no charge (counted separately).
const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const DAY = 86400000;
const dayNum = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY : null; };
// receipts: { itemCode: ['2026-11-03', ...] }   lines: [{ day:'YYYY-MM-DD', item_code, name, qty, revenue, cost }]
function compute(lines, receipts, ratePct) {
  const rate = Number(ratePct) > 0 ? Number(ratePct) : 0, by = new Map();
  let noDate = 0;
  for (const l of lines) {
    const d = dayNum(l.day), code = String(l.item_code || ''), key = code || l.name;
    let days = null;
    for (const r of (receipts[code] || [])) { const rd = dayNum(r); if (rd != null && d != null && rd <= d && (days == null || d - rd < days)) days = d - rd; }
    const cost = Number(l.cost) || 0, rev = Number(l.revenue) || 0;
    const charge = days == null ? 0 : cost * (rate / 100) * (days / 30);
    if (days == null) noDate++;
    const o = by.get(key) || { item_code: code, name: l.name, qty: 0, revenue: 0, cost: 0, charge: 0, dayCost: 0, w: 0 };
    o.qty += Number(l.qty) || 0; o.revenue += rev; o.cost += cost; o.charge += charge;
    if (days != null) { o.dayCost += days * cost; o.w += cost; }
    by.set(key, o);
  }
  const rows = [...by.values()].map(o => ({ item_code: o.item_code, name: o.name, qty: round2(o.qty), revenue: round2(o.revenue), cost: round2(o.cost), gross: round2(o.revenue - o.cost), days: o.w > 0 ? Math.round(o.dayCost / o.w) : null, charge: round2(o.charge), real: round2(o.revenue - o.cost - o.charge) }))
    .sort((a, b) => b.charge - a.charge);
  const t = rows.reduce((a, r) => ({ revenue: a.revenue + r.revenue, cost: a.cost + r.cost, gross: a.gross + r.gross, charge: a.charge + r.charge, real: a.real + r.real }), { revenue: 0, cost: 0, gross: 0, charge: 0, real: 0 });
  for (const k of Object.keys(t)) t[k] = round2(t[k]);
  return { rate_pct_month: rate, rows, total: t, lines_without_receipt_date: noDate };
}
module.exports = { compute, dayNum };
