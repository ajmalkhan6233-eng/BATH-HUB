'use strict';
// Speed (19 Nov audit #24). Plain indexes only: they change no data and no rule, they just make lookups fast.
// IF NOT EXISTS makes it safe to run on every start. A failure is logged and ignored.
const LIST = [
  'CREATE INDEX IF NOT EXISTS idx_pbi_bill ON pos_bill_items(bill_id)',
  'CREATE INDEX IF NOT EXISTS idx_pbi_code ON pos_bill_items(item_code)',
  'CREATE INDEX IF NOT EXISTS idx_pb_created ON pos_bills(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_pbv_bill ON pos_bill_voids(bill_id)',
  'CREATE INDEX IF NOT EXISTS idx_products_code ON products(item_code)',
];
async function run(pool) { for (const q of LIST) { try { await pool.query(q); } catch (e) { console.warn('[indexes] skipped:', q.slice(0, 50), e.message); } } }
module.exports = { run, LIST };
