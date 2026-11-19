'use strict';
/**
 * Photo of a MANUAL customer bill, sent by the OWNER with the caption "bill" -> read -> sale saved -> text receipt to the customer.
 * Caption words: bill [077xxxxxxx] [credit|card|online|cheque] [customer name]. Nothing said = cash.
 * Audit rule: the photo is only read into a DRAFT. The sale is made and the receipt sent only when the owner replies "ok" (the number is shown back first).
 * Commands: ok | cancel | fix line 2 qty 3 | fix line 2 price 4500 | fix phone 077... | fix pay card | fix ref 123456 | fix name X
 *           phone 077...  = wrong or missing number: fixes it on the last bill and sends the receipt again.   receipts = list receipts that did not go.
 * deps: { pool, readPaper(file,'grn'), createBill(payload)->{ok,bill,message}, sendCustomer(to,text), receiptsLive()->bool, normalizePhone(raw)->'+94..'|null, now() }
 * The receipt is TEXT (the picture send is broken in the WhatsApp library). It goes to the number on the bill only, once per send.
 */
const rs = (n) => Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const r2 = (n) => Math.round(Number(n) * 100) / 100;
const METHODS = ['cash', 'card', 'online', 'cheque', 'credit'];

/** "bill 0771234567 credit Nimal" -> { phone, method, name } */
function parseCaption(cap) {
  let t = String(cap || '').replace(/^\s*(bill|sale)\b/i, ' ');
  let phone = null; const pm = t.match(/(\+?94|0)?\s?7\d[\s-]?\d{3}[\s-]?\d{4}/);
  if (pm) { phone = pm[0].replace(/[^\d+]/g, ''); t = t.replace(pm[0], ' '); }
  let method = 'cash'; const mm = t.match(new RegExp('\\b(' + METHODS.join('|') + ')\\b', 'i'));
  if (mm) { method = mm[1].toLowerCase(); t = t.replace(mm[0], ' '); }
  return { phone, method, name: t.replace(/\s+/g, ' ').trim().slice(0, 100) };
}

function toDraft(doc, cap, now = new Date()) {
  const c = parseCaption(cap);
  const lines = (doc.items || doc.lines || []).map((l, i) => {
    const qty = Number(l.qty), amount = l.amount != null ? Number(l.amount) : null;
    let price = l.unit_price != null ? Number(l.unit_price) : null;
    if ((price == null || !(price >= 0)) && amount != null && qty > 0) price = r2(amount / qty);
    return { line_no: i + 1, name: String(l.name || l.description || '').trim(), qty, unit_price: price, line_total: amount != null ? amount : (price != null ? r2(qty * price) : null) };
  });
  return { lines, total: doc.total != null ? Number(doc.total) : null, discount: Number(doc.discount) || 0, phone: c.phone || doc.customer_phone || '', name: c.name || doc.customer_name || '', method: c.method || 'cash', reference: '', paper_no: doc.bill_number || '', date: doc.date || '' };
}

function check(d) {
  const w = []; let sum = 0;
  if (!d.lines.length) w.push('no items read');
  d.lines.forEach((l) => {
    if (!l.name) w.push(`line ${l.line_no}: no item name`);
    if (!(l.qty > 0)) w.push(`line ${l.line_no}: quantity unreadable`);
    if (!(l.unit_price >= 0) || l.unit_price == null) w.push(`line ${l.line_no}: price missing`);
    else if (l.line_total != null && Math.abs(r2(l.qty * l.unit_price) - r2(l.line_total)) > 0.011) w.push(`line ${l.line_no}: qty x price = ${rs(l.qty * l.unit_price)} but paper says ${rs(l.line_total)}`);
    sum += Number(l.qty) * Number(l.unit_price) || 0;
  });
  sum = r2(sum);
  if (d.total == null) w.push('no total read from the paper');
  else if (Math.abs(sum - (d.total + d.discount)) > 0.011 && Math.abs(sum - d.total) > 0.011) w.push(`items add up to ${rs(sum)} but the paper total is ${rs(d.total)}`);
  if (d.discount) w.push(`discount ${rs(d.discount)} on paper: check it`);
  if (d.method === 'cheque' && !d.reference) w.push('cheque needs its number: reply "fix ref 123456"');
  if (d.method === 'credit' && !d.phone && !d.name) w.push('credit sale needs the customer name or phone');
  return { warnings: w, sum };
}

