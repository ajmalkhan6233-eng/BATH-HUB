'use strict';
/**
 * Additive, idempotent migration: creates the missing "leads" table.
 * Run: node scripts/migrate_leads.js   (take a DB backup first)
 * Columns match what layla.js, index.js and server.js already read and write.
 * Never touches existing tables. Rollback: DROP TABLE leads;  (new table only)
 */
const SQL = `
CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  source TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leads_customer ON leads(customer_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
`;

async function migrate(pool) { await pool.query(SQL); }
module.exports = { migrate, SQL };

if (require.main === module) {
  try { require('dotenv').config(); } catch (_) { /* dotenv optional */ }
  const pool = require('../utils/pool');
  migrate(pool.query ? pool : pool.pool).then(() => { console.log('leads table ready'); process.exit(0); })
    .catch((e) => { console.error('migration failed:', e.message); process.exit(1); });
}
