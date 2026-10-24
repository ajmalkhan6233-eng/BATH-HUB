'use strict';
// Profit maths (pure, no database). AJ's formula (24 Oct 2026):
//   GROSS profit = what customers paid (sales) - cost of delivering the product (cost of goods)
//   NET profit   = gross profit - ALL other costs (shop expenses, salaries, sale commissions)
// No interest anywhere (halal). Used by routes/profit.js and tests/profit.test.js.
const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function periodOf(day, group) {
  if (group === 'year') return day.slice(0, 4);
  if (group === 'month') return day.slice(0, 7);
  if (group === 'week') { const d = new Date(day + 'T00:00:00Z'); const back = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - back); return d.toISOString().slice(0, 10); }
  return day;
}

// bills: [{day,total,discount,cost,no_cost}]  expenses/salaries/commissions: [{day,amount}]
function aggregate({ bills = [], expenses = [], salaries = [], commissions = [] }, group = 'day') {
  const by = new Map();
  const row = k => { if (!by.has(k)) by.set(k, { period: k, bills: 0, sales: 0, discount: 0, cogs: 0, expenses: 0, salary: 0, commissions: 0, lines_without_cost: 0 }); return by.get(k); };
  for (const b of bills) { const o = row(periodOf(b.day, group)); o.bills += 1; o.sales += Number(b.total) || 0; o.discount += Number(b.discount) || 0; o.cogs += Number(b.cost) || 0; o.lines_without_cost += Number(b.no_cost) || 0; }
  for (const e of expenses) row(periodOf(e.day, group)).expenses += Number(e.amount) || 0;
  for (const s of salaries) row(periodOf(s.day, group)).salary += Number(s.amount) || 0;
  for (const c of commissions) row(periodOf(c.day, group)).commissions += Number(c.amount) || 0;
  const rows = [...by.values()].sort((a, b) => (a.period < b.period ? 1 : -1)).map(finish);
  const t = rows.reduce((a, r) => { for (const k of ['bills', 'sales', 'discount', 'cogs', 'expenses', 'salary', 'commissions', 'lines_without_cost']) a[k] += r[k]; return a; },
    { period: 'TOTAL', bills: 0, sales: 0, discount: 0, cogs: 0, expenses: 0, salary: 0, commissions: 0, lines_without_cost: 0 });
  return { rows, total: finish(t) };
}
function finish(o) {
  const r = Object.assign({}, o);
  for (const k of ['sales', 'discount', 'cogs', 'expenses', 'salary', 'commissions']) r[k] = round2(r[k]);
  r.gross = round2(r.sales - r.cogs);
  r.other_costs = round2(r.expenses + r.salary + r.commissions);
  r.net = round2(r.gross - r.other_costs);
  r.margin_pct = r.sales > 0 ? round2((r.gross / r.sales) * 100) : null;
  return r;
}

// lines: [{item_code,item_name,category,qty,revenue,cost}] -> by item and by category, best profit first
function rollup(lines, key) {
  const by = new Map();
  for (const l of lines) {
    const k = key === 'category' ? (l.category || 'No category') : (l.item_code || l.item_name || 'No code');
    const o = by.get(k) || { key: k, name: key === 'category' ? k : (l.item_name || k), qty: 0, revenue: 0, cost: 0 };
    o.qty += Number(l.qty) || 0; o.revenue += Number(l.revenue) || 0; o.cost += Number(l.cost) || 0; by.set(k, o);
  }
  return [...by.values()].map(o => { const profit = round2(o.revenue - o.cost); return { key: o.key, name: o.name, qty: round2(o.qty), revenue: round2(o.revenue), cost: round2(o.cost), profit, margin_pct: o.revenue > 0 ? round2((profit / o.revenue) * 100) : null }; })
    .sort((a, b) => b.profit - a.profit);
}
module.exports = { round2, periodOf, aggregate, rollup };
