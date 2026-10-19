'use strict';
/**
 * Photo of a GRN or a cheque, sent by the OWNER with the caption "GRN" or "cheque" -> read into a DRAFT -> summary on WhatsApp.
 * Nothing touches stock or the cheque tables until the owner replies "ok". "fix line 5 qty 20" edits, "cancel" drops.
 * deps: { pool, readPaper(file, kind)->{ok, doc, engine}, saveGrn(draft)->{ok, message}, saveCheque(draft)->{ok, message}, now() }
 */
const { checkGrn, checkCheque } = require('../utils/paper_checks');
const money = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '?');
const todaySL = (now) => new Date(now.getTime() + 5.5 * 3600e3).toISOString().slice(0, 10);

/** The vision reading -> the draft shape used by utils/paper_checks.js */
function toDraft(kind, doc, now = new Date()) {
  if (kind === 'cheque') {
    return { kind, amount_digits: doc.amount_digits ?? doc.amount ?? null, amount_words: doc.amount_words || '', date: doc.date || doc.due_date || null, payee: doc.payee || '', bank: doc.bank || '', cheque_no: doc.cheque_no || doc.cheque_number || '' };
  }
  const items = doc.items || doc.lines || [];
  const lines = items.map((l, i) => {
    const qty = Number(l.qty), cost = Number(l.unit_cost ?? l.unit_price);
    const lt = l.line_total ?? l.amount;
    return { line_no: i + 1, code: l.item_code || l.code || '', name: l.description || l.name || '', qty, unit_cost: cost, line_total: lt != null ? Number(lt) : qty * cost };
  });
  return { kind, supplier: doc.supplier_name || doc.supplier || '', invoice_no: doc.grn_number || doc.invoice_no || '', date: doc.date || todaySL(now), total: doc.total != null ? Number(doc.total) : null, lines };
}
const runChecks = (d) => (d.kind === 'cheque' ? checkCheque(d) : checkGrn(d));

function summary(id, d, checks, engine) {
  const out = [];
  if (d.kind === 'cheque') {
    out.push(`CHEQUE DRAFT #${id} (nothing saved yet)`, `Payee: ${d.payee || '?'}`, `Amount (digits): ${money(d.amount_digits)}`, `Amount (words): ${d.amount_words || '?'}`, `Date: ${d.date || '?'}  Bank: ${d.bank || '?'}  No: ${d.cheque_no || '?'}`);
  } else {
    out.push(`GRN DRAFT #${id} (nothing saved yet)`, `Supplier: ${d.supplier || '?'} | Invoice: ${d.invoice_no || '?'} | Date: ${d.date}`);
    d.lines.slice(0, 30).forEach((l, i) => out.push(`${i + 1}. ${l.code ? l.code + ' ' : ''}${l.name} x${l.qty} @ ${money(l.unit_cost)} = ${money(l.line_total)}`));
    if (d.lines.length > 30) out.push(`...and ${d.lines.length - 30} more lines`);
    out.push(`Total on paper: ${d.total != null ? money(d.total) : '?'} | Lines add up: ${money(checks.computed_total)}`);
  }
  out.push(checks.warnings.length ? 'CHECKS:\n! ' + checks.warnings.join('\n! ') : 'CHECKS: all OK');
  out.push(d.kind === 'cheque' ? 'Reply: ok = save | fix amount 25000 / payee X / date 2026-10-20 | cancel' : 'Reply: ok = save | fix line 5 qty 20 | cancel');
  if (engine) out.push(`(read by: ${engine})`);
  return out.join('\n');
}

function applyFix(d, text) {
  const t = text.trim();
  let m;
  if (d.kind === 'cheque') {
    if (!(m = t.match(/^fix\s+(amount|words|payee|date|bank|no)\s+(.+)$/i))) return null;
    const f = m[1].toLowerCase(), v = m[2].trim();
    if (f === 'amount') d.amount_digits = Number(v.replace(/,/g, ''));
    else if (f === 'words') d.amount_words = v;
    else if (f === 'payee') d.payee = v;
    else if (f === 'date') d.date = v;
    else if (f === 'bank') d.bank = v;
    else d.cheque_no = v;
    return d;
  }
  if (!(m = t.match(/^fix\s+line\s+(\d+)\s+(qty|price|cost|code|name|total)\s+(.+)$/i))) {
    if ((m = t.match(/^fix\s+(supplier|invoice|date|total)\s+(.+)$/i))) {
      const f = m[1].toLowerCase(), v = m[2].trim();
      if (f === 'supplier') d.supplier = v;
      else if (f === 'invoice') d.invoice_no = v;
      else if (f === 'date') d.date = v;
      else d.total = Number(v.replace(/,/g, ''));
      return d;
    }
    return null;
  }
  const idx = Number(m[1]) - 1, l = d.lines[idx];
  if (!l) return { error: `There is no line ${m[1]}. The paper has ${d.lines.length} lines.` };
  const f = m[2].toLowerCase(), v = m[3].trim();
  if (f === 'qty') l.qty = Number(v);
  else if (f === 'price' || f === 'cost') l.unit_cost = Number(v.replace(/,/g, ''));
  else if (f === 'code') l.code = v;
  else if (f === 'name') l.name = v;
  else l.line_total = Number(v.replace(/,/g, ''));
  if (f === 'qty' || f === 'price' || f === 'cost') l.line_total = Math.round(l.qty * l.unit_cost * 100) / 100;
  return d;
}

