'use strict';
// Opening stock entry for Royal Bath Hub (REAL data). node scripts/import_opening_grn.js [--dry]
// Reads data/opening_grn.txt (blocks "G1 NAME", lines qty|name|unit cost). Reuses the app's own pieces:
// item_catalog.createItem (next free item code), utils/grnBill.createBillForGrn (vendor payable), same grn_records insert as routes/grn_manual.js.
// Own transaction because one GRN can have more than the 50 lines the screen allows. Whole file is all-or-nothing.
require('dotenv').config({ quiet: true });
const fs = require('fs'); const path = require('path');
const pool = require('../utils/pool');
const catalog = require('../routes/item_catalog');
const { createBillForGrn, readTerms } = require('../utils/grnBill');
const { lineTotal, round2 } = require('../utils/grn_math');

const V = {
  METRO: { name: 'Metro Enterprises', phone: '076 178 7406 / 077 720 8728', notes: '281/12 Warana Road, Thihariya' },
  FAZAAL: { name: 'Fazaal Hardware (Pvt) Ltd', phone: '091-2222144 / 091-2222945', notes: 'No.37 Matara Road, Galle' },
};
const G = {
  G1: { v: 'METRO', ref: 'ME2026/1757', date: '2026-10-09', credit_days: 60, total: 653745 },
  G2: { v: 'FAZAAL', ref: 'FH-46221', date: '2026-10-20', total: 292450 },
  G3: { v: 'FAZAAL', ref: 'FH-46222', date: '2026-10-20', total: 899675, vendor_wrote: 900075 },
  G4: { v: 'FAZAAL', ref: 'FH-46223', date: '2026-10-20', total: 197100 },
};
const DRY = process.argv.includes('--dry');

function parse() {
  const out = {}; let cur = null;
  for (const raw of fs.readFileSync(path.join(__dirname, '..', 'data', 'opening_grn.txt'), 'utf8').split(/\r?\n/)) {
    const s = raw.trim(); if (!s) continue;
    const h = s.match(/^(G\d)\s/); if (h) { cur = out[h[1]] = []; continue; }
    const [q, name, c] = s.split('|'); cur.push({ qty: Number(q), name: name.trim(), cost: Number(c) });
  }
  return out;
}

(async () => {
  const data = parse();
  for (const k of Object.keys(G)) { // check before touching the DB
    const t = round2(data[k].reduce((a, l) => a + lineTotal(l.qty, l.cost), 0));
    if (t !== G[k].total) throw new Error(`${k}: lines add up to ${t}, expected ${G[k].total}. Nothing saved.`);
  }
  if (DRY) { console.log('dry run OK, totals match:', Object.keys(G).map(k => `${k}=${G[k].total}`).join(' ')); return process.exit(0); }
  const c = await pool.connect(); const needsPrice = []; const review = []; const done = {};
  try {
    await c.query('BEGIN'); await c.query('SELECT pg_advisory_xact_lock($1)', [774412]);
    for (const k of Object.keys(V)) {
      const ex = await c.query('SELECT id FROM suppliers WHERE LOWER(name)=LOWER($1)', [V[k].name]);
      V[k].id = ex.rows.length ? ex.rows[0].id : (await c.query('INSERT INTO suppliers (name, phone, active, notes) VALUES ($1,$2,true,$3) RETURNING id', [V[k].name, V[k].phone, V[k].notes])).rows[0].id;
    }
    for (const k of Object.keys(G)) {
      const g = G[k]; const v = V[g.v]; let total = 0;
      const terms = readTerms(g.credit_days ? { credit_days: g.credit_days } : { source: 'whatsapp' }, g.date); // Fazaal: no due date, stays pending
      for (const l of data[k]) {
        const item = await catalog.createItem({ name: l.name, avg_cost: l.cost, stock_level: l.qty }, { client: c });
        await c.query(`INSERT INTO grn_records (grn_number, supplier_id, supplier_name, grn_date, item_description, quantity, unit_cost, total_amount, status, notes)
                       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'PENDING_REVIEW',$9)`,
          [g.ref, v.id, v.name, g.date, `${item.item_code} - ${item.name}`, l.qty, l.cost, lineTotal(l.qty, l.cost), `Opening stock ${k}, supplier ref ${g.ref}`]);
        total += lineTotal(l.qty, l.cost); needsPrice.push(`${item.item_code} ${item.name}`);
        if (l.name.endsWith('?')) review.push(`${item.item_code} ${item.name}`);
      }
      total = round2(total);
      const bill = await createBillForGrn(c, { vendor_name: v.name, grn_number: g.ref, grn_date: g.date, total, terms, user: 'opening-import' });
      if (g.vendor_wrote) {
        await c.query('UPDATE vendor_bills SET notes = $1 WHERE id = $2', [`From GRN ${g.ref}. VENDOR ERROR: system total ${total}, vendor wrote ${g.vendor_wrote} (${g.vendor_wrote - total} over). Do NOT pay the difference. Open until Aj brings the printed receipt.`, bill.bill_id]);
        await c.query(`INSERT INTO alerts (type, message, priority) VALUES ('vendor_error', $1, 'high')`,
          [`VENDOR ERROR - ${v.name} memo 46222: system total Rs ${total}, vendor wrote Rs ${g.vendor_wrote}. Rs ${g.vendor_wrote - total} over. Do not pay it. Open until the printed receipt is brought, then amend.`]);
      }
      done[k] = { ref: g.ref, lines: data[k].length, total, bill: bill.bill_id };
    }
    if (review.length) await c.query(`INSERT INTO alerts (type, message, priority) VALUES ('needs_review', $1, 'normal')`, [`Opening stock: ${review.length} item names are uncertain handwriting (end with ?). Confirm: ${review.join('; ')}`]);
    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); console.error('FAILED, nothing saved:', e.message); process.exit(1); } finally { c.release(); }
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'opening_grn_lists.json'), JSON.stringify({ needs_selling_price: needsPrice, needs_review: review }, null, 1));
  console.log(JSON.stringify({ done, needs_selling_price: needsPrice.length, needs_review: review.length }));
  await pool.end(); process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
