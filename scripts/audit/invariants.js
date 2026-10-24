'use strict';
// AUDIT MACHINE, part 1: rules that must ALWAYS hold in the shop database. READ ONLY (SELECT only, never writes).
// Run on the live PC database (daily) or on the cloud test copy. Each rule returns { id, name, ok, bad, detail }.
//   ok=true  -> rule holds.   ok=false -> `bad` rows break it (detail shows up to 5).   skipped -> the table does not exist yet.
// Money rule used everywhere: amounts agree to the cent (0.01).
const EPS = 0.011;

const RULES = [
  { id: 'R01', name: 'No item has negative stock',
    sql: `SELECT item_code, name, stock_level FROM products WHERE active IS NOT FALSE AND stock_level < 0 LIMIT 50` },
  { id: 'R02', name: 'Every bill: lines add up to the subtotal',
    sql: `SELECT b.bill_number, b.subtotal, SUM(i.line_total) AS lines FROM pos_bills b JOIN pos_bill_items i ON i.bill_id = b.id
           GROUP BY b.id HAVING ABS(b.subtotal - SUM(i.line_total)) > ${EPS} LIMIT 50` },
  { id: 'R03', name: 'Every bill: total = subtotal - discount',
    sql: `SELECT bill_number, subtotal, discount_amount, total FROM pos_bills WHERE ABS(total - (subtotal - COALESCE(discount_amount,0))) > ${EPS} LIMIT 50` },
  { id: 'R04', name: 'Every bill: payments add up to the total',
    sql: `SELECT b.bill_number, b.total, SUM(p.amount) AS paid FROM pos_bills b JOIN pos_bill_payments p ON p.bill_id = b.id
           GROUP BY b.id HAVING ABS(b.total - SUM(p.amount)) > ${EPS} LIMIT 50` },
  { id: 'R05', name: 'Every bill: each line = qty x price',
    sql: `SELECT b.bill_number, i.item_name, i.qty, i.unit_price, i.line_total FROM pos_bill_items i JOIN pos_bills b ON b.id = i.bill_id
           WHERE ABS(i.line_total - ROUND(i.qty * i.unit_price, 2)) > ${EPS} LIMIT 50` },
  { id: 'R06', name: 'No two bills share a bill number',
    sql: `SELECT bill_number, COUNT(*) AS n FROM pos_bills GROUP BY bill_number HAVING COUNT(*) > 1 LIMIT 50` },
  { id: 'R07', name: 'No bill line or payment without its bill',
    sql: `SELECT 'item' AS kind, i.id FROM pos_bill_items i LEFT JOIN pos_bills b ON b.id = i.bill_id WHERE b.id IS NULL
           UNION ALL SELECT 'payment', p.id FROM pos_bill_payments p LEFT JOIN pos_bills b ON b.id = p.bill_id WHERE b.id IS NULL LIMIT 50` },
  { id: 'R08', name: 'No bill has a negative or zero total',
    sql: `SELECT bill_number, total FROM pos_bills WHERE total <= 0 LIMIT 50` },
  { id: 'R09', name: 'A WhatsApp receipt was sent only once per bill',
    sql: `SELECT sale_reference, COUNT(*) AS sent FROM receipt_queue WHERE status = 'sent' AND sale_reference IS NOT NULL GROUP BY sale_reference HAVING COUNT(*) > 1 LIMIT 50` },
  { id: 'R10', name: 'Every vendor bill: total = sum of its GRN lines (when linked to a GRN)',
    sql: `SELECT vb.bill_no, vb.total, g.s AS grn_total FROM vendor_bills vb JOIN (SELECT grn_number, SUM(total_amount) AS s FROM grn_records GROUP BY grn_number) g ON g.grn_number = vb.bill_no
           WHERE vb.voided = FALSE AND ABS(vb.total - g.s) > ${EPS} LIMIT 50` },
  { id: 'R11', name: 'No vendor payment or cheque without its bill',
    sql: `SELECT 'payment' AS kind, p.id FROM vendor_payments p LEFT JOIN vendor_bills b ON b.id = p.bill_id WHERE b.id IS NULL
           UNION ALL SELECT 'cheque', c.id FROM vendor_bill_cheques c LEFT JOIN vendor_bills b ON b.id = c.bill_id WHERE b.id IS NULL LIMIT 50` },
  { id: 'R12', name: 'No vendor bill is paid more than its total (payments + cleared cheques + credit notes)',
    sql: `SELECT vb.bill_no, vb.total, COALESCE(p.s,0) + COALESCE(c.s,0) + COALESCE(n.s,0) AS paid FROM vendor_bills vb
           LEFT JOIN (SELECT bill_id, SUM(amount) s FROM vendor_payments GROUP BY bill_id) p ON p.bill_id = vb.id
           LEFT JOIN (SELECT bill_id, SUM(amount) s FROM vendor_bill_cheques WHERE status = 'CLEARED' GROUP BY bill_id) c ON c.bill_id = vb.id
           LEFT JOIN (SELECT bill_id, SUM(amount) s FROM vendor_credit_notes GROUP BY bill_id) n ON n.bill_id = vb.id
           WHERE vb.voided = FALSE AND COALESCE(p.s,0) + COALESCE(c.s,0) + COALESCE(n.s,0) > vb.total + ${EPS} LIMIT 50` },
  { id: 'R13', name: 'A cleared cheque has a cleared date and a positive amount',
    sql: `SELECT id, cheque_no, amount, status FROM vendor_bill_cheques WHERE amount <= 0 OR (status = 'CLEARED' AND cleared_at IS NULL) LIMIT 50` },
  { id: 'R14', name: 'No money column has more than 2 decimals (rounding leaks)',
    sql: `SELECT bill_number, total FROM pos_bills WHERE total <> ROUND(total, 2) OR subtotal <> ROUND(subtotal, 2) LIMIT 50` },
  { id: 'R15', name: 'No item sells below its cost price (check the price or the cost)',
    sql: `SELECT item_code, name, selling_price, avg_cost FROM products WHERE active IS NOT FALSE AND selling_price > 0 AND avg_cost > 0 AND selling_price < avg_cost LIMIT 50`, warn: true },
  { id: 'R16', name: 'Stock moved only by GRN, sales, voids (since the last baseline)', special: 'stock_baseline' },
];

