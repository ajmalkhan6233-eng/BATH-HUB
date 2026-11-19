'use strict';
// READ-ONLY. Prints what customers wrote and what Layla answered in the 6 most recent chats (phone numbers hidden), newest first.
// Usage: node scripts/layla_last_chats.js   -> paste the output into LIVE.md. Writes nothing.
const pool = require('../utils/pool');
(async () => {
  const r = await pool.query(`SELECT c.id, cu.phone, c.updated_at, c.messages FROM conversations c LEFT JOIN customers cu ON cu.id = c.customer_id ORDER BY c.updated_at DESC NULLS LAST LIMIT 6`);
  for (const row of r.rows) {
    const ph = String(row.phone || '').replace(/\D/g, ''); const masked = ph ? '***' + ph.slice(-3) : 'unknown';
    const msgs = Array.isArray(row.messages) ? row.messages : [];
    console.log(`== chat ${row.id} (${masked}) updated ${new Date(row.updated_at).toISOString().slice(0, 16)}`);
    for (const m of msgs.slice(-8)) console.log(`${m.role === 'user' ? 'CUSTOMER' : 'LAYLA   '}: ${String(m.content || '').replace(/\s+/g, ' ').slice(0, 260)}`);
  }
  await pool.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
