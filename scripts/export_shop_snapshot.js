'use strict';
// READ-ONLY export of the shop data for statistics, to a folder of CSV files (one per table) + MANIFEST.md.
// Goes to the PRIVATE bridge repo only (never the public app repo). AJ approved 17 Nov: "push all shop data so I can talk statistics with cloud when the PC is off".
// Left OUT on purpose: logins, sessions, passwords, tokens, keys, bank account numbers, photos and file paths, staff and investor personal records.
// Customer phone numbers are masked to the last 3 digits.   node scripts/export_shop_snapshot.js <outDir>
require('dotenv').config({ quiet: true });
const fs = require('fs'); const path = require('path'); const pool = require('../utils/pool');
const OUT = process.argv[2]; if (!OUT) { console.error('Usage: node scripts/export_shop_snapshot.js <outDir>'); process.exit(1); }
const TABLES = ['pos_bills', 'pos_bill_items', 'pos_bill_payments', 'pos_bill_voids', 'pos_bill_history', 'products', 'price_history', 'stock_movements', 'stock_adjustments', 'suppliers',
  'vendor_bills', 'vendor_payments', 'vendor_bill_cheques', 'vendor_credit_notes', 'vendor_return_lines', 'vendor_pending_items', 'grn_records', 'grn_records_archive', 'grn_invoice_meta', 'grn_audit', 'grn_diff_reason',
  'cheque_register', 'cheque_deposits', 'expenses_detail', 'daily_summary', 'daily_payment_breakdown', 'daily_cash_plan', 'fixed_overheads', 'credit_customers', 'customers', 'customer_credit_limits',
  'quotations', 'quotation_items', 'sale_commissions', 'acc_chart_of_accounts', 'acc_journal_entries', 'acc_petty_cash_txns', 'acc_bank_transactions', 'pur_purchase_orders', 'pur_landed_costs', 'pur_shipments', 'pur_supplier_prices',
  'money_audit_log', 'oversold_owed', 'discount_rules'];
const DENY = /pass|token|secret|hash|totp|account_?n|iban|photo|ocr_raw|file_path|image|api_?key|session|_url$|attachment|signature/i;
const PHONE = /phone|whatsapp|mobile|tel$/i;
const mask = (v) => { const d = String(v == null ? '' : v).replace(/\D/g, ''); return d ? '***' + d.slice(-3) : ''; };
const p2 = (n) => String(n).padStart(2, '0');
// Dates are written in Sri Lanka (local) time: a plain date stays YYYY-MM-DD, a timestamp becomes YYYY-MM-DD HH:MM:SS. (toISOString would show the day before.)
const loc = (d) => { const day = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); return (d.getHours() || d.getMinutes() || d.getSeconds()) ? day + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds()) : day; };
const csv = (v) => { if (v == null) return ''; if (v instanceof Date) v = loc(v); v = String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
(async () => {
  fs.mkdirSync(OUT, { recursive: true }); const man = []; let total = 0;
  for (const t of TABLES) {
    const cols = (await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position", [t])).rows.map((r) => r.column_name);
    if (!cols.length) { man.push(`| ${t} | (table not found) | | |`); continue; }
    const keep = cols.filter((c) => !DENY.test(c)), dropped = cols.filter((c) => DENY.test(c));
    const rows = (await pool.query(`SELECT ${keep.map((c) => '"' + c + '"').join(',')} FROM "${t}"`)).rows;
    const lines = [keep.join(',')].concat(rows.map((r) => keep.map((c) => csv(PHONE.test(c) ? mask(r[c]) : r[c])).join(',')));
    fs.writeFileSync(path.join(OUT, t + '.csv'), lines.join('\n') + '\n'); total += rows.length;
    man.push(`| ${t} | ${rows.length} | ${keep.join(', ')} | ${dropped.join(', ') || '-'} |`);
  }
  const now = new Date().toISOString();
  fs.writeFileSync(path.join(OUT, 'MANIFEST.md'), `# Shop data snapshot (read-only copy)\nTaken: ${now} (UTC) from the live PC database. ${TABLES.length} tables listed, ${total} rows.\nPrivate use only. Phones masked to last 3 digits. Left out: logins, passwords, tokens, bank account numbers, photos, file paths, staff and investor records.\nMoney is in LKR. Dates are Asia/Colombo dates. Voided bills are in pos_bill_voids (bill_id). Vendor bill status: vendor_bills.voided, payments in vendor_payments, cheques in vendor_bill_cheques (ISSUED/CLEARED/BOUNCED/CANCELLED).\n\n| table | rows | columns | left out |\n|---|---|---|---|\n${man.join('\n')}\n`);
  console.log('exported', TABLES.length, 'tables,', total, 'rows to', OUT); process.exit();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
