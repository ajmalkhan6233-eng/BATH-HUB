'use strict';
// NUMBERS GUARD, part 1: the key shop numbers at one moment. Plain SQL, no AI. Written against the real RBH tables.
// A table that is missing gives null (and is named in "missing"), it never crashes the guard.
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
async function one(c, sql, missing, name) {
  try { return (await c.query(sql)).rows; } catch (e) { missing.push(name + ': ' + e.message.split('\n')[0]); await c.query('ROLLBACK').catch(() => {}); return null; }
}
async function take(c) {
  const missing = []; const s = {};
  let r = await one(c, `SELECT COUNT(*)::int n, COALESCE(SUM(stock_level),0) pcs, COALESCE(SUM(stock_level*COALESCE(avg_cost,0)),0) val FROM products WHERE active`, missing, 'products');
  if (r) { s.item_count = r[0].n; s.stock_pieces = r2(r[0].pcs); s.stock_value_cost = r2(r[0].val); }
  // vendor owed = bills (not voided) - payments - credit notes, per vendor name exactly as stored (same rule as the app's vendor ledger)
  r = await one(c, `SELECT b.vendor_name v, COALESCE(SUM(b.total),0) - COALESCE((SELECT SUM(p.amount) FROM vendor_payments p WHERE p.bill_id IN (SELECT id FROM vendor_bills x WHERE x.vendor_name=b.vendor_name)),0)
      - COALESCE((SELECT SUM(n.amount) FROM vendor_credit_notes n WHERE n.bill_id IN (SELECT id FROM vendor_bills x WHERE x.vendor_name=b.vendor_name)),0) owed
      FROM vendor_bills b WHERE COALESCE(b.voided,false)=false GROUP BY b.vendor_name`, missing, 'vendor_bills');
  if (r) { s.vendor_owed = {}; r.forEach((x) => { s.vendor_owed[x.v] = r2(x.owed); }); }
  // cheques: given to vendors (not cancelled) + the cheque register
  r = await one(c, `SELECT COALESCE(SUM(amount),0) t FROM vendor_bill_cheques WHERE COALESCE(status,'') NOT IN ('CANCELLED')`, missing, 'vendor_bill_cheques');
  const r3 = await one(c, `SELECT COALESCE(SUM(amount),0) t FROM cheque_register`, missing, 'cheque_register');
  if (r || r3) s.cheque_total = r2((r ? Number(r[0].t) : 0) + (r3 ? Number(r3[0].t) : 0));
  r = await one(c, `SELECT COUNT(*)::int n, COALESCE(SUM(total),0) t FROM pos_bills WHERE id::text NOT IN (SELECT bill_id::text FROM pos_bill_voids WHERE bill_id IS NOT NULL)`, missing, 'pos_bills');
  if (r) { s.pos_bill_count = r[0].n; s.pos_bill_total = r2(r[0].t); }
  r = await one(c, `SELECT COALESCE(SUM(NULLIF(cash_in::text,'')::numeric),0) t FROM daily_summary`, missing, 'daily_summary');
  if (r) s.cash_in_ledger = r2(r[0].t);
  s.missing = missing; s.taken_at = new Date().toISOString();
  return s;
}
module.exports = { take, r2 };
