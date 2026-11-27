'use strict';
// MONEY CORE (27 Nov 2026, AJ: "one family"). The ONE place that decides what counts as a sale and what it cost.
// Rules (hard rule 5): real finished bills only (a row in pos_bill_voids = void, left out), cost = the cost kept on the
// bill line when sold, else the item's average cost, day = the bill's own date (created_at::date, no timezone shifting).
// Every screen (Home, Dashboard, Profit, Sales view, Running cost, Staff, Pocket) asks THIS module for its sales/profit
// numbers, so they cannot drift apart. Read only. Never writes.

// SQL pieces other files may reuse so nobody re-types the void rule.
const LIVE = 'NOT EXISTS (SELECT 1 FROM pos_bill_voids v WHERE v.bill_id = b.id)';            // use with alias b
const LIVE_JOIN = 'LEFT JOIN pos_bill_voids v ON v.bill_id = b.id WHERE v.bill_id IS NULL';   // use with alias b
const COST = 'COALESCE(NULLIF(i.unit_cost,0), p.avg_cost, 0)';                                 // use with aliases i (bill item), p (product)

const num = (x) => Number(x) || 0;
const round2 = (x) => Math.round((num(x) + Number.EPSILON) * 100) / 100;

// Every live bill, one row each: {id, bill_number, day:'YYYY-MM-DD', total, discount, cost, no_cost, salesman, payment_method}
async function liveBills(pool, { from = null, to = null } = {}) {
  const r = await pool.query(
    `SELECT b.id, b.bill_number, to_char(b.created_at::date,'YYYY-MM-DD') AS day, b.total, b.discount_amount AS discount, b.salesman, b.payment_method,
            COALESCE(SUM(i.qty * ${COST}), 0) AS cost,
            COUNT(i.id) FILTER (WHERE ${COST} = 0) AS no_cost
       FROM pos_bills b LEFT JOIN pos_bill_items i ON i.bill_id = b.id LEFT JOIN products p ON p.item_code = i.item_code
      WHERE ${LIVE}
        AND ($1::date IS NULL OR b.created_at::date >= $1::date) AND ($2::date IS NULL OR b.created_at::date <= $2::date)
      GROUP BY b.id ORDER BY b.created_at, b.id`, [from, to]);
  return r.rows.map((b) => ({ id: b.id, bill_number: b.bill_number, day: b.day, total: num(b.total), discount: num(b.discount), cost: num(b.cost), no_cost: num(b.no_cost), salesman: b.salesman, payment_method: b.payment_method }));
}

// Add up a list of bills (from liveBills). gross = sales - cost.
function sum(bills) {
  const a = { n: 0, sales: 0, discount: 0, cost: 0, no_cost: 0 };
  for (const b of bills) { a.n++; a.sales += b.total; a.discount += b.discount; a.cost += b.cost; a.no_cost += b.no_cost; }
  a.sales = round2(a.sales); a.discount = round2(a.discount); a.cost = round2(a.cost); a.gross = round2(a.sales - a.cost);
  return a;
}

// Sales / cost / gross for one date range straight from the database.
async function range(pool, from, to) { return sum(await liveBills(pool, { from, to })); }

// Sales by day, for any range.
async function byDay(pool, from, to) {
  const m = new Map();
  for (const b of await liveBills(pool, { from, to })) { if (!m.has(b.day)) m.set(b.day, []); m.get(b.day).push(b); }
  return [...m.entries()].map(([day, list]) => ({ day, ...sum(list) }));
}

// Staff commission: what the commission ledger says for a date range (sale_commissions: sale rows plus negative return rows).
async function commission(pool, from, to) {
  try {
    const r = await pool.query(
      `SELECT s.id AS staff_id, COALESCE(s.name,'(unassigned)') AS name,
              COALESCE(SUM(c.amount),0) AS sales, COALESCE(SUM(c.commission_amount),0) AS commission, COUNT(*) AS entries
         FROM sale_commissions c LEFT JOIN staff s ON s.id = c.staff_id
        WHERE ($1::date IS NULL OR c.sale_date >= $1::date) AND ($2::date IS NULL OR c.sale_date <= $2::date)
        GROUP BY s.id, s.name ORDER BY commission DESC`, [from, to]);
    const rows = r.rows.map((x) => ({ staff_id: x.staff_id, name: x.name, sales: round2(x.sales), commission: round2(x.commission), entries: num(x.entries) }));
    return { rows, total: round2(rows.reduce((a, x) => a + x.commission, 0)) };
  } catch (e) { if (e && (e.code === '42P01' || /does not exist/i.test(e.message || ''))) return { rows: [], total: 0 }; throw e; }
}

module.exports = { LIVE, LIVE_JOIN, COST, liveBills, sum, range, byDay, commission, round2 };
