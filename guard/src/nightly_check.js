'use strict';
// NIGHTLY INDEPENDENT CHECK (9 PM, no AI): the books must agree with themselves. One short message: GREEN, or the exact lines.
//   node src/nightly_check.js            check + send
//   node src/nightly_check.js --baseline accept today's known differences (saved on this PC only; they are not alerted again)
// Baseline file holds shop numbers, so it stays in guard/out (git-ignored), never on GitHub.
const fs = require('fs'); const path = require('path');
const { run } = require('./db'); const alert = require('./alert');
const OUT = process.env.GUARD_OUT || path.join(__dirname, '..', 'out'); const BASE = path.join(OUT, 'nightly_baseline.json');
const failed = [];   // a check that cannot run must be SEEN, never a silent GREEN
const q = async (c, sql, p) => { try { return (await c.query(sql, p)).rows; } catch (e) { await c.query('ROLLBACK').catch(() => {}); failed.push(e.message.split('\n')[0]); return null; } };
async function issues(c) {
  const out = [];   // { key, line }
  // 1 stock = GRN in - sold + adjustments (+ hand-counted opening stock rows, - vendor returns)
  let r = await q(c, `WITH g AS (SELECT split_part(item_description,' - ',1) code, SUM(quantity) q FROM grn_records WHERE COALESCE(status,'') NOT ILIKE 'CANCEL%' GROUP BY 1),
      s AS (SELECT i.item_code code, SUM(i.qty) q FROM pos_bill_items i WHERE i.bill_id::text NOT IN (SELECT bill_id::text FROM pos_bill_voids WHERE bill_id IS NOT NULL) GROUP BY 1),
      m AS (SELECT item_code code, SUM(qty_change) q FROM stock_movements WHERE reason NOT IN ('grn','sale','pos_sale') GROUP BY 1),
      v AS (SELECT item_code code, SUM(qty) q FROM vendor_return_lines GROUP BY 1)
      SELECT p.item_code, p.name, p.stock_level, COALESCE(g.q,0) - COALESCE(s.q,0) + COALESCE(m.q,0) - COALESCE(v.q,0) calc
      FROM products p LEFT JOIN g ON g.code=p.item_code LEFT JOIN s ON s.code=p.item_code LEFT JOIN m ON m.code=p.item_code LEFT JOIN v ON v.code=p.item_code
      WHERE p.active AND ABS(p.stock_level - (COALESCE(g.q,0) - COALESCE(s.q,0) + COALESCE(m.q,0) - COALESCE(v.q,0))) > 0.001`);
  (r || []).forEach((x) => out.push({ key: `stock|${x.item_code}|${Number(x.stock_level)}|${Number(x.calc)}`, line: `STOCK ${x.item_code} ${String(x.name).slice(0, 24)}: stored ${Number(x.stock_level)}, calculated ${Number(x.calc)}` }));
  r = await q(c, `SELECT item_code, name, stock_level FROM products WHERE active AND stock_level < 0`);
  (r || []).forEach((x) => out.push({ key: `neg|${x.item_code}|${Number(x.stock_level)}`, line: `NEGATIVE STOCK ${x.item_code} ${String(x.name).slice(0, 24)}: ${Number(x.stock_level)}` }));
  // 2 vendor balance: bills - payments - credit notes must not go below zero
  r = await q(c, `SELECT b.vendor_name, SUM(b.total) bt FROM vendor_bills b WHERE COALESCE(b.voided,false)=false GROUP BY 1`);
  for (const b of r || []) {
    const p = (await q(c, `SELECT COALESCE(SUM(amount),0) t FROM vendor_payments WHERE bill_id IN (SELECT id FROM vendor_bills WHERE vendor_name=$1)`, [b.vendor_name]))[0].t;
    const n = (await q(c, `SELECT COALESCE(SUM(amount),0) t FROM vendor_credit_notes WHERE bill_id IN (SELECT id FROM vendor_bills WHERE vendor_name=$1)`, [b.vendor_name]))[0].t;
    const owed = Number(b.bt) - Number(p) - Number(n);
    if (owed < -0.01) out.push({ key: `owed|${b.vendor_name}|${owed}`, line: `VENDOR OVERPAID ${b.vendor_name}: ${owed.toFixed(2)}` });
  }
  // 3 duplicates: same invoice number (ignoring leading zeros), same vendor+amount+date, vendor named twice
  r = await q(c, `SELECT LOWER(vendor_name) v, LTRIM(bill_no,'0') n, COUNT(*) k FROM vendor_bills WHERE COALESCE(voided,false)=false AND bill_no IS NOT NULL GROUP BY 1,2 HAVING COUNT(*)>1`);
  (r || []).forEach((x) => out.push({ key: `dupinv|${x.v}|${x.n}`, line: `DUPLICATE INVOICE: ${x.v} / ${x.n} (${x.k} bills)` }));
  r = await q(c, `SELECT LOWER(vendor_name) v, total, bill_date, COUNT(*) k FROM vendor_bills WHERE COALESCE(voided,false)=false GROUP BY 1,2,3 HAVING COUNT(*)>1`);
  (r || []).forEach((x) => out.push({ key: `dupamt|${x.v}|${x.total}|${x.bill_date}`, line: `SAME VENDOR+AMOUNT+DATE: ${x.v} ${Number(x.total)} (${x.k} bills)` }));
  r = await q(c, `SELECT regexp_replace(LOWER(name),'[^a-z0-9]','','g') k, COUNT(*) n, MIN(name) a FROM suppliers WHERE COALESCE(active,true) GROUP BY 1 HAVING COUNT(*)>1`);
  (r || []).forEach((x) => out.push({ key: `dupven|${x.k}`, line: `VENDOR LISTED TWICE: ${x.a}` }));
  // 4 duplicate uploaded photos (only if the bills keep a photo hash)
  const hasHash = await q(c, `SELECT 1 FROM information_schema.columns WHERE table_name='vendor_bills' AND column_name='photo_hash'`);
  r = hasHash && hasHash.length ? await q(c, `SELECT photo_hash h, COUNT(*) n FROM vendor_bills WHERE photo_hash IS NOT NULL AND photo_hash <> '' GROUP BY 1 HAVING COUNT(*)>1`) : null;
  (r || []).forEach((x) => out.push({ key: `dupphoto|${x.h}`, line: `SAME PHOTO UPLOADED ${x.n} TIMES (${String(x.h).slice(0, 8)})` }));
  // 5 cost sanity: selling below cost
  r = await q(c, `SELECT item_code, name, selling_price, avg_cost FROM products WHERE active AND selling_price > 0 AND avg_cost > 0 AND selling_price < avg_cost`);
  (r || []).forEach((x) => out.push({ key: `below|${x.item_code}|${Number(x.selling_price)}|${Number(x.avg_cost)}`, line: `SELLING BELOW COST ${x.item_code} ${String(x.name).slice(0, 24)}: ${Number(x.selling_price)} < ${Number(x.avg_cost)}` }));
  failed.forEach((m, i) => out.push({ key: `cannotrun|${m}`, line: `CHECK COULD NOT RUN: ${m.slice(0, 90)}` }));
  return out;
}
async function main() {
  const all = await run('DB', issues); fs.mkdirSync(OUT, { recursive: true });
  if (process.argv.includes('--baseline')) { fs.writeFileSync(BASE, JSON.stringify(all.map((x) => x.key))); console.log(`baseline saved: ${all.length} known differences accepted`); return; }
  let known = []; try { known = JSON.parse(fs.readFileSync(BASE, 'utf8')); } catch (e) {}
  const fresh = all.filter((x) => !known.includes(x.key));
  const stamp = new Date().toLocaleDateString('en-GB');
  const msg = fresh.length === 0 ? `ROYAL BATH HUB NIGHT AUDIT ${stamp}\nGREEN. All checks passed.${all.length ? ` (${all.length} known items already accepted)` : ''}`
    : `ROYAL BATH HUB NIGHT AUDIT ${stamp} - ${fresh.length} to look at\n` + fresh.slice(0, 8).map((x) => x.line).join('\n') + (fresh.length > 8 ? `\n+${fresh.length - 8} more` : '');
  console.log(msg); const r = await alert.send(msg); console.log(`alert queued${r.sent ? ' and sent' : ', waiting for WhatsApp'} (${r.waiting} waiting)`);
  if (fresh.length) process.exitCode = 1;
}
if (require.main === module) main().catch((e) => { console.error('NIGHT CHECK STOPPED: ' + e.message); process.exit(2); });
module.exports = { issues };