function receiptText(bill) {
  const out = ['*Royal Bath Hub*', 'Thihariya, Kandy Road | 074 035 5536', '', `Receipt: ${bill.bill_number}`, `Date: ${new Date(bill.created_at || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`];
  if (bill.customer_name) out.push(`Customer: ${bill.customer_name}`);
  out.push('');
  (bill.items || []).forEach((i) => out.push(`${i.item_name}\n  ${Number(i.qty)} x ${rs(i.unit_price)} = ${rs(i.line_total != null ? i.line_total : i.qty * i.unit_price)}`));
  out.push('');
  if (Number(bill.discount_amount) > 0) out.push(`Discount: -${rs(bill.discount_amount)}`);
  out.push(`*TOTAL: Rs. ${rs(bill.total)}*`, `Paid by: ${String(bill.payment_method || 'cash').toUpperCase()}`, '', 'Thank you for shopping at Royal Bath Hub.');
  return out.join('\n');
}

function summary(id, d, checks, saved) {
  const o = [saved ? `SALE SAVED (draft #${id})` : `BILL DRAFT #${id} (nothing saved yet)`, `Customer: ${d.name || '-'} | Phone: ${d.phone || 'none'} | Pay: ${d.method.toUpperCase()}${d.reference ? ' ' + d.reference : ''}`];
  d.lines.slice(0, 25).forEach((l) => o.push(`${l.line_no}. ${l.name} x${l.qty} @ ${l.unit_price != null ? rs(l.unit_price) : '?'}`));
  o.push(`Items add up: ${rs(checks.sum)} | Paper total: ${d.total != null ? rs(d.total) : '?'}`);
  o.push(checks.warnings.length ? 'CHECKS:\n! ' + checks.warnings.join('\n! ') : 'CHECKS: all OK');
  if (!saved) o.push(d.phone ? `Receipt will go to ${String(d.phone).replace(/(\d{3})(\d{3})(\d+)/, '$1 $2 $3')}${d.name ? ' (' + d.name + ')' : ''}. Is that the customer's number?` : 'No customer number: the sale is made, no receipt.', 'Reply: ok = make the sale + send receipt | fix phone 077... | fix line 2 qty 3 | fix pay card | cancel');
  return o.join('\n');
}

function applyFix(d, text) {
  let m; const t = text.trim();
  if ((m = t.match(/^fix\s+line\s+(\d+)\s+(qty|price|name)\s+(.+)$/i))) {
    const l = d.lines[Number(m[1]) - 1]; if (!l) return { error: `There is no line ${m[1]}. The paper has ${d.lines.length} lines.` };
    const v = m[3].trim(); const f = m[2].toLowerCase();
    if (f === 'name') l.name = v; else if (f === 'qty') l.qty = Number(v); else l.unit_price = Number(v.replace(/,/g, ''));
    if (f !== 'name') l.line_total = r2(l.qty * l.unit_price);
    return d;
  }
  if ((m = t.match(/^fix\s+(phone|pay|ref|name|total)\s+(.+)$/i))) {
    const f = m[1].toLowerCase(), v = m[2].trim();
    if (f === 'phone') d.phone = v; else if (f === 'ref') d.reference = v; else if (f === 'name') d.name = v; else if (f === 'total') d.total = Number(v.replace(/,/g, ''));
    else { const p = v.toLowerCase(); if (!METHODS.includes(p)) return { error: `Pay must be one of ${METHODS.join(', ')}.` }; d.method = p; }
    return d;
  }
  return null;
}

