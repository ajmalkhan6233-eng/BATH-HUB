'use strict';
/**
 * Additive, idempotent migration for the vendor ledger. Run: node scripts/migrate_vendor_ledger.js
 * Rollback: psql -f scripts/vendor_ledger_down.sql   (drops only the 4 new tables)
 * Uses the shared pool. Never touches existing tables.
 */
const SQL = `
CREATE TABLE IF NOT EXISTS vendor_bills (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL DEFAULT 1,
  vendor_name TEXT NOT NULL,
  bill_no TEXT,
  bill_date DATE NOT NULL,
  due_date DATE,
  total NUMERIC(14,2) NOT NULL CHECK (total > 0),
  grn_id INTEGER,
  photo_path TEXT,
  notes TEXT,
  voided BOOLEAN NOT NULL DEFAULT FALSE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS vendor_bill_cheques (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL DEFAULT 1,
  bill_id INTEGER NOT NULL REFERENCES vendor_bills(id),
  cheque_no TEXT,
  bank TEXT,
  payee TEXT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  cheque_date DATE NOT NULL,
  due_date DATE NOT NULL,
  same_bank BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('ISSUED','CLEARED','BOUNCED','CANCELLED')),
  cleared_at TIMESTAMPTZ,
  photo_path TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS vendor_payments (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL DEFAULT 1,
  bill_id INTEGER NOT NULL REFERENCES vendor_bills(id),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL DEFAULT 'CASH',
  paid_at DATE NOT NULL,
  note TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS vendor_credit_notes (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL DEFAULT 1,
  bill_id INTEGER NOT NULL REFERENCES vendor_bills(id),
  note_no TEXT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  note_date DATE NOT NULL,
  reason TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vbc_bill ON vendor_bill_cheques(bill_id);
CREATE INDEX IF NOT EXISTS idx_vbc_due ON vendor_bill_cheques(due_date, status);
CREATE INDEX IF NOT EXISTS idx_vp_bill ON vendor_payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_vcn_bill ON vendor_credit_notes(bill_id);
`;

async function migrate(pool) { await pool.query(SQL); }
module.exports = { migrate, SQL };

if (require.main === module) {
  try { require('dotenv').config(); } catch (_) { /* dotenv optional */ }
  const pool = require('../utils/pool'); // ADAPT if the shared pool export differs
  migrate(pool.query ? pool : pool.pool).then(() => { console.log('vendor ledger tables ready'); process.exit(0); })
    .catch((e) => { console.error('migration failed:', e.message); process.exit(1); });
}