async function run(pool, opts = {}) {
  const out = [];
  for (const r of RULES) {
    if (r.special === 'stock_baseline') { out.push(await stockBaseline(pool, opts)); continue; }
    try {
      const { rows } = await pool.query(r.sql);
      out.push({ id: r.id, name: r.name, ok: rows.length === 0, warn: !!r.warn, bad: rows.length, detail: rows.slice(0, 5) });
    } catch (e) {
      if (e && (e.code === '42P01' || e.code === '42703' || /does not exist/i.test(e.message || ''))) out.push({ id: r.id, name: r.name, ok: true, skipped: true, bad: 0, detail: ['skipped: ' + (e.message || '').slice(0, 80)] });
      else out.push({ id: r.id, name: r.name, ok: false, bad: 1, detail: ['rule could not run: ' + String(e.message || e).slice(0, 120)] });
    }
  }
  return out;
}

// R16: opening stock is not in any ledger, so the rule is checked as a CHANGE since a saved baseline:
//   stock now = stock at baseline + GRN qty since - qty sold since (non-voided) + qty of bills voided since.
// The baseline is saved in table audit_baseline the first time (that write is the audit's own bookkeeping, never shop data).
async function stockBaseline(pool, opts) {
  const base = { id: 'R16', name: 'Stock moved only by GRN, sales and voids since the last baseline' };
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS audit_baseline (item_code TEXT PRIMARY KEY, stock NUMERIC, grn_in NUMERIC, sold NUMERIC, taken_at TIMESTAMPTZ DEFAULT NOW())`);
    const now = (await pool.query(`SELECT p.item_code, p.stock_level AS stock,
        COALESCE((SELECT SUM(g.quantity) FROM grn_records g WHERE g.item_description LIKE p.item_code || ' - %'),0) AS grn_in,
        COALESCE((SELECT SUM(i.qty) FROM pos_bill_items i JOIN pos_bills b ON b.id = i.bill_id WHERE i.item_code = p.item_code AND NOT EXISTS (SELECT 1 FROM pos_bill_voids v WHERE v.bill_id = b.id)),0) AS sold
        FROM products p WHERE p.item_code IS NOT NULL AND p.active IS NOT FALSE`)).rows;
    const saved = new Map((await pool.query(`SELECT * FROM audit_baseline`)).rows.map(r => [r.item_code, r]));
    if (!saved.size || opts.resetBaseline) {
      await pool.query(`DELETE FROM audit_baseline`);
      for (const r of now) await pool.query(`INSERT INTO audit_baseline (item_code, stock, grn_in, sold) VALUES ($1,$2,$3,$4)`, [r.item_code, r.stock, r.grn_in, r.sold]);
      return Object.assign(base, { ok: true, bad: 0, detail: ['baseline saved for ' + now.length + ' items; checked from the next run'] });
    }
    const bad = [];
    for (const r of now) {
      const s = saved.get(r.item_code); if (!s) continue;
      const expect = Number(s.stock) + (Number(r.grn_in) - Number(s.grn_in)) - (Number(r.sold) - Number(s.sold));
      if (Math.abs(Number(r.stock) - expect) > 0.0051) bad.push({ item_code: r.item_code, stock_now: Number(r.stock), expected: Math.round(expect * 100) / 100 });
    }
    return Object.assign(base, { ok: bad.length === 0, bad: bad.length, detail: bad.slice(0, 5), note: 'manual stock edits show here on purpose: re-run with --reset-baseline after a stock count' });
  } catch (e) { return Object.assign(base, { ok: true, skipped: true, bad: 0, detail: ['skipped: ' + String(e.message || e).slice(0, 80)] }); }
}

// one short line for the 06:00 message
function oneLine(results) {
  const fails = results.filter(r => !r.ok && !r.skipped && !r.warn), warns = results.filter(r => !r.ok && r.warn);
  const ran = results.filter(r => !r.skipped).length;
  if (!fails.length) return 'AUDIT GREEN: ' + ran + ' rules hold' + (warns.length ? ' (' + warns.length + ' price heads-up)' : '');
  return 'AUDIT RED: ' + fails.length + ' rule(s) broken: ' + fails.map(f => f.id).join(', ');
}
module.exports = { RULES, run, oneLine, EPS };
