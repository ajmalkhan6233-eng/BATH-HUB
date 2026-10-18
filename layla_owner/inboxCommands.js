'use strict';
// layla_owner/inboxCommands.js
// The owner answers a draft right in WhatsApp (text or voice) with a SMALL list of words, and NEVER needs a draft number:
//   ok / yes / confirm        file the LATEST open draft (from the last 12 hours)
//   ok all                    file every open draft from today
//   ok saman / cancel tea     pick a draft by words (name, shop, item, date). 2+ match: one short question, answer 1 or 2
//   cancel                    drop the latest draft (nothing is filed)
//   edit amount 600           change one box of the latest draft (edit saman amount 600 picks by words)
//   force                     file the latest draft that came back with a "similar customer" style warning
//   drafts                    list what is waiting
//   create customer Saman 8500 [0771234567]    a DRAFT for a new customer with opening credit (then: ok)
// Every reply names the draft in words ("Saman credit Rs 1,500, 18 Oct"). A number still works ("ok 5") but is never needed.
// Owner only: inbound.js reaches this only for the owner's number. A bare ok/cancel goes to the paper-draft flow (GRN / cheque / bill
// photos with a caption) when one of those is waiting, so the two never fight. Filing uses the SAME code as the Confirm button.

const HELP = 'Reply: ok | cancel | edit amount 600 | ok all | drafts | create customer Saman 8500';
const rs = (n) => `Rs ${Number(n || 0).toLocaleString('en-LK')}`;
const lk = (ms = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(new Date(ms));
const todayLK = () => lk();
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dshort = (d) => { const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${Number(m[3])} ${MON[Number(m[2]) - 1]}` : ''; };
const RECENT_MS = 12 * 3600e3;
const CHOICE_MS = 5 * 60e3;

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
const FIELD_WORDS = new Set(Object.values(FIELD).flatMap((m) => Object.keys(m)));
const FILLER = new Set(['the', 'a', 'an', 'draft', 'drafts', 'last', 'latest', 'it', 'this', 'that', 'please', 'pls', 'now', 'one', 'my', 'for', 'to', 'is', 'are', 'test', 'thanks', 'thank', 'you', 'sir', 'file', 'ok', 'okay']);
// The FIRST word is the command; trailing words ("cancel, this is a test", "ok please") are chatter. Sinhala / Tamil words too.
const OK_WORDS = new Set(['ok', 'okay', 'yes', 'confirm', 'file', 'sure', 'yep', 'ඔව්', 'හරි', 'ஆம்', 'சரி']);
const CANCEL_WORDS = new Set(['cancel', 'reject', 'drop', 'delete', 'එපා', 'අවලංගු', 'ரத்து']);
const tokens = (t) => String(t || '').trim().split(/[\s,.:;!?]+/).filter(Boolean);

/** The draft named in words, no number: "Saman credit Rs 1,500, 18 Oct". */
function label(r) {
  const ex = r.extracted || {}; const d = dshort(ex.date || ex.due_date); const tail = d ? `, ${d}` : '';
  switch (r.doc_type) {
    case 'credit_given': return `${ex.customer_name || 'Customer'} credit ${rs(ex.amount)}${tail}`;
    case 'credit_paid': return `${ex.customer_name || 'Customer'} paid ${rs(ex.amount)}${tail}`;
    case 'customer_create': return `New customer ${ex.customer_name || ''}${ex.amount > 0 ? `, opening credit ${rs(ex.amount)}` : ', no opening credit'}${ex.phone ? ', ' + ex.phone : ''}`;
    case 'expense_sheet': return `Expenses ${rs(ex.total_expenses)}${tail}`;
    case 'day_sheet': return `Sales ${rs(ex.total_sale)}${tail}`;
    case 'cheque': return `Cheque ${ex.payee || ''} ${rs(ex.amount)}${tail}`.replace(/\s+/g, ' ');
    case 'grn': return `GRN ${ex.supplier_name || ''}${ex.total ? ' ' + rs(ex.total) : ''}${tail}`.replace(/\s+/g, ' ');
    case 'manual_bill': return `Bill ${ex.customer_name || ex.customer_phone || ''}${ex.total ? ' ' + rs(ex.total) : ''}${tail}`.replace(/\s+/g, ' ');
    default: return `${r.type_label || r.doc_type}${tail}`;
  }
}

function words(sel) {
  return String(sel || '').toLowerCase().replace(/[^a-z0-9඀-෿஀-௿\s]/g, ' ').split(/\s+/).filter((w) => w && !FILLER.has(w));
}
/** Which drafts does "saman" / "tea" / "metro grn" mean? Every word must appear in the draft's label or what was read from it. */
function matches(rows, sel) {
  const toks = words(sel);
  if (!toks.length) return rows;
  return rows.filter((r) => {
    const hay = (label(r) + ' ' + JSON.stringify(r.extracted || {}) + ' ' + (r.reader_note || '') + ' ' + (r.type_label || '')).toLowerCase();
    return toks.every((t) => (t === 'today' ? (r.extracted && r.extracted.date) === todayLK() : t === 'yesterday' ? (r.extracted && r.extracted.date) === lk(Date.now() - 864e5) : hay.includes(t)));
  });
}

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
  const tk = tokens(t); const first = (tk[0] || '').toLowerCase(); const rest = tk.slice(1);
  if (/^(reminders?|overdue|who owes|dues|payment reminders?)$/i.test(t.replace(/[,.!?]+/g, ' ').trim())) return { cmd: 'owing' };
  if (/^(drafts|pending drafts|show drafts|list drafts|pending)$/i.test(t.replace(/[,.!?]+/g, ' ').trim())) return { cmd: 'list' };
  if (OK_WORDS.has(first)) {
    const sel = rest.join(' ');
    const idm = rest.length === 1 && rest[0].match(/^#?(\d+)$/);
    return { cmd: 'ok', all: rest.length === 1 && rest[0].toLowerCase() === 'all', id: idm ? Number(idm[1]) : null, sel: idm || (rest.length === 1 && rest[0].toLowerCase() === 'all') ? '' : sel };
  }
  if (CANCEL_WORDS.has(first)) {
    const idm = rest.length === 1 && rest[0].match(/^#?(\d+)$/);
    return { cmd: 'cancel', id: idm ? Number(idm[1]) : null, sel: idm ? '' : rest.join(' ') };
  }
  if (first === 'force') return { cmd: 'force', sel: rest.join(' ') };
  if (first === 'edit' || first === 'change') {
    let rest = t.replace(/^\S+\s*/, '').replace(/[;!?]+/g, ' ').replace(/,(?=\s|$)/g, '').trim(); let id = null; const im = rest.match(/^#?(\d+)\s+(.+)$/); if (im) { id = Number(im[1]); rest = im[2]; }
    const toks = rest.split(/\s+/); const at = toks.findIndex((w) => FIELD_WORDS.has(w.toLowerCase()));
    if (at < 0 || at === toks.length - 1) return { cmd: 'edit', bad: true, id, sel: '' };
    return { cmd: 'edit', id, sel: toks.slice(0, at).join(' '), field: toks[at].toLowerCase(), value: toks.slice(at + 1).join(' ') };
  }
  return null;
}

function createInboxCommands({ inbox }) {
  const box = () => (typeof inbox === 'function' && !inbox.act ? inbox() : inbox);   // a getter, or the router itself
  const choices = new Map();   // from -> { action, ids, payload, at }: "which one? 1 or 2"

  async function openDrafts() { return (await box().list('to_check')).sort((a, b) => a.id - b.id); }
  const recent = (rows) => rows.filter((r) => new Date(r.created_at).getTime() >= Date.now() - RECENT_MS);

  /** Picks the one draft meant, or says what to ask. { row } | { ask } | { none } */
  async function pick({ id, sel }, { from, action, payload }) {
    const all = await openDrafts();
    if (id != null) { const r = all.find((x) => x.id === id); return r ? { row: r } : { none: 'That draft is not waiting any more.' }; }
    if (!sel) { const r = recent(all).pop(); return r ? { row: r } : { none: null }; }
    const hits = matches(all, sel);
    if (!hits.length) {
      const latest = recent(all).pop();
      if (action === 'cancel' && latest) return { row: latest };                  // "cancel, this is a test": the extra words are chatter
      if (action === 'ok' && words(sel).length > 2) return { none: null, chat: true };   // a long sentence is just talk, not a command
      return { none: `Nothing waiting matches "${sel}".${latest ? ` The latest is: ${label(latest)}. Reply "ok" to file that.` : ''}` };
    }
    if (hits.length === 1) return { row: hits[0] };
    const opts = hits.slice(-4);
    choices.set(from, { action, ids: opts.map((r) => r.id), payload, at: Date.now() });
    return { ask: `More than one matches. Reply 1 or 2:\n${opts.map((r, i) => `${i + 1}) ${label(r)}`).join('\n')}` };
  }
  async function fileRow(r, force) {
    const out = await box().act('file', r.id, force ? { accept_warnings: true } : {});
    if (out.status === 200) return `FILED: ${label(r)}.${r.doc_type === 'customer_create' && out.body.filed_note ? ' ' + out.body.filed_note + '.' : ''}`;
    const b = out.body || {};
    if (b.code === 'needs_confirmation') return `${label(r)} needs your OK first: ${(b.warnings || [b.error]).slice(0, 2).join(' | ')}\nReply "force" to file it anyway, or "cancel".`;
    return `NOT filed: ${label(r)}. ${b.error || 'Unknown reason.'} Nothing was saved.`;
  }
  async function cancelRow(r) {
    const out = await box().act('reject', r.id);
    return out.status === 200 ? `Cancelled: ${label(r)}. Nothing was filed.` : `${label(r)}: ${(out.body && out.body.error) || 'could not cancel'}`;
  }
  async function editRow(r, field, value) {
    const f = (FIELD[r.doc_type] || {})[field];
    if (!f) return `For "${label(r)}" you can edit: ${FIELD[r.doc_type] ? [...new Set(Object.keys(FIELD[r.doc_type]))].join(', ') : 'nothing here, use the app'}.`;
    let v = value;
    if (NUMERIC.has(f)) { const nm = String(v).replace(/,/g, '').match(/\d+(?:\.\d+)?/); const n = nm ? Number(nm[0]) : NaN; if (!Number.isFinite(n) || n < 0) return `"${v}" is not an amount. Example: edit amount 1800`; v = n; }
    if (f === 'date' || f === 'due_date') { if (/^today$/i.test(v)) v = todayLK(); else if (/^yesterday$/i.test(v)) v = lk(Date.now() - 864e5); else if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'Dates: today, yesterday, or 2026-10-18.'; }
    const out = await box().act('edit', r.id, { doc_type: r.doc_type, extracted: { ...r.extracted, [f]: v } });
    if (out.status !== 200) return `Not changed: ${(out.body && out.body.error) || 'error'}`;
    return `Changed. Now: ${label(out.body)}.\nReply "ok" to file it, or "cancel".`;
  }

  async function handle(text, { from = '', paperPending = false } = {}) {
    const t = String(text || '').trim();
    // answer to "Reply 1 or 2"
    const ch = choices.get(from);
    if (ch && Date.now() - ch.at > CHOICE_MS) choices.delete(from);
    const live = choices.get(from);
    if (live && /^\s*([1-9])\s*$/.test(t)) {
      const id = live.ids[Number(t) - 1]; choices.delete(from);
      if (id == null) return { reply: 'Please reply with one of the numbers I showed.' };
      const r = (await openDrafts()).find((x) => x.id === id); if (!r) return { reply: 'That draft is not waiting any more.' };
      if (live.action === 'ok' || live.action === 'force') return { reply: await fileRow(r, live.action === 'force') };
      if (live.action === 'cancel') return { reply: await cancelRow(r) };
      if (live.action === 'edit') return { reply: await editRow(r, live.payload.field, live.payload.value) };
    }
    const c = parse(text);
    if (!c) return null;
    if (c.cmd === 'create') {
      if (!c.name || c.name.length < 2 || !/[a-z඀-෿஀-௿]/i.test(c.name)) return { reply: 'Tell me the name: create customer Saman 8500' };
      const like = await box().customerLike(c.name).catch(() => ({ exact: [], similar: [] }));
      if (like.exact.length) return { reply: `${like.exact[0].name} is already a customer. No draft made. To add credit say: give credit 1500 to ${like.exact[0].name}` };
      const d = await box().recordText({ type: 'customer_create', fields: { customer_name: c.name, amount: c.amount, phone: c.phone, date: todayLK() }, from, note: `Typed: "${String(text).slice(0, 120)}"` });
      const sim = like.similar.length ? `\n! Similar already there: ${like.similar.slice(0, 3).map((x) => x.name).join(', ')}. If it is the same person, reply "cancel".` : '';
      return { reply: `Draft: ${label(d)}. NOTHING is made yet.${sim}\nReply "ok" to make it, or "cancel".` };
    }
    if (c.cmd === 'owing') {   // a reply to HIS request: who is late, with a ready text he can forward. Nothing is ever sent to customers.
      const list = await box().owing().catch(() => []);
      if (!list.length) return { reply: 'Nobody is past their payment date.' };
      return { reply: list.slice(0, 5).map((x) => `${x.name}: ${rs(x.owed)} since ${dshort(x.since)}${x.phone && !/^NOPHONE/.test(x.phone) ? ' (' + x.phone + ')' : ''}\nText to forward: "Dear ${x.name}, a friendly reminder from Royal Bath Hub, Thihariya: ${rs(x.owed)} is outstanding on your account. Please settle at your convenience. Thank you."`).join('\n\n') + (list.length > 5 ? `\n\n+ ${list.length - 5} more.` : '') };
    }
    if (c.cmd === 'list') {
      const rows = recent(await openDrafts());
      return { reply: rows.length ? rows.map((r) => `- ${label(r)}`).join('\n') + '\n' + HELP : 'No drafts waiting.' };
    }
    if ((c.cmd === 'ok' || c.cmd === 'cancel') && c.id == null && !c.sel && !c.all && paperPending) return null;   // the GRN / cheque / bill photo flow owns a bare ok / cancel
    if (c.cmd === 'ok' && c.all) {
      const rows = (await openDrafts()).filter((r) => lk(new Date(r.created_at).getTime()) === todayLK());
      if (!rows.length) return { reply: 'No drafts from today are waiting.' };
      const lines = []; for (const r of rows) lines.push(await fileRow(r, false));
      return { reply: lines.join('\n') };
    }
    if (c.cmd === 'ok' || c.cmd === 'cancel' || c.cmd === 'force') {
      if (c.cmd === 'ok' && !c.sel && c.id == null && !(recent(await openDrafts())).length) return null;   // nothing waiting: just an ordinary "ok"
      const p = await pick(c, { from, action: c.cmd });
      if (p.ask) return { reply: p.ask };
      if (p.none !== undefined) return p.none ? { reply: p.none } : (c.cmd === 'ok' || p.chat ? null : { reply: 'No drafts waiting.' });
      return { reply: c.cmd === 'cancel' ? await cancelRow(p.row) : await fileRow(p.row, c.cmd === 'force') };
    }
    if (c.cmd === 'edit') {
      if (c.bad) return { reply: 'Example: edit amount 600 (boxes: amount, name, date, note, phone, total)' };
      const p = await pick(c, { from, action: 'edit', payload: { field: c.field, value: c.value } });
      if (p.ask) return { reply: p.ask };
      if (p.none !== undefined) return { reply: p.none || 'No drafts waiting.' };
      return { reply: await editRow(p.row, c.field, c.value) };
    }
    return null;
  }
  return { handle, parse, label, matches, HELP };
}
module.exports = { createInboxCommands, parse, label, matches, HELP };
