'use strict';
// Leo 10887: GRN date 2026-11-04 -> 2026-11-03 (invoice date), and pre-fill the difference reason "No change given" (Rs 75 extra paid).
//   node scripts/leo_grn_prefill.js   rehearsal      node scripts/leo_grn_prefill.js --yes   saves
require('dotenv').config({ quiet: true });
const pool = require('../utils/pool'); const G = require('../routes/grn_invoice');
(async () => {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await G.saveEdit(c, 'Leo Marketing', '0000010887', { date: '2026-11-03' }, 'aj-17nov');
    await G.saveReason(c, 'Leo Marketing', '0000010887', { reason: 'No change given', note: 'Rs 75 extra paid, no change given' }, 'aj-17nov');
    const d = await G.loadInvoice(c, 'Leo Marketing', '0000010887');
    console.log('date', d.date, 'grn_date', d.grn_date, '| total', d.bill_total, 'paid', d.paid, 'difference', d.difference, d.state);
    if (d.bill_total !== 503425 || d.difference !== -75 || d.grn_date !== '2026-11-03') throw new Error('unexpected result');
    await c.query(process.argv.includes('--yes') ? 'COMMIT' : 'ROLLBACK'); console.log(process.argv.includes('--yes') ? 'SAVED' : 'REHEARSAL only');
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); console.log('STOPPED:', e.message); } finally { c.release(); process.exit(); }
})();
