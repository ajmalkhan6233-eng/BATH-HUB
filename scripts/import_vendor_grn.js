'use strict';
// Vendor GRN loader (invoice by invoice, page by page). Chat wrote it (Rule 13); Claude Code only runs it.
//   node scripts/import_vendor_grn.js <file.json> --rehearse   (does everything, prints the report, then ROLLS BACK: nothing saved)
//   node scripts/import_vendor_grn.js <file.json>              (real load, all-or-nothing, backup must have passed first)
// The JSON holds private cost data: keep it in the private bridge repo (PAPERS/), never in this public repo.
// What it does:
//  1. Adds columns (safe to repeat): products.vendor_code; grn_records.vendor_code, page_no, invoice_date, discount_pct.
//  2. Every NEW item gets OUR next shop item code (item_catalog.createItem). An item already holding the same vendor_code is restocked instead.
//  3. One grn_records row per received line: grn_number = invoice number, notes say page N. Cost = net unit (unit less discount).
//  4. One vendor bill per invoice (utils/grnBill). Lines marked pending go to an alert, add NO stock; their value stays in the bill.
//  5. Prints per-invoice and per-page totals and what we owe every vendor now.
require('dotenv').config({ quiet: true });
const fs = require('fs'); const path = require('path');
const pool = require('../utils/pool');
const catalog = require('../routes/item_catalog');
const { createBillForGrn, readTerms } = require('../utils/grnBill');
const { lineTotal, round2, weightedAvgCost } = require('../utils/grn_math');

const file = process.argv.find((a, i) => i > 1 && !a.startsWith('--'));
const REHEARSE = process.argv.includes('--rehearse');
if (!file) { console.error('Usage: node scripts/import_vendor_grn.js <file.json> [--rehearse]'); process.exit(1); }
const D = JSON.parse(fs.readFileSync(file, 'utf8'));
const netUnit = (l) => (l.disc ? round2(l.unit * (100 - D.discount_pct) / 100) : round2(l.unit));
const money = (n) => Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function check() { // before touching the DB
  const seen = new Set();
  for (const inv of D.invoices) {
    const rec = round2(inv.lines.filter(l => l.status === 'received').reduce((a, l) => a + lineTotal(l.qty, netUnit(l)), 0));
    const pen = round2(inv.lines.filter(l => l.status === 'pending').reduce((a, l) => a + lineTotal(l.qty, netUnit(l)), 0));
    if (rec !== inv.expected_received) throw new Error(`${inv.no}: received lines add up to ${rec}, expected ${inv.expected_received}. Nothing saved.`);
    if (pen !== inv.expected_pending) throw new Error(`${inv.no}: pending lines add up to ${pen}, expected ${inv.expected_pending}. Nothing saved.`);
    if (round2(rec + pen) !== inv.expected_bill_total) throw new Error(`${inv.no}: bill total ${round2(rec + pen)}, expected ${inv.expected_bill_total}. Nothing saved.`);
    for (const l of inv.lines.filter(x => x.status === 'received')) { if (seen.has(l.vendor_code)) throw new Error(`vendor code ${l.vendor_code} appears twice among received lines. Nothing saved.`); seen.add(l.vendor_code); }
  }
}

