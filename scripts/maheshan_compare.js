'use strict';
// Maheshan Hardware: compare the app with AJ's papers (17 Nov). READ-ONLY by default.
//   node scripts/maheshan_compare.js <MAHESHAN_PAPER_READ.json> <GRN_2026-10-22_Maheshan.json>            report only
//   node scripts/maheshan_compare.js <paper.json> <grn.json> --apply      sets selling_price for the SURE lines only (backup must have passed first)
// Report: vendor bills (why Vendor 360 shows 0), GRN rows per invoice, and per line: paper item no / price vs the app's item.
require('dotenv').config({ quiet: true });
const fs = require('fs'); const pool = require('../utils/pool');
const APPLY = process.argv.includes('--apply');
const [paperFile, grnFile] = process.argv.filter((a, i) => i > 1 && !a.startsWith('--'));
const P = JSON.parse(fs.readFileSync(paperFile, 'utf8')), G = JSON.parse(fs.readFileSync(grnFile, 'utf8'));
const m = n => n == null ? '-' : Number(n).toLocaleString('en-LK', { maximumFractionDigits: 2 });
(async () => {
  const out = [];
  const sup = (await pool.query(`SELECT id,name,active FROM suppliers WHERE LOWER(name) LIKE '%maheshan%'`)).rows;
  out.push('SUPPLIERS: ' + (sup.map(s => `#${s.id} ${s.name} active=${s.active}`).join(' | ') || 'NONE'));
  const has = async t => (await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_name=$1`, [t])).rows.length > 0;
  if (await has('vendors')) { const v = (await pool.query(`SELECT id,name,active FROM vendors WHERE LOWER(name) LIKE '%maheshan%'`)).rows; out.push('VENDORS: ' + (v.map(x => `#${x.id} ${x.name} active=${x.active}`).join(' | ') || 'NONE')); }
  if (await has('vendor_bills')) {
    const bills = (await pool.query(`SELECT id,vendor_name,bill_no,total,voided FROM vendor_bills WHERE LOWER(vendor_name) LIKE '%maheshan%' OR bill_no LIKE '26OCT_0039%' ORDER BY id`)).rows;
    out.push('VENDOR BILLS: ' + (bills.map(b => `#${b.id} ${b.vendor_name} ${b.bill_no} ${m(b.total)} ${b.voided ? 'VOIDED' : 'active'}`).join(' | ') || 'NONE (this is why Vendor 360 shows 0)'));
  } else out.push('VENDOR BILLS: table vendor_bills missing here');
  for (const inv of G.invoices) {
    const g = (await pool.query(`SELECT COUNT(*) n, COALESCE(SUM(total_amount),0) t FROM grn_records WHERE grn_number=$1`, [inv.no])).rows[0];
    out.push(`GRN ${inv.no}: ${g.n} rows, ${m(g.t)} (paper: received ${m(inv.expected_received)}, bill ${m(inv.expected_bill_total)})`);
  }
  out.push('', 'LINE | paper no | paper price | APP item code | APP price | APP stock | verdict');
  let fix = 0, unsure = 0, missing = 0;
  for (const l of P.lines) {
    const it = (await pool.query(`SELECT id,item_code,name,stock_level,selling_price FROM products WHERE vendor_code=$1 AND active=true ORDER BY id LIMIT 1`, [l.vc])).rows[0];
    let v;
    if (!it) { v = 'ITEM NOT IN APP'; missing++; }
    else if (String(it.item_code) !== String(l.no)) v = `CODE DIFFERS (app ${it.item_code}, paper ${l.no})`;
    else v = 'code ok';
    if (it && l.sell != null) {
      if (Number(it.selling_price) === l.sell) v += ', price ok';
      else if (l.sure) { v += `, PRICE ${m(it.selling_price)} -> ${m(l.sell)}${APPLY ? ' (set)' : ''}`; fix++; if (APPLY) await pool.query('UPDATE products SET selling_price=$1 WHERE id=$2', [l.sell, it.id]); }
      else { v += `, price ${m(l.sell)} NOT SURE: AJ to confirm`; unsure++; }
    } else if (l.sell == null) v += ', paper price not readable: AJ to give';
    out.push(`${l.inv} ${l.vc} | ${l.no} | ${m(l.sell)} | ${it ? it.item_code : '-'} | ${it ? m(it.selling_price) : '-'} | ${it ? it.stock_level : '-'} | ${v}`);
  }
  out.push('', `SUMMARY: ${P.lines.length} lines, missing in app ${missing}, prices to set (sure) ${fix}${APPLY ? ' (applied)' : ''}, unsure ${unsure}`);
  const text = out.join('\n'); console.log(text);
  fs.mkdirSync('data', { recursive: true }); fs.writeFileSync('data/maheshan_compare.txt', text);
  await pool.end();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
