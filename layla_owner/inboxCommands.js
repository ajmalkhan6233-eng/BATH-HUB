'use strict';
// layla_owner/inboxCommands.js
// The owner answers a draft right in WhatsApp (text or voice): a SMALL fixed list of words, nothing else.
//   ok | ok 5 | ok all     file the draft(s) (same checks and same filing code as the Confirm button)
//   cancel 5               drop a draft (nothing is filed)
//   edit 5 amount 1800     change one box (amount, name, date, note, phone, total)
//   force 5                file a draft that came back with a "similar customer" style warning
//   drafts                 list what is waiting
//   create customer Saman 8500 [0771234567]     make a DRAFT for a new customer with opening credit (then: ok N)
// Owner only: the caller (inbound.js) only reaches this for the owner's number. A bare "ok"/"cancel" is left to the paper-draft
// flow (GRN / cheque / bill photos) when one of those is waiting, so the two never fight.

const HELP = 'Reply: ok 5 (file) | cancel 5 | edit 5 amount 1800 | force 5 | drafts | create customer Saman 8500';
const rs = (n) => `Rs ${Number(n || 0).toLocaleString('en-LK')}`;
const todayLK = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(new Date());

// Which box does a word mean, for each kind of draft. Anything else is refused (nothing is guessed).
const FIELD = {
  credit_given:    { amount: 'amount', name: 'customer_name', customer: 'customer_name', date: 'date', note: 'notes', due: 'due_date' },
  credit_paid:     { amount: 'amount', name: 'customer_name', customer: 'customer_name', date: 'date', note: 'notes' },
  customer_create: { amount: 'amount', name: 'customer_name', customer: 'customer_name', phone: 'phone', date: 'date', note: 'notes' },
  expense_sheet:   { amount: 'total_expenses', total: 'total_expenses', date: 'date', note: 'notes' },
  day_sheet:       { amount: 'total_sale', total: 'total_sale', sale: 'total_sale', date: 'date', note: 'notes' },
  cheque:          { amount: 'amount', payee: 'payee', name: 'payee', date: 'due_date', bank: 'bank', note: 'notes' },
  grn:             { supplier: 'supplier_name', name: 'supplier_name', date: 'date', total: 'total', note: 'notes' },
  manual_bill:     { customer: 'customer_name', name: 'customer_name', date: 'date', total: 'total', phone: 'customer_phone', note: 'notes' },
};
const NUMERIC = new Set(['amount', 'total_expenses', 'total_sale', 'total']);

