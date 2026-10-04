'use strict';
/** Morning brief: rule-based, no AI, no network. The route gathers the numbers; this turns them into sections, actions and text. */
const fmt = (n) => `Rs. ${Math.round(Number(n) || 0).toLocaleString('en-US')}`;
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

/**
 * d = { yesterday:{sales,grossProfit,expenses}, targets:{dailySales,dailyCost}, week:{sales,grossProfit,days},
 *       cheques:<chequeCalendar result>, cashGap:<cashGap result>, cashOnHand, receivables:[{name,amount,due}], savings:{target,saved} }
 */
function buildBrief(d, todayISO) {
  const y = d.yesterday || { sales: 0, grossProfit: 0, expenses: 0 };
  const t = d.targets || { dailySales: 0, dailyCost: 0 };
  const c = d.cheques || { today: 0, tomorrow: 0, monday: { date: '', amount: 0 }, overdue: { amount: 0, count: 0 }, bulkDays: [] };
  const g = d.cashGap || { gap: 0, due: 0, days: 2 };
  const salesPct = pct(y.sales, t.dailySales);
  const profitVsCost = Math.round(y.grossProfit - t.dailyCost);
  const sections = {
    yesterday: { sales: y.sales, targetSales: t.dailySales, salesPct, grossProfit: y.grossProfit, dailyCost: t.dailyCost, profitVsCost, ahead: profitVsCost >= 0 },
    cheques: { today: c.today, tomorrow: c.tomorrow, monday: c.monday, overdue: c.overdue, bulkDays: c.bulkDays },
    cash: { onHand: d.cashOnHand || 0, due: g.due, gap: g.gap, days: g.days },
    savings: d.savings ? { ...d.savings, behind: Math.max(0, d.savings.target - d.savings.saved) } : null,
  };
  const actions = [];
  if (g.gap > 0) actions.push(`Find ${fmt(g.gap)} before the cheques fall due (${fmt(g.due)} due in the next ${g.days} days, cash ${fmt(d.cashOnHand || 0)}).`);
  if (c.overdue && c.overdue.count > 0) actions.push(`${c.overdue.count} cheque(s) worth ${fmt(c.overdue.amount)} are past their date: mark cleared or check with the bank.`);
  if (c.bulkDays && c.bulkDays.length) actions.push(`Bulk cheque day: ${c.bulkDays.map((x) => `${x.date} ${fmt(x.amount)}`).join(', ')}. Start collecting now.`);
  const due = (d.receivables || []).filter((r) => r.due && r.due <= todayISO);
  if (due.length) actions.push(`Collect ${fmt(due.reduce((a, r) => a + r.amount, 0))} from ${due.map((r) => r.name).join(', ')}.`);
  if (!sections.yesterday.ahead) actions.push(`Yesterday's profit was ${fmt(Math.abs(profitVsCost))} under the daily cost. Push accessories and packages today.`);
  if (sections.savings && sections.savings.behind > 0) actions.push(`Savings target is ${fmt(sections.savings.behind)} behind.`);
  if (!actions.length) actions.push('On track. Keep the daily cost covered and record every bill today.');
  return { date: todayISO, sections, actions: actions.slice(0, 3), allActions: actions };
}

function toText(b) {
  const s = b.sections, y = s.yesterday;
  const L = [`Good morning. Bath Hub brief for ${b.date}`, '',
    `Yesterday: sales ${fmt(y.sales)} (${y.salesPct}% of ${fmt(y.targetSales)}). Profit ${fmt(y.grossProfit)} against a daily cost of ${fmt(y.dailyCost)}: ${y.ahead ? 'ahead by' : 'behind by'} ${fmt(Math.abs(y.profitVsCost))}.`, '',
    `Cheques due: today ${fmt(s.cheques.today)}, tomorrow ${fmt(s.cheques.tomorrow)}, ${s.cheques.monday.date || 'Monday'} ${fmt(s.cheques.monday.amount)}.`,
    `Cash on hand ${fmt(s.cash.onHand)}. ${s.cash.gap > 0 ? `SHORT by ${fmt(s.cash.gap)} for the next ${s.cash.days} days.` : 'Cheques for the next days are covered.'}`, '', 'Today:'];
  b.actions.forEach((a, i) => L.push(`${i + 1}. ${a}`));
  return L.join('\n');
}
module.exports = { fmt, buildBrief, toText };
