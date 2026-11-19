'use strict';
// BILL WATCH (AJ 24 Oct 2026): a vendor bill that does not match (e.g. handwritten bill off by Rs 400). Kept highlighted and in the morning
// message every day until AJ marks it corrected. No money is changed by this list; it is a reminder only.
let ready = null;
function ensure(db) {
  if (!ready) ready = db.query(`CREATE TABLE IF NOT EXISTS vendor_bill_watch (
    id SERIAL PRIMARY KEY, vendor_name TEXT NOT NULL, bill_no TEXT, diff_amount NUMERIC NOT NULL DEFAULT 0, note TEXT,
    status TEXT NOT NULL DEFAULT 'OPEN', created_at TIMESTAMPTZ DEFAULT NOW(), closed_at TIMESTAMPTZ, close_note TEXT)`).catch(e => { ready = null; throw e; });
  return ready;
}
const reset = () => { ready = null; };
async function add(db, { vendor_name, bill_no, diff_amount, note }) {
  await ensure(db);
  const v = String(vendor_name || '').trim(), d = Number(diff_amount);
  if (!v) return { error: 'vendor name needed', code: 400 };
  if (!isFinite(d)) return { error: 'amount of the mismatch needed', code: 400 };
  const dup = await db.query(`SELECT id FROM vendor_bill_watch WHERE status='OPEN' AND LOWER(vendor_name)=LOWER($1) AND COALESCE(bill_no,'')=COALESCE($2,'') AND diff_amount=$3`, [v, bill_no || null, d]);
  if (dup.rows.length) return { ok: true, id: dup.rows[0].id, existing: true };
  const r = await db.query(`INSERT INTO vendor_bill_watch (vendor_name,bill_no,diff_amount,note) VALUES ($1,$2,$3,$4) RETURNING *`, [v, bill_no || null, d, note || null]);
  return { ok: true, item: r.rows[0] };
}
async function list(db, status) { await ensure(db); return (await db.query(`SELECT * FROM vendor_bill_watch WHERE ($1::text IS NULL OR status=$1) ORDER BY status DESC, id`, [status || null])).rows; }
async function close(db, id, note) {
  await ensure(db);
  const r = await db.query(`UPDATE vendor_bill_watch SET status='CLOSED', closed_at=NOW(), close_note=$2 WHERE id=$1 AND status='OPEN' RETURNING id`, [id, note || null]);
  return r.rows.length ? { ok: true } : { error: 'not found or already closed', code: 404 };
}
module.exports = { ensure, reset, add, list, close };