function parse(text) {
  const t = String(text || '').trim().replace(/[.!\s]+$/, '');
  let m;
  if ((m = t.match(/^(?:create|add|new|open)\s+customer\s+(.+)$/i))) {
    let rest = m[1].trim(); let phone = '';
    const pm = rest.match(/(?:^|\s)((?:\+?94|0)\d{9})\s*$/); if (pm) { phone = pm[1]; rest = rest.slice(0, pm.index).trim(); }
    let amount = null; const am = rest.match(/(?:^|\s)(?:rs\.?\s*|lkr\s*)?([\d,]+(?:\.\d+)?)\s*$/i);
    if (am) { amount = Number(am[1].replace(/,/g, '')); rest = rest.slice(0, am.index).trim(); }
    return { cmd: 'create', name: rest.replace(/^(?:called|named)\s+/i, ''), amount, phone };
  }
  if (/^(drafts|pending drafts|show drafts|list drafts)$/i.test(t)) return { cmd: 'list' };
  if ((m = t.match(/^(?:ok|okay|confirm|file|yes)(?:\s+#?(\d+|all))?$/i))) return { cmd: 'ok', id: m[1] ? (/all/i.test(m[1]) ? 'all' : Number(m[1])) : null };
  if ((m = t.match(/^(?:cancel|reject|drop)(?:\s+#?(\d+))?$/i))) return { cmd: 'cancel', id: m[1] ? Number(m[1]) : null };
  if ((m = t.match(/^force\s+#?(\d+)$/i))) return { cmd: 'force', id: Number(m[1]) };
  if ((m = t.match(/^edit\s+#?(\d+)\s+([a-z]+)\s+(.+)$/i))) return { cmd: 'edit', id: Number(m[1]), field: m[2].toLowerCase(), value: m[3].trim() };
  return null;
}

function summary(r) {
  const ex = r.extracted || {};
  switch (r.doc_type) {
    case 'credit_given': return `Credit to ${ex.customer_name || '?'} ${rs(ex.amount)} (${ex.date || '?'})`;
    case 'credit_paid': return `${ex.customer_name || '?'} paid ${rs(ex.amount)} (${ex.date || '?'})`;
    case 'customer_create': return `New customer ${ex.customer_name || '?'}${ex.amount > 0 ? `, opening credit ${rs(ex.amount)}` : ', no opening credit'}${ex.phone ? ', ' + ex.phone : ''}`;
    case 'expense_sheet': return `Expenses ${rs(ex.total_expenses)} for ${ex.date || '?'}`;
    case 'day_sheet': return `Sales ${rs(ex.total_sale)} for ${ex.date || '?'}`;
    default: return `${r.type_label || r.doc_type} #${r.id}`;
  }
}

function createInboxCommands({ inbox }) {
  const box = () => (typeof inbox === 'function' && !inbox.act ? inbox() : inbox);   // a getter, or the router itself

  async function recent() {
    const rows = await box().list('to_check');
    const cut = Date.now() - 12 * 3600e3;
    return rows.filter((r) => (r.source === 'voice' || r.source === 'whatsapp') && new Date(r.created_at).getTime() >= cut).sort((a, b) => a.id - b.id);
  }
  async function fileOne(id, force) {
    const out = await box().act('file', id, force ? { accept_warnings: true } : {});
    if (out.status === 200) return { ok: true, line: `FILED #${id}: ${(out.body && out.body.filed_note) || 'done'}` };
    const b = out.body || {};
    if (b.code === 'needs_confirmation') return { ok: false, line: `#${id} needs your OK: ${(b.warnings || [b.error]).slice(0, 2).join(' | ')}. Reply "force ${id}" to file anyway, or "cancel ${id}".` };
    return { ok: false, line: `#${id} NOT filed: ${b.error || 'unknown reason'} Nothing was saved.` };
  }

  async function handle(text, { from = '', paperPending = false } = {}) {
    const c = parse(text);
    if (!c) return null;
    if (c.cmd === 'create') {
      if (!c.name || c.name.length < 2 || !/[a-z඀-෿஀-௿]/i.test(c.name)) return { reply: 'Tell me the name: create customer Saman 8500' };
      const like = await box().customerLike(c.name).catch(() => ({ exact: [], similar: [] }));
      if (like.exact.length) return { reply: `${like.exact[0].name} is already a customer. No draft made. To add credit say: give credit 1500 to ${like.exact[0].name}` };
      const d = await box().recordText({ type: 'customer_create', fields: { customer_name: c.name, amount: c.amount, phone: c.phone, date: todayLK() }, from, note: `Typed: "${String(text).slice(0, 120)}"` });
      const sim = like.similar.length ? `\n! Similar already there: ${like.similar.slice(0, 3).map((x) => x.name).join(', ')}. If it is the same person, cancel ${d.id}.` : '';
      return { reply: `Draft #${d.id}: ${summary(d)}. NOTHING is made yet.${sim}\nReply "ok ${d.id}" to make it, or "cancel ${d.id}".` };
    }
    if (c.cmd === 'list') {
      const rows = await recent();
      return { reply: rows.length ? rows.map((r) => `#${r.id} ${summary(r)}`).join('\n') + '\n' + HELP : 'No drafts waiting.' };
    }
    if ((c.cmd === 'ok' || c.cmd === 'cancel') && c.id == null && paperPending) return null;   // the GRN / cheque / bill draft flow owns a bare ok / cancel
    if (c.cmd === 'ok' && c.id === 'all') {
      const rows = await recent(); if (!rows.length) return { reply: 'No drafts waiting.' };
      const lines = []; for (const r of rows) lines.push((await fileOne(r.id, false)).line);
      return { reply: lines.join('\n') };
    }
    if (c.cmd === 'ok' || c.cmd === 'cancel') {
      let id = c.id;
      if (id == null) {
        const rows = await recent();
        if (!rows.length) return null;          // nothing waiting: it is just an ordinary "ok"
        if (rows.length > 1) return { reply: `${rows.length} drafts are waiting. Which one?\n${rows.map((r) => `#${r.id} ${summary(r)}`).join('\n')}\nReply "${c.cmd} ${rows[0].id}"${c.cmd === 'ok' ? ' or "ok all"' : ''}.` };
        id = rows[0].id;
      }
      if (c.cmd === 'cancel') {
        const out = await box().act('reject', id);
        return { reply: out.status === 200 ? `Cancelled #${id}. Nothing was filed.` : `#${id}: ${(out.body && out.body.error) || 'could not cancel'}` };
      }
      return { reply: (await fileOne(id, false)).line };
    }
    if (c.cmd === 'force') return { reply: (await fileOne(c.id, true)).line };
    if (c.cmd === 'edit') {
      const row = (await box().list('to_check')).find((r) => r.id === c.id);
      if (!row) return { reply: `No draft #${c.id} is waiting.` };
      const map = FIELD[row.doc_type];
      const f = map && map[c.field];
      if (!f) return { reply: `For #${c.id} (${row.type_label}) you can edit: ${map ? [...new Set(Object.keys(map))].join(', ') : 'nothing here, use the app'}.` };
      let v = c.value;
      if (NUMERIC.has(f)) { const n = Number(String(v).replace(/^(rs\.?|lkr)\s*/i, '').replace(/,/g, '')); if (!Number.isFinite(n) || n < 0) return { reply: `"${v}" is not an amount. Example: edit ${c.id} amount 1800` }; v = n; }
      if (f === 'date' || f === 'due_date') { if (/^today$/i.test(v)) v = todayLK(); else if (/^yesterday$/i.test(v)) v = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(new Date(Date.now() - 864e5)); else if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return { reply: 'Dates: today, yesterday, or 2026-10-18.' }; }
      const out = await box().act('edit', c.id, { doc_type: row.doc_type, extracted: { ...row.extracted, [f]: v } });
      if (out.status !== 200) return { reply: `#${c.id} not changed: ${(out.body && out.body.error) || 'error'}` };
      return { reply: `Edited #${c.id}: ${summary(out.body)}.\nReply "ok ${c.id}" to file it, or "cancel ${c.id}".` };
    }
    return null;
  }
  return { handle, parse, summary, HELP };
}
module.exports = { createInboxCommands, parse, summary, HELP };
