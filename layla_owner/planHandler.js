'use strict';
/**
 * Payment planner replies for the owner chat. Writes ONLY reminders (owner_tasks), never money records: the cheques are
 * saved in the cheque register by the owner after the vendor confirms the price (rule: chat never changes money).
 * Reminders go out at 06:00 Sri Lanka, 3 days before each cheque date, once each.
 */
const T = require('./timeParse');
const P = require('../utils/payment_planner');
const rs = (n) => `Rs. ${Math.round(Number(n) || 0).toLocaleString('en-US')}`;
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const UNIT_DAYS = { months: 30, weeks: 7, days: 1 };
const GUARD = 'Before you write them: vendor confirms this credit price = cash price, and cash is in the bank when each is presented. Not saved in the cheque register yet.';

/** 06:00 Sri Lanka, 3 days before the cheque date; if that has passed, the next 06:00. */
function reminderAt(dateISO, now) {
  const [y, m, d] = addDays(dateISO, -3).split('-').map(Number);
  let at = T.fromLocal(y, m - 1, d, 6, 0);
  if (at <= now) { const [ty, tm, td] = T.isoLocalDate(now).split('-').map(Number); at = T.fromLocal(ty, tm - 1, td, 6, 0); if (at <= now) at = new Date(at.getTime() + 86400000); }
  return at;
}
const line = (x) => `${x.no}) ${x.date}${x.moved ? ` (moved from ${x.moved})` : ''}  ${rs(x.amount)}  clears ${x.clears}`;

async function handlePlan(it, { store, now = () => new Date() }) {
  const n = now(), today = T.isoLocalDate(n);
  const days = it.n * UNIT_DAYS[it.unit];
  const monthly = it.unit === 'months' && it.count === it.n;
  const step = Math.max(1, Math.floor(days / it.count));
  const firstDate = monthly ? P.addMonths(today, 1) : addDays(today, it.unit === 'days' ? it.n : step);
  const dueBy = it.unit === 'months' ? P.addMonths(today, it.n) : addDays(today, days);
  const plan = P.planSchedule({ total: it.total, count: it.count, firstDate, everyMonths: monthly ? 1 : 0, everyDays: step, vendorDueDate: dueBy, todayISO: today });
  if (!plan.ok) return { reply: `I cannot make that plan: ${plan.errors.join('; ')}.`, intent: it };
  const planId = n.getTime();
  for (const x of plan.installments) {
    await store.create({ kind: 'PLAN_CHEQUE', title: `Cheque ${x.no}/${plan.installments.length} to ${it.vendor}: ${rs(x.amount)} dated ${x.date}, clears ${x.clears}. Keep the cash ready.`,
      dueAt: reminderAt(x.date, n), meta: { planId, no: x.no, vendor: it.vendor, amount: x.amount, date: x.date, clears: x.clears, dueBy }, nagEveryMin: 60, maxNags: 1 });
  }
  const week = P.weeklySetAside(plan.installments, today);
  return { reply: `Plan: ${it.vendor}, ${rs(it.total)}, ${plan.installments.length} cheque${plan.installments.length > 1 ? 's' : ''}, all within ${dueBy}.\n${plan.installments.map(line).join('\n')}\nSet aside about ${rs(week)} a week.\nI will remind you at 6 am, 3 days before each one.\n${GUARD}\nTo change one: "move cheque 2 to 20th".`, intent: it, plan };
}

async function handleMove(it, { store, now = () => new Date() }) {
  if (!it.date && !it.day) return { reply: 'Which date? For example "move cheque 2 to 20th" or "move cheque 2 to 20 dec".', intent: it };
  const n = now(), today = T.isoLocalDate(n);
  const open = (await store.listOpen()).filter((t) => t.kind === 'PLAN_CHEQUE' && t.meta);
  if (!open.length) return { reply: 'I have no open plan. Start one: "plan 680000 Metro 4 months".', intent: it };
  const planId = Math.max(...open.map((t) => Number(t.meta.planId)));
  const cur = open.filter((t) => Number(t.meta.planId) === planId);
  const task = cur.find((t) => Number(t.meta.no) === it.no);
  if (!task) return { reply: `Cheque ${it.no} is not open in the latest plan (${cur.map((t) => t.meta.no).join(', ')}).`, intent: it };
  let target = it.date;
  if (!target) {                                                                      // "20th" = the 20th of this cheque's own month; if that has passed, the next month
    const [cy, cm] = task.meta.date.split('-').map(Number); let y = cy, mo = cm;
    for (let i = 0; i < 14; i++) {
      if (it.day <= new Date(Date.UTC(y, mo, 0)).getUTCDate()) { const d = `${y}-${String(mo).padStart(2, '0')}-${String(it.day).padStart(2, '0')}`; if (d >= today) { target = d; break; } }
      mo++; if (mo > 12) { mo = 1; y++; }
    }
    if (!target) return { reply: `There is no ${it.day}th I can use. Try a full date like "move cheque ${it.no} to 20 dec".`, intent: it };
  }
  const mv = P.moveCheque([{ no: it.no, date: task.meta.date, moved: null, amount: task.meta.amount, clears: task.meta.clears }], it.no, target, today);
  if (!mv.ok) return { reply: `I cannot move it: ${mv.errors.join('; ')}.`, intent: it };
  const x = mv.installments[0], meta = { ...task.meta, date: x.date, clears: x.clears };
  if (meta.dueBy && x.date > meta.dueBy) return { reply: `I will not move it: ${x.date} is after the date the vendor agreed (${meta.dueBy}). Ask the vendor first.`, intent: it };
  await store.done(task.id);
  await store.create({ kind: 'PLAN_CHEQUE', title: `Cheque ${x.no} to ${meta.vendor}: ${rs(x.amount)} dated ${x.date}, clears ${x.clears}. Keep the cash ready.`, dueAt: reminderAt(x.date, n), meta, nagEveryMin: 60, maxNags: 1 });
  return { reply: `Cheque ${x.no} to ${meta.vendor} now dated ${x.date}${x.moved ? ` (${x.moved} is a weekend or holiday)` : ''}, clears ${x.clears}. Reminder moved. Keep it inside the date the vendor agreed.`, intent: it };
}
module.exports = { handlePlan, handleMove, reminderAt };