module.exports = function createBillSale({ pool, readPaper, createBill, sendCustomer, receiptsLive = () => false, normalizePhone, now = () => new Date() }) {
  let ready = null;
  const ensure = () => ready || (ready = (async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS bill_drafts (id SERIAL PRIMARY KEY, draft JSONB NOT NULL, source_file TEXT, status TEXT NOT NULL DEFAULT 'draft', created_at TIMESTAMPTZ DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS bill_receipts (id SERIAL PRIMARY KEY, bill_id INT, bill_number TEXT, phone TEXT, status TEXT NOT NULL, error TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`);
  })());
  const pending = async () => { await ensure(); const r = await pool.query(`SELECT * FROM bill_drafts WHERE status='draft' ORDER BY id DESC LIMIT 1`); return r.rows[0] || null; };
  const captionKind = (cap) => (/^\s*(bill|sale)\b/i.test(String(cap || '')) ? 'bill' : null);

  /** send the text receipt; records the result. status: sent | not_sent_off | no_phone | failed */
  async function deliver(bill, rawPhone, rowId) {
    const phone = normalizePhone(rawPhone);
    let status = 'sent', error = null;
    if (!phone) { status = 'no_phone'; error = rawPhone ? 'that number is not a Sri Lanka mobile' : 'no number given'; }
    else if (!receiptsLive()) { status = 'not_sent_off'; error = 'receipt sending is switched off'; }
    else { try { await sendCustomer(phone.replace(/\D/g, ''), receiptText(bill)); } catch (e) { status = 'failed'; error = String(e.message || e).slice(0, 200); } }
    if (rowId) await pool.query(`UPDATE bill_receipts SET phone=$2, status=$3, error=$4, updated_at=NOW() WHERE id=$1`, [rowId, phone || String(rawPhone || ''), status, error]);
    else { const r = await pool.query(`INSERT INTO bill_receipts (bill_id, bill_number, phone, status, error) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [bill.id, bill.bill_number, phone || String(rawPhone || ''), status, error]); rowId = r.rows[0].id; }
    return { status, error, phone, rowId };
  }
  const receiptLine = (res) => ({
    sent: `Receipt sent to ...${String(res.phone).slice(-3)}.`,
    not_sent_off: 'Receipt NOT sent: receipt sending is still switched off. The sale is saved.',
    no_phone: 'No customer number, so no receipt. Reply "phone 077xxxxxxx" and I will send it.',
    failed: `Receipt NOT delivered to ...${String(res.phone).slice(-3)} (${res.error}). Wrong number? Reply "phone 077xxxxxxx" and I will send it again.`,
  })[res.status];

  async function makeSale(d) {
    const sub = r2(d.lines.reduce((a, l) => a + r2(l.qty * l.unit_price), 0));
    const pct = d.discount && sub > 0 ? Math.round((d.discount / sub) * 1e6) / 1e4 : 0;
    const total = r2(sub - r2(sub * pct / 100));
    const payload = { customer_name: d.name || null, customer_phone: d.phone || null, discount_pct: pct, notes: `From WhatsApp bill photo${d.paper_no ? ' paper no ' + d.paper_no : ''}`,
      items: d.lines.map((l) => ({ item_name: l.name, qty: l.qty, unit_price: l.unit_price })), payments: [{ method: d.method, amount: total, reference: d.reference || undefined }] };
    const r = await createBill(payload);
    if (!r.ok) return { ok: false, message: r.message };
    const res = await deliver(r.bill, d.phone);
    return { ok: true, bill: r.bill, reply: `Sale ${r.bill.bill_number} saved: Rs. ${rs(r.bill.total)} (${String(r.bill.payment_method).toUpperCase()}). ${receiptLine(res)}` };
  }

  async function start(kind, file, caption) {
    await ensure();
    const r = await readPaper(file, 'grn');
    if (!r || !r.ok) return { reply: 'I could not read that bill clearly. Please send a straighter, brighter photo, or make the sale in the POS.' };
    const d = toDraft(r.doc, caption, now()); const checks = check(d);
    await pool.query(`UPDATE bill_drafts SET status='cancelled' WHERE status='draft'`);
    const ins = await pool.query(`INSERT INTO bill_drafts (draft, source_file) VALUES ($1,$2) RETURNING id`, [JSON.stringify(d), file || null]);
    const id = ins.rows[0].id;
    return { reply: summary(id, d, checks, false), id };
  }

  async function lastReceipt() { await ensure(); const r = await pool.query(`SELECT * FROM bill_receipts ORDER BY id DESC LIMIT 1`); return r.rows[0] || null; }

  async function handleText(text) {
    const t = String(text || '').trim(); await ensure();
    let m;
    if (/^receipts$/i.test(t)) {
      const r = await pool.query(`SELECT bill_number, phone, status, error FROM bill_receipts WHERE status IN ('failed','no_phone','not_sent_off') ORDER BY id DESC LIMIT 10`);
      if (!r.rows.length) return { reply: 'All receipts went out. Nothing waiting.' };
      return { reply: 'Receipts not delivered:\n' + r.rows.map((x) => `${x.bill_number}: ${x.status.replace(/_/g, ' ')}${x.phone ? ' (' + x.phone + ')' : ''}${x.error ? ' - ' + x.error : ''}`).join('\n') + '\nFix: phone 077xxxxxxx (fixes the last bill)' };
    }
    if ((m = t.match(/^(phone|resend)\b\s*(.*)$/i))) {
      const last = await lastReceipt(); if (!last) return null;
      const raw = m[2].trim() || last.phone; if (!raw) return { reply: 'Send the number like this: phone 0771234567' };
      const b = await pool.query(`SELECT * FROM pos_bills WHERE id=$1`, [last.bill_id]); if (!b.rows.length) return { reply: 'I cannot find that bill.' };
      const items = await pool.query(`SELECT * FROM pos_bill_items WHERE bill_id=$1 ORDER BY id`, [last.bill_id]);
      const bill = { ...b.rows[0], items: items.rows };
      const ph = normalizePhone(raw);
      if (ph && m[2].trim()) await pool.query(`UPDATE pos_bills SET customer_phone=$2 WHERE id=$1`, [last.bill_id, ph.replace(/\D/g, '')]);   // the corrected number is kept on the bill
      const res = await deliver(bill, raw, last.id);
      return { reply: `${bill.bill_number}: ${receiptLine(res)}` };
    }
    if (!/^(ok|cancel|fix\b)/i.test(t)) return null;
    const row = await pending(); if (!row) return null;
    const d = typeof row.draft === 'string' ? JSON.parse(row.draft) : row.draft;
    if (/^cancel$/i.test(t)) { await pool.query(`UPDATE bill_drafts SET status='cancelled' WHERE id=$1`, [row.id]); return { reply: `Bill draft #${row.id} dropped. No sale was made.` }; }
    if (/^ok$/i.test(t)) {
      const checks = check(d);
      if (checks.warnings.some((x) => /unreadable|price missing|no item|no total|cheque needs|credit sale needs/.test(x))) return { reply: 'I cannot make the sale yet:\n! ' + checks.warnings.join('\n! ') + '\nFix it ("fix ...") or reply "cancel".' };
      const s = await makeSale(d);
      if (!s.ok) return { reply: `Could not save: ${s.message}\nNo sale was made. Fix it or reply "cancel".` };
      await pool.query(`UPDATE bill_drafts SET status='saved' WHERE id=$1`, [row.id]);
      return { reply: s.reply };
    }
    const fixed = applyFix(d, t);
    if (!fixed) return { reply: 'I did not understand. Try: fix line 2 qty 3 | fix phone 077... | fix pay card | ok | cancel' };
    if (fixed.error) return { reply: fixed.error };
    await pool.query(`UPDATE bill_drafts SET draft=$2 WHERE id=$1`, [row.id, JSON.stringify(d)]);
    return { reply: summary(row.id, d, check(d), false) };
  }
  const cancelDrafts = async () => { try { await ensure(); await pool.query(`UPDATE bill_drafts SET status='cancelled' WHERE status='draft'`); } catch (_) {} };
  return { captionKind, start, handleText, hasPending: async () => !!(await pending()), cancelDrafts };
};

/** One `paper` object for the inbound handler: bills go to billSale, GRN/cheque go to paperIntake. A newer draft replaces an older one of the other kind. */
module.exports.combine = function combine(paper, bill, pool) {
  return {
    captionKind: (cap) => bill.captionKind(cap) || paper.captionKind(cap),
    start: async (kind, file, caption) => {
      if (kind === 'bill') { await pool.query(`UPDATE paper_drafts SET status='cancelled' WHERE status='draft'`).catch(() => {}); return bill.start(kind, file, caption); }
      await bill.cancelDrafts(); return paper.start(kind, file);
    },
    handleText: async (text) => (await bill.handleText(text)) || (await paper.handleText(text)),
    hasPending: async () => (await bill.hasPending()) || (await paper.hasPending()),
  };
};
module.exports.parseCaption = parseCaption; module.exports.receiptText = receiptText; module.exports.toDraft = toDraft; module.exports.check = check;
