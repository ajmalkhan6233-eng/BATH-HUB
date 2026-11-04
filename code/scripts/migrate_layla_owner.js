'use strict';
// node scripts/migrate_layla_owner.js   (back up the database first)
const fs = require('fs'), path = require('path');
const SQL = fs.readFileSync(path.join(__dirname, '..', 'migrations', 'layla_owner.sql'), 'utf8');
async function migrate(pool) { for (const stmt of SQL.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) await pool.query(stmt); }
module.exports = { migrate };
if (require.main === module) {
  try { require('dotenv').config(); } catch (_) {}
  const pool = require('../utils/pool'); // ADAPT if the shared pool export differs
  migrate(pool.query ? pool : pool.pool).then(() => { console.log('layla owner tables ready'); process.exit(0); }).catch((e) => { console.error('migration failed:', e.message); process.exit(1); });
}
