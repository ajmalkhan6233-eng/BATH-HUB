'use strict';
// STOCK LEDGER (queue job 4, PHASE 1): every stock change gets one line (who, what, why). Additive: a NEW table only.
// Phase 1 records POS sales. GRN in/out, voids and manual changes are phase 2 (each hook added and tested alone).
async function ensure(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS stock_movements (id SERIAL PRIMARY KEY, item_code TEXT NOT NULL, qty_change NUMERIC(12,2) NOT NULL, reason TEXT NOT NULL, ref_type TEXT, ref_id TEXT, note TEXT, created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await db.query(`CREATE INDEX IF NOT EXISTS stock_movements_item_idx ON stock_movements (item_code, created_at)`);
}
async function record(db, m) {
  const code = String((m && m.item_code) || '').trim(); const q = Number(m && m.qty_change);
  if (!code) throw new Error('item_code is required'); if (!Number.isFinite(q) || q === 0) throw new Error('qty_change must be a non-zero number');
  const r = await db.query(`INSERT INTO stock_movements (item_code, qty_change, reason, ref_type, ref_id, note, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [code, q, String(m.reason || 'adjust'), m.ref_type || null, m.ref_id == null ? null : String(m.ref_id), m.note || null, m.created_by || null]);
  return r.rows[0];
}
// Inside a bill's transaction: a failed ledger line must never spoil the bill, so it runs in its own savepoint.
async function recordSafe(client, m) {
  await client.query('SAVEPOINT stock_ledger');
  try { const r = await record(client, m); await client.query('RELEASE SAVEPOINT stock_ledger'); return r; }
  catch (e) { await client.query('ROLLBACK TO SAVEPOINT stock_ledger').catch(() => {}); console.error('[stock_ledger]', e.message); return null; }
}
async function history(db, code, limit) {
  const n = Math.min(500, Math.max(1, Number(limit) || 50));
  return (await db.query(`SELECT id, qty_change, reason, ref_type, ref_id, note, created_at FROM stock_movements WHERE item_code = $1 ORDER BY id DESC LIMIT ${n}`, [String(code)])).rows;
}
module.exports = { ensure, record, recordSafe, history };
