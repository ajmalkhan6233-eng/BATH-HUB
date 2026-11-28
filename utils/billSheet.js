'use strict';
// Report screens when no day sheet is typed (AJ 28 Nov, "yes, change them"): sales and gross profit from the POS bills,
// shaped like day-sheet rows. Expenses, net and the cash or card split are not on a bill: null (shown as PENDING), never 0.
// shortcut: used only when the sheet has NOTHING for the period; mix sheet and bill days if AJ starts typing some days.
const MC = require('./moneyCore');
const { todayLK } = require('./lkTime');

const UNKNOWN = ['total_expenses', 'net_profit', 'cash_sale', 'card_sale', 'online_sale', 'credit_sale', 'cheq_payment', 'payments', 'cash_in_hand'];
const blank = () => Object.fromEntries(UNKNOWN.map((k) => [k, null]));

async function rows(pool, from = '2000-01-01', to = todayLK()) {
  let list = [];
  try { list = (await MC.days(pool, from, to)).filter((d) => d.source === 'bills'); } catch (e) { console.warn('[billSheet]', e.message); }
  return list.map((d) => ({ ...blank(), report_date: d.day, date_str: d.day, total_sale: d.sales, gross_profit: d.gp, gp_status: d.gp === null ? 'NOT_AVAILABLE' : 'ACTUAL', day_status: 'BILLS ONLY', sales_source: 'POS bills' }));
}

const periodOf = {
  daily: (d) => d,
  weekly: (d) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return t.toISOString().slice(0, 10); },
  monthly: (d) => d.slice(0, 7) + '-01',
  quarterly: (d) => `${d.slice(0, 4)}-${String(Math.floor((Number(d.slice(5, 7)) - 1) / 3) * 3 + 1).padStart(2, '0')}-01`,
};
const add = (a, b) => (b === null ? a : MC.round2((a || 0) + b));

// [{ period, days, sales, gross_profit }]
function group(list, unit) {
  const key = periodOf[unit] || periodOf.daily, m = new Map();
  for (const r of list) {
    const k = key(r.report_date), o = m.get(k) || { period: k, days: 0, sales: 0, gross_profit: null };
    o.days += 1; o.sales = add(o.sales, r.total_sale); o.gross_profit = add(o.gross_profit, r.gross_profit); m.set(k, o);
  }
  return [...m.values()].sort((a, b) => a.period.localeCompare(b.period));
}
const total = (list) => ({ sales: list.reduce((a, r) => add(a, r.total_sale), 0), gross_profit: list.reduce((a, r) => add(a, r.gross_profit), null), days: list.length });

module.exports = { rows, group, total };
