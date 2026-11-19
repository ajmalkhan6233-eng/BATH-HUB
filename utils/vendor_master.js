'use strict';
// VENDOR MASTER (queue job 3): one clean row per vendor, filled from the names already used in GRNs and vendor bills.
// Additive: a NEW table only. Golden-core supplier tables are read, never altered. Safe to run again and again.
const clean = (n) => String(n || '').trim().replace(/\s+/g, ' ');
const keyOf = (n) => clean(n).toLowerCase();
async function ensure(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS vendors (id SERIAL PRIMARY KEY, name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE, phone TEXT, notes TEXT, active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
}
async function usedNames(pool) {
  const out = [];
  for (const q of [`SELECT DISTINCT supplier_name AS n FROM grn_records WHERE supplier_name IS NOT NULL`, `SELECT DISTINCT vendor_name AS n FROM vendor_bills WHERE vendor_name IS NOT NULL`]) {
    try { (await pool.query(q)).rows.forEach((r) => out.push(r.n)); } catch (e) { /* that table is not there yet: skip it */ }
  }
  return out;
}
async function backfill(pool) {
  const seen = new Map();
  (await usedNames(pool)).forEach((n) => { const k = keyOf(n); if (k && !seen.has(k)) seen.set(k, clean(n)); });
  let added = 0;
  for (const [k, name] of seen) {
    const r = await pool.query(`INSERT INTO vendors (name, name_key) VALUES ($1, $2) ON CONFLICT (name_key) DO NOTHING RETURNING id`, [name, k]);
    if (r.rows && r.rows.length) added++;
  }
  return { added, total: seen.size };
}
async function list(pool) { return (await pool.query(`SELECT id, name, phone, notes, active FROM vendors ORDER BY name`)).rows; }
async function upsert(pool, v) {
  const name = clean(v && v.name); if (!name) throw new Error('name is required');
  const r = await pool.query(`INSERT INTO vendors (name, name_key, phone, notes) VALUES ($1, $2, $3, $4)
    ON CONFLICT (name_key) DO UPDATE SET phone = COALESCE(EXCLUDED.phone, vendors.phone), notes = COALESCE(EXCLUDED.notes, vendors.notes) RETURNING id, name, phone, notes, active`,
  [name, keyOf(name), v.phone ? String(v.phone).trim() : null, v.notes ? String(v.notes).trim() : null]);
  return r.rows[0];
}
module.exports = { clean, keyOf, ensure, backfill, list, upsert };
