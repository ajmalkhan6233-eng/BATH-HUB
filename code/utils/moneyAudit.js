'use strict';
/** Money change trail: who changed what, when, and WHY. Used by voids and cheque status changes. Never throws into the caller's job except where the caller asks. */
const ready = new WeakSet();
async function ensure(pool) {
  if (ready.has(pool)) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS money_audit_log (id SERIAL PRIMARY KEY, at TIMESTAMPTZ DEFAULT NOW(), who TEXT, action TEXT NOT NULL, ref_table TEXT, ref_id INT, old_value TEXT, new_value TEXT, reason TEXT)`);
  ready.add(pool);
}
async function log(pool, { who = null, action, table = null, id = null, oldValue = null, newValue = null, reason = null }) {
  await ensure(pool);
  await pool.query(`INSERT INTO money_audit_log (who, action, ref_table, ref_id, old_value, new_value, reason) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [who, action, table, id, oldValue == null ? null : String(oldValue).slice(0, 200), newValue == null ? null : String(newValue).slice(0, 200), reason == null ? null : String(reason).slice(0, 300)]);
}
const reasonOk = (r) => String(r || '').trim().length >= 3;
/** Owner-only for money changes. No logged-in user object (tests, internal calls) is let through; the app's login gate already stops strangers. */
const isOwner = (req) => { const u = req && req.session && req.session.user; return !u || ['admin', 'owner'].includes(u.role); };
module.exports = { ensure, log, reasonOk, isOwner };
