'use strict';
// utils/daily_breakdown_math.js: the arithmetic behind the Daily Breakdown page. Pure functions, no database.
//
// A day's SALES are split into what to KEEP ASIDE and what is YOURS:
//   sales          = POS bills (void bills left out) + market purchases that were NOT put on a POS bill
//   cost           = cost of the stock items sold (avg_cost x qty) + what the market purchases cost
//   gross profit   = sales - cost
//   overhead today = (rent + salary + other) per month / days in the month
//   commission     = commission % of gross profit (0 until Aj sets it)
//   net profit     = gross profit - overhead today - commission      <- yours
//   keep aside     = cost (to restock / pay vendors and cheques) + rent + salary + other + commission
// A market purchase (item bought from another shop for one customer) never touches stock. Only its profit counts.
// Cheques are NOT an extra cost here (they are how the cost of goods gets paid); they are listed in "to pay".

const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

function daysInMonth(dateStr) {
  const [y, m] = String(dateStr).split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function computeBreakdown({ date, posSales = 0, stockCost = 0, noCostLines = 0, market = [], settings = {} }) {
  const s = {
    rent_monthly: num(settings.rent_monthly), salary_monthly: num(settings.salary_monthly),
    other_monthly: num(settings.other_monthly), commission_rate: num(settings.commission_rate),
  };
  const days = daysInMonth(date);
  let marketCost = 0; let marketExtraSales = 0; let marketProfit = 0;
  for (const m of market) {
    const buy = num(m.buy_cost); const sell = num(m.sell_price);
    marketCost += buy; marketProfit += sell - buy;
    if (!m.on_bill) marketExtraSales += sell;   // sold outside the POS: its price is added here; on a POS bill it is already in the bills total
  }
  const sales = round2(num(posSales) + marketExtraSales);
  const cost = round2(num(stockCost) + marketCost);
  const gross = round2(sales - cost);
  const rent = round2(s.rent_monthly / days); const salary = round2(s.salary_monthly / days); const other = round2(s.other_monthly / days);
  const overhead = round2(rent + salary + other);
  const commission = round2((s.commission_rate / 100) * Math.max(gross, 0));
  const net = round2(gross - overhead - commission);
  const keepAside = round2(cost + overhead + commission);
  return {
    date, days_in_month: days, sales, pos_sales: round2(posSales), market_extra_sales: round2(marketExtraSales),
    cost, stock_cost: round2(stockCost), market_cost: round2(marketCost), market_profit: round2(marketProfit),
    gross_profit: gross, rent, salary, other, overhead, commission, commission_rate: s.commission_rate,
    net_profit: net, keep_aside: keepAside, no_cost_lines: Math.max(0, Number(noCostLines) || 0),
  };
}

// What is due and when. cheques: [{id, payee, amount, due_date 'YYYY-MM-DD', status}], today 'YYYY-MM-DD'.
// rentDay / salaryDay: day of the month (1-31), 0 = not set. windowDays: how far ahead to look.
function dayNumber(dateStr) { const [y, m, d] = String(dateStr).split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); }
function dueList({ today, windowDays = 7, cheques = [], rentDay = 0, salaryDay = 0, rentAmount = 0, salaryAmount = 0 }) {
  const t = dayNumber(today); const out = [];
  for (const c of cheques) {
    if (!['pending', 'held'].includes(String(c.status || 'pending'))) continue;   // a held cheque is still to be paid, on its new date
    const left = dayNumber(String(c.due_date).slice(0, 10)) - t;
    if (left <= windowDays) out.push({ kind: 'cheque', label: `Cheque to ${c.payee}`, amount: round2(c.amount), due_date: String(c.due_date).slice(0, 10), days_left: left });
  }
  const monthly = (kind, label, day, amount) => {
    const d = Math.floor(num(day)); if (d < 1 || d > 31 || !(num(amount) > 0)) return;
    const [y, m] = today.split('-').map(Number);
    for (const mm of [m, m + 1]) {   // this month's date, then next month's, whichever is next
      const last = new Date(Date.UTC(y, mm, 0)).getUTCDate();
      const dt = new Date(Date.UTC(y, mm - 1, Math.min(d, last)));
      const iso = dt.toISOString().slice(0, 10); const left = dayNumber(iso) - t;
      if (left >= -3) { if (left <= windowDays) out.push({ kind, label, amount: round2(amount), due_date: iso, days_left: left }); return; }
    }
  };
  monthly('rent', 'Shop rent', rentDay, rentAmount);
  monthly('salary', 'Salary and commission', salaryDay, salaryAmount);
  return out.sort((a, b) => a.days_left - b.days_left);
}

module.exports = { computeBreakdown, dueList, daysInMonth, round2 };
