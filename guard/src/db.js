'use strict';
// Small database helper for the guard. Reads the same DB_* settings as the app (.env). The admin login (backup, restore, install) uses GUARD_ADMIN_*.
// Nothing here is ever hard-coded: passwords come from the environment only.
const { Client } = require('pg');
function conf(prefix) {
  const p = prefix || 'DB';
  return { host: process.env[p + '_HOST'] || process.env.DB_HOST || 'localhost', port: Number(process.env[p + '_PORT'] || process.env.DB_PORT || 5432),
    database: process.env[p + '_NAME'] || process.env.DB_NAME, user: process.env[p + '_USER'] || process.env.DB_USER, password: process.env[p + '_PASSWORD'] || process.env.DB_PASSWORD };
}
async function withClient(c, fn) { const cl = new Client(c); await cl.connect(); try { return await fn(cl); } finally { await cl.end().catch(() => {}); } }
const run = (prefix, fn) => withClient(conf(prefix), fn);
module.exports = { conf, run, withClient };
