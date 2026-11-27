'use strict';
// ADVANCE CASH (AJ 27 Nov). An advance is money in the drawer that is NOT a sale yet.
//  received(day) = advance money taken (or refunded, negative) on that day, by method.
//  applied(day)  = advances of orders SETTLED that day. The settle bill shows the full price in its payments (sale recognised on the settle day),
//                  but that part of the money came in on an earlier day, so the drawer must not count it again.
// Day cash = cash sales + received.cash - applied.cash. Sales numbers are untouched. Pure read, safe if the tables do not exist yet.
const M = ['cash', 'card', 'online', 'cheque'];
const blank = () => ({ cash: 0, card: 0, online: 0, cheque: 0, total: 0 });
const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
async function advanceDay(pool, date) {
  const out = { received: blank(), applied: blank(), rows: [] };
  try {
    const a = await pool.query(`SELECT o.order_no, COALESCE(o.customer_name,'') AS cust, p.method, p.amount, COALESCE(p.reference,'') AS ref, to_char(p.paid_at,'HH24:MI') AS t
      FROM pos_advance_payments p JOIN pos_advance_orders o ON o.id = p.order_id WHERE p.paid_at::date = $1::date ORDER BY p.id`, [date]);
    for (const x of a.rows) { const m = M.includes(x.method) ? x.method : 'cash'; out.received[m] = r2(out.received[m] + Number(x.amount)); out.received.total = r2(out.received.total + Number(x.amount)); out.rows.push({ order_no: x.order_no, customer: x.cust, method: x.method, amount: Number(x.amount), ref: x.ref, time: x.t }); }
    const b = await pool.query(`SELECT p.method, SUM(p.amount) AS s FROM pos_advance_payments p JOIN pos_advance_orders o ON o.id = p.order_id
      WHERE o.status = 'settled' AND o.settled_at::date = $1::date GROUP BY p.method`, [date]);
    for (const x of b.rows) { const m = M.includes(x.method) ? x.method : 'cash'; out.applied[m] = r2(out.applied[m] + Number(x.s)); out.applied.total = r2(out.applied.total + Number(x.s)); }
  } catch (e) { /* tables not created yet: no advances */ }
  return out;
}
module.exports = { advanceDay };