(async () => {
  check();
  const c = await pool.connect(); const report = { invoices: [], codes: [] };
  try {
    await c.query('BEGIN'); await c.query('SELECT pg_advisory_xact_lock($1)', [774412]);
    await c.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS vendor_code TEXT');
    await c.query('CREATE INDEX IF NOT EXISTS products_vendor_code_idx ON products (vendor_code)');
    for (const col of ['vendor_code TEXT', 'page_no INT', 'invoice_date DATE', 'discount_pct NUMERIC(5,2)']) await c.query(`ALTER TABLE grn_records ADD COLUMN IF NOT EXISTS ${col}`);
    const V = D.vendor;
    const ex = await c.query('SELECT id FROM suppliers WHERE LOWER(name)=LOWER($1)', [V.name]);
    const sid = ex.rows.length ? ex.rows[0].id : (await c.query('INSERT INTO suppliers (name, phone, active, notes) VALUES ($1,$2,true,$3) RETURNING id', [V.name, V.phone, V.notes])).rows[0].id;
    for (const inv of D.invoices) {
      const again = await c.query('SELECT 1 FROM grn_records WHERE grn_number=$1 AND supplier_id=$2 LIMIT 1', [inv.no, sid]);
      if (again.rows.length) throw new Error(`Invoice ${inv.no} is already loaded. Nothing saved.`);
      const pages = {}; let rec = 0; let pen = 0; const pend = [];
      for (const l of inv.lines) {
        if (l.status === 'cancelled') continue;
        const nu = netUnit(l); const tot = lineTotal(l.qty, nu);
        if (l.status === 'pending') { pen += tot; pend.push(`${l.vendor_code} ${l.name} x${l.qty} (${money(tot)})`); continue; }
        let item; let isNew = false;
        const have = await c.query('SELECT * FROM products WHERE vendor_code = $1 AND active = true ORDER BY id LIMIT 1', [l.vendor_code]);
        if (have.rows.length) {
          item = have.rows[0];
          const avg = weightedAvgCost(item.stock_level, item.avg_cost, l.qty, nu);
          await c.query('UPDATE products SET stock_level = stock_level + $1, avg_cost = $2 WHERE id = $3', [l.qty, avg, item.id]);
        } else {
          item = await catalog.createItem({ name: l.name, avg_cost: nu, stock_level: l.qty }, { client: c }); isNew = true;
          await c.query('UPDATE products SET vendor_code = $1 WHERE id = $2', [l.vendor_code, item.id]);
        }
        const note = `Invoice ${inv.no}, page ${l.page}; vendor code ${l.vendor_code}; printed unit ${money(l.unit)}${l.disc ? ` less ${D.discount_pct}% = ${money(nu)}` : ' (no discount)'}`;
        await c.query(`INSERT INTO grn_records (grn_number, supplier_id, supplier_name, grn_date, item_description, quantity, unit_cost, total_amount, status, notes, vendor_code, page_no, invoice_date, discount_pct)
                       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'PENDING_REVIEW',$9,$10,$11,$12,$13)`,
          [inv.no, sid, V.name, D.grn_date, `${item.item_code} - ${item.name}`, l.qty, nu, tot, note, l.vendor_code, l.page, inv.date, l.disc ? D.discount_pct : 0]);
        rec += tot; const p = pages[l.page] = pages[l.page] || { lines: 0, qty: 0, total: 0, rows: [] };
        p.lines++; p.qty += l.qty; p.total = round2(p.total + tot); p.rows.push(`${item.item_code}${isNew ? '' : '*'} | ${l.vendor_code} | ${l.name} | ${l.qty} x ${money(nu)} = ${money(tot)}`);
        report.codes.push(`${item.item_code}  ${l.vendor_code}  ${l.name}`);
      }
      rec = round2(rec); pen = round2(pen); const bill_total = round2(rec + pen);
      const bill = await createBillForGrn(c, { vendor_name: V.name, grn_number: inv.no, grn_date: inv.date, total: bill_total, terms: readTerms({ credit_days: D.credit_days }, inv.date), user: 'vendor-grn-import' });
      if (pend.length) {
        await c.query('UPDATE vendor_bills SET notes = $1 WHERE id = $2', [`From GRN ${inv.no}. Includes NOT YET DELIVERED: ${pend.join('; ')}. Ask the vendor for the goods or a credit note.`, bill.bill_id || bill.exists]);
        await c.query(`INSERT INTO alerts (type, message, priority) VALUES ('vendor_pending', $1, 'normal')`, [`${V.name} invoice ${inv.no}: billed but NOT delivered yet: ${pend.join('; ')}. No stock added. Get the goods or a credit note.`]);
      }
      report.invoices.push({ invoice: inv.no, grn_date: D.grn_date, invoice_date: inv.date, bill: bill.bill_id || bill.exists, received_goods: rec, pending_goods: pen, bill_total, pages });
    }
    const owe = await c.query(`SELECT b.vendor_name,
        ROUND(SUM(b.total - COALESCE(p.paid,0) - COALESCE(n.cn,0)),2) AS owed, COUNT(*) AS bills
      FROM vendor_bills b
      LEFT JOIN (SELECT bill_id, SUM(amount) paid FROM vendor_payments GROUP BY bill_id) p ON p.bill_id = b.id
      LEFT JOIN (SELECT bill_id, SUM(amount) cn FROM vendor_credit_notes GROUP BY bill_id) n ON n.bill_id = b.id
      WHERE b.voided = false GROUP BY b.vendor_name ORDER BY owed DESC`);
    report.owed_now = owe.rows; report.owed_total = round2(owe.rows.reduce((a, r) => a + Number(r.owed), 0));
    if (REHEARSE) { await c.query('ROLLBACK'); console.log('REHEARSAL ONLY: everything below was rolled back, nothing saved.'); } else await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); console.error('FAILED, nothing saved:', e.message); process.exit(1); } finally { c.release(); }
  const out = [];
  for (const r of report.invoices) {
    out.push(`INVOICE ${r.invoice} (dated ${r.invoice_date}, GRN ${r.grn_date}) bill #${r.bill}: goods received ${money(r.received_goods)}, not delivered ${money(r.pending_goods)}, BILL ${money(r.bill_total)}`);
    for (const pg of Object.keys(r.pages)) { const p = r.pages[pg]; out.push(`  page ${pg}: ${p.lines} lines, ${p.qty} pcs, ${money(p.total)}`); p.rows.forEach(x => out.push(`    ${x}`)); }
  }
  out.push('(* = restocked an item we already had)', 'WE OWE NOW:'); report.owed_now.forEach(r => out.push(`  ${r.vendor_name}: ${money(r.owed)} (${r.bills} bills)`)); out.push(`  TOTAL OWED TO ALL VENDORS: ${money(report.owed_total)}`);
  const text = out.join('\n'); console.log(text);
  const dir = path.join(__dirname, '..', 'data'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `vendor_grn_report_${D.grn_date}${REHEARSE ? '_rehearsal' : ''}.txt`), text);
  await pool.end(); process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
