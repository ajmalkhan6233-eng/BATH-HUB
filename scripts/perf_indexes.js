// SPEED: adds missing database indexes. Safe: only adds (CREATE INDEX IF NOT EXISTS), never changes or deletes data.
// Skips any table or column that does not exist. Dry run by default (shows what it would add). Run: node scripts\perf_indexes.js   then   node scripts\perf_indexes.js --apply
// Undo (drops only these): node scripts\perf_indexes.js --undo
require('dotenv').config();
const pool = require('../utils/pool');
const APPLY = process.argv.includes('--apply'), UNDO = process.argv.includes('--undo');
// [table, index name, columns (plain) or expression]
const WANT = [
  ['products', 'perf_products_item_code', ['item_code']],
  ['products', 'perf_products_name_lower', ['lower(name)'], ['name']],
  ['grn_records', 'perf_grn_supplier_id', ['supplier_id']],
  ['grn_records', 'perf_grn_supplier_lower', ['lower(supplier_name)'], ['supplier_name']],
  ['grn_records', 'perf_grn_number', ['grn_number']],
  ['grn_records', 'perf_grn_date', ['grn_date']],
  ['daily_summary', 'perf_daily_summary_date', ['report_date']],
  ['customers', 'perf_customers_phone', ['phone']],
  ['credit_customers', 'perf_credit_customers_name', ['lower(name)'], ['name']],
  ['cheques', 'perf_cheques_due', ['due_date']],
  ['expenses_detail', 'perf_expenses_date', ['expense_date']],
  ['stock_movements', 'perf_stock_mov_created', ['created_at']],
  ['quotation_items', 'perf_quotation_items_q', ['quotation_id']],
  ['supplier_payments', 'perf_supplier_pay_supplier', ['supplier_id']],
];
(async () => {
  const have = async (t, cols) => {
    const r = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1", [t]);
    const names = r.rows.map((x) => x.column_name); return cols.every((c) => names.includes(c));
  };
  for (const [t, name, exprs, plain] of WANT) {
    const cols = plain || exprs;
    if (!(await have(t, cols))) { console.log('skip  ' + name + ' (table or column not there)'); continue; }
    if (UNDO) { await pool.query("DROP INDEX IF EXISTS " + name); console.log("dropped " + name); continue; }
    const ex = await pool.query('SELECT 1 FROM pg_indexes WHERE indexname=$1', [name]);
    if (ex.rowCount) { console.log('have  ' + name); continue; }
    if (!APPLY) { console.log('would add ' + name + ' on ' + t + '(' + exprs.join(',') + ')'); continue; }
    await pool.query('CREATE INDEX IF NOT EXISTS ' + name + ' ON ' + t + ' (' + exprs.join(',') + ')'); console.log('added ' + name);
  }
  if (!APPLY && !UNDO) console.log('\nDry run only. Nothing changed. Add --apply to create them.');
  await pool.end();
})().catch((e) => { console.error('perf_indexes failed:', e.message); process.exit(1); });