module.exports = function createPaperIntake({ pool, readPaper, saveGrn, saveCheque, now = () => new Date() }) {
  let ready = null;
  const ensure = () => ready || (ready = pool.query(`CREATE TABLE IF NOT EXISTS paper_drafts (id SERIAL PRIMARY KEY, kind TEXT NOT NULL, draft JSONB NOT NULL, engine TEXT, source_file TEXT, status TEXT NOT NULL DEFAULT 'draft', created_at TIMESTAMPTZ DEFAULT NOW())`));
  const pending = async () => { await ensure(); const r = await pool.query(`SELECT * FROM paper_drafts WHERE status='draft' ORDER BY id DESC LIMIT 1`); return r.rows[0] || null; };

  /** caption "grn" / "cheque" on a photo */
  const captionKind = (cap) => { const w = String(cap || '').trim().toLowerCase().match(/^(grn|cheque|check)\b/); return w ? (w[1] === 'grn' ? 'grn' : 'cheque') : null; };

  async function start(kind, file) {
    await ensure();
    const r = await readPaper(file, kind);
    if (!r || !r.ok) return { reply: (r && r.message) || 'I could not read that paper clearly. Please send a straighter, brighter photo, or add the GRN in the app.' };
    const d = toDraft(kind, r.doc, now()); const checks = runChecks(d);
    await pool.query(`UPDATE paper_drafts SET status='cancelled' WHERE status='draft'`);
    const ins = await pool.query(`INSERT INTO paper_drafts (kind, draft, engine, source_file) VALUES ($1,$2,$3,$4) RETURNING id`, [kind, JSON.stringify(d), r.engine || null, file || null]);
    return { reply: summary(ins.rows[0].id, d, checks, r.engine), id: ins.rows[0].id };
  }

  /** Returns { reply } when the text was about the pending draft, or null when it is not for us. */
  async function handleText(text) {
    const t = String(text || '').trim();
    if (!/^(ok|cancel|fix\b)/i.test(t)) return null;
    const row = await pending();
    if (!row) return null;
    const d = typeof row.draft === 'string' ? JSON.parse(row.draft) : row.draft;
    if (/^cancel$/i.test(t)) { await pool.query(`UPDATE paper_drafts SET status='cancelled' WHERE id=$1`, [row.id]); return { reply: `Draft #${row.id} dropped. Nothing was saved.` }; }
    if (/^ok$/i.test(t)) {
      const checks = runChecks(d);
      if (checks.kind === 'purchase_return') return { reply: `Draft #${row.id} looks like a purchase RETURN (negative quantities), not a GRN. Nothing saved. Reply "cancel" and enter the return in the app.` };
      const res = d.kind === 'cheque' ? await saveCheque(d) : await saveGrn(d);
      if (!res.ok) return { reply: `Could not save draft #${row.id}: ${res.message}\nNothing was saved. Fix it ("fix ...") or reply "cancel".` };
      await pool.query(`UPDATE paper_drafts SET status='saved' WHERE id=$1`, [row.id]);
      return { reply: `Saved. ${res.message}${checks.warnings.length ? `\n(Saved with ${checks.warnings.length} warning(s) you accepted.)` : ''}` };
    }
    const fixed = applyFix(d, t);
    if (!fixed) return { reply: d.kind === 'cheque' ? 'I did not understand. Try: fix amount 25000 | fix payee Name | fix date 2026-10-20 | ok | cancel' : 'I did not understand. Try: fix line 5 qty 20 | fix supplier Name | ok | cancel' };
    if (fixed.error) return { reply: fixed.error };
    await pool.query(`UPDATE paper_drafts SET draft=$2 WHERE id=$1`, [row.id, JSON.stringify(d)]);
    return { reply: summary(row.id, d, runChecks(d), row.engine) };
  }
  return { captionKind, start, handleText, hasPending: async () => !!(await pending()), toDraft, summary };
};
module.exports.toDraft = toDraft;
