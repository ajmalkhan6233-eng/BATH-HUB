'use strict';
/**
 * The owner assistant's brain: message in, reply out. deps = { store, adapters, now() }.
 * Rules: (1) writes only tasks and reminders; money records are never changed from a chat message (the reply tells the owner what to confirm);
 *        (2) never invents numbers: if data is not wired it says so; (3) short, plain replies that fit a phone screen.
 */
const { parseOwnerMessage } = require('./intentParser');
const { fmtLocal } = require('./timeParse');
const rs = (n) => `Rs. ${Math.round(Number(n) || 0).toLocaleString('en-US')}`;
const HELP = `Talk to me like a person. Examples:
- "Fazal Hardware bill pending, remind me by evening"
- "I wrote a 1 million cheque, clears tomorrow, remind me this evening"
- "stock of angle valve" / "price of bidet spray"
- "cheques tomorrow" / "cash gap" / "how much do we owe Eskema"
- "what's pending" / "done 3" / "snooze 3 2 hours"`;

async function handleOwnerMessage(msg, { store, adapters, now = () => new Date() }) {
  const n = now(); const text = typeof msg === 'string' ? msg : (msg.text || ''); const srcId = typeof msg === 'string' ? null : (msg.id || null);
  const it = parseOwnerMessage(text, n);
  switch (it.type) {
    case 'EMPTY': return { reply: 'Say it again?', intent: it };
    case 'HELP': return { reply: HELP, intent: it };
    case 'PENDING_BILL': {
      const who = it.vendor || 'a supplier'; const t = await store.create({ kind: 'BILL_PENDING', title: `Enter ${who} bill into the GRN${it.amount ? ` (${rs(it.amount)})` : ''}`, dueAt: it.remindAt, sourceMsgId: srcId, meta: { vendor: it.vendor, amount: it.amount }, nagEveryMin: 60, maxNags: 3 });
      return { reply: `Noted. I will remind you at ${fmtLocal(it.remindAt)} to enter the ${who} bill into the GRN (#${t.id}). Reply "done ${t.id}" when it is in.`, intent: it, taskId: t.id };
    }
    case 'CHEQUE_NOTE': {
      const who = it.vendor ? ` to ${it.vendor}` : ''; const t = await store.create({ kind: 'CHEQUE_NOTE', title: `Cheque ${rs(it.amount)}${who}, clears ${it.date}. Record it in the Vendor Ledger and check cash`, dueAt: it.remindAt, sourceMsgId: srcId, meta: { vendor: it.vendor, amount: it.amount, date: it.date }, nagEveryMin: 90, maxNags: 3 });
      let extra = ''; try { const g = await adapters.cashGap(0); if (g && g.due > 0) extra = ` Cheques due in the next 2 days now total ${rs(g.due)}.`; } catch (_) {}
      return { reply: `Noted: cheque ${rs(it.amount)}${who} clears ${it.date}.${extra} I will remind you at ${fmtLocal(it.remindAt)} (#${t.id}). I have not added it to the ledger: open Vendor Ledger and add the cheque to its bill so the payable stays right.`, intent: it, taskId: t.id };
    }
    case 'REMIND': { const t = await store.create({ kind: 'REMIND', title: it.subject, dueAt: it.remindAt, sourceMsgId: srcId, nagEveryMin: 60, maxNags: 2 }); return { reply: `Reminder set for ${fmtLocal(it.remindAt)}: ${it.subject} (#${t.id}).`, intent: it, taskId: t.id }; }
    case 'DONE': { const t = await store.done(it.id); return { reply: t ? `Done: ${t.title}` : `I could not find an open task #${it.id}.`, intent: it }; }
    case 'SNOOZE': { const t = await store.snooze(it.id, it.until); return { reply: t ? `Snoozed #${it.id} until ${fmtLocal(it.until)}.` : `I could not find an open task #${it.id}.`, intent: it }; }
    case 'TASKS': { const list = await store.listOpen(); if (!list.length) return { reply: 'Nothing pending.', intent: it }; return { reply: list.slice(0, 10).map((t) => `#${t.id} ${t.title} (${fmtLocal(t.due_at)})`).join('\n'), intent: it }; }
    case 'STOCK_QUERY': case 'PRICE_QUERY': {
      const q = it.q; if (!q) return { reply: 'Which item? For example "stock of angle valve".', intent: it };
      const rows = it.type === 'STOCK_QUERY' ? await adapters.stock(q) : await adapters.price(q);
      if (rows === null) return { reply: 'I cannot see the stock list yet. Ask Claude Code to connect it (layla_owner/adapters.js, ADAPT 1).', intent: it };
      if (!rows.length) return { reply: `No item matches "${q}". Try another word or the item code.`, intent: it };
      return { reply: rows.slice(0, 5).map((r) => `${r.name}${r.code ? ` (${r.code})` : ''}: ${it.type === 'STOCK_QUERY' ? `${r.qty} in stock, ` : ''}${rs(r.price)}`).join('\n'), intent: it };
    }
    case 'CHEQUES_DUE': { const c = await adapters.cheques(); return { reply: `Cheques due: today ${rs(c.today)}, tomorrow ${rs(c.tomorrow)}, ${c.monday.date} ${rs(c.monday.amount)}. Next 7 days ${rs(c.windows[7])}, 30 days ${rs(c.windows[30])}.${c.overdue.count ? ` ${c.overdue.count} past their date (${rs(c.overdue.amount)}): mark cleared.` : ''}${c.bulkDays.length ? ` Bulk days: ${c.bulkDays.map((d) => `${d.date} ${rs(d.amount)}`).join(', ')}.` : ''}`, intent: it }; }
    case 'CASH_GAP': { const g = await adapters.cashGap(it.cash || 0); return { reply: `Cheques due in the next ${g.days} days: ${rs(g.due)}. ${g.gap > 0 ? `You need ${rs(g.gap)} more than the cash I know about. Tell me your cash on hand: "cash 150000".` : 'Covered.'}`, intent: it }; }
    case 'PAYABLE': { const p = await adapters.payable(it.vendor); if (!p.vendors.length) return { reply: it.vendor ? `Nothing owed to "${it.vendor}".` : 'Nothing owed.', intent: it }; return { reply: `${p.vendors.slice(0, 6).map((v) => `${v.vendor}: ${rs(v.outstanding)} (cheque issued ${rs(v.covered)})`).join('\n')}\nTotal owed ${rs(p.totals.outstanding)}.`, intent: it }; }
    case 'SALES': { const s = await adapters.sales(it.day); if (!s) return { reply: 'I cannot see sales yet. Ask Claude Code to connect it (layla_owner/adapters.js, ADAPT 3).', intent: it }; return { reply: `${it.day === 'today' ? 'Today' : 'Yesterday'}: sales ${rs(s.sales)}, profit ${rs(s.grossProfit)}.`, intent: it }; }
    case 'BRIEF': { const c = await adapters.cheques(); const g = await adapters.cashGap(0); return { reply: `Cheques: today ${rs(c.today)}, tomorrow ${rs(c.tomorrow)}. Next 2 days total ${rs(g.due)}.`, intent: it }; }
    default: return { reply: `I did not get that. Say "help" to see what I understand.`, intent: it };
  }
}
module.exports = { handleOwnerMessage, rs };
