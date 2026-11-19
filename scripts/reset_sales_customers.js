'use strict';
// START-FRESH (AJ 16 Nov): sales = 0, customers = 0, stock kept. Nothing else touched (items, GRN, vendors, cheques, expenses, staff stay).
//   node scripts/reset_sales_customers.js          rehearsal: prints counts, rolls back
//   node scripts/reset_sales_customers.js --yes    does it. Backup (scripts/backup_owner_db.ps1) must have passed first.
// 1. Stock the test sales took out is put back (only bills that really took stock, voided bills skipped), so stock = what GRN received.
// 2. Every table below is copied to arch_20261116_<table> first, then emptied. Nothing is lost: the copies stay.
// 3. All in ONE transaction. Any failure = nothing saved.
require('dotenv').config({ quiet: true });
const pool = require('../utils/pool');
const YES = process.argv.includes('--yes');
const TABLES = ['pos_bill_voids', 'pos_bill_history', 'pos_bill_payments', 'pos_bill_items', 'pos_quotation_billed', 'pos_cheque_registered', 'pos_bills',
  'receipt_images', 'receipt_queue', 'invoice_receipts', 'credit_customers', 'customer_credit_limits', 'customers',
  'daily_payment_breakdown', 'daily_entry_live', 'daily_reports', 'daily_summary'];
(async () => {
  const c = await pool.connect(); const out = [];
  try {
    await c.query('BEGIN'); await c.query('SELECT pg_advisory_xact_lock($1)', [774416]);
    const have = new Set((await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")).rows.map((r) => r.table_name));
    if (have.has('pos_bills') && have.has('pos_bill_items')) {
      const back = (await c.query(`SELECT i.item_code, SUM(i.qty) q FROM pos_bill_items i JOIN pos_bills b ON b.id=i.bill_id
        WHERE b.stock_deducted IS TRUE AND i.item_code IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pos_bill_voids v WHERE v.bill_id=b.id) GROUP BY i.item_code`)).rows;
      let ledger = null; try { ledger = require('../utils/stock_ledger'); } catch (e) { /* optional */ }
      for (const r of back) {
        await c.query('UPDATE products SET stock_level = COALESCE(stock_level,0) + $1 WHERE item_code=$2 AND active=true', [r.q, r.item_code]);
        if (ledger && ledger.recordSafe) await ledger.recordSafe(c, { item_code: r.item_code, qty_change: Number(r.q), reason: 'fresh start: test sale put back', ref_type: 'reset', ref_id: '20261116' });
      }
      out.push(`stock put back: ${back.length} items, ${back.reduce((a, r) => a + Number(r.q), 0)} units`);
    }
    for (const t of TABLES) {
      if (!have.has(t)) continue;
      const n = Number((await c.query(`SELECT COUNT(*) n FROM ${t}`)).rows[0].n);
      if (!n) continue;
      await c.query(`CREATE TABLE IF NOT EXISTS arch_20261116_${t} AS TABLE ${t}`);
      await c.query(`DELETE FROM ${t}`);
      out.push(`${t}: ${n} rows archived and cleared`);
    }
    await c.query(YES ? 'COMMIT' : 'ROLLBACK');
    console.log(YES ? 'DONE, sales 0, customers 0, stock kept:' : 'REHEARSAL ONLY (nothing saved):'); out.forEach((x) => console.log('  ' + x));
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); console.log('STOPPED: ' + e.message + ' Nothing saved.'); process.exitCode = 1; } finally { c.release(); await pool.end().catch(() => {}); }
})();
