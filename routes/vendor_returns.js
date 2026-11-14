'use strict';
// POST /api/vendor-returns  (owner/admin only, reason required)
//  kind RETURN   { bill_id, lines:[{item_code, qty, rate}], reason }  -> stock, average cost and vendor payable move together
//  kind DISCOUNT { bill_id, amount, reason }                         -> payable drops, cost of the bill's items in stock drops
// One transaction: if anything is wrong nothing is saved. The payable change is a vendor credit note (same table the ledger already reads).
const express = require('express');
const pool = require('../utils/pool');
const audit = require('../utils/moneyAudit');
const A = require('../utils/vendorAdjust');
const { todayLK } = require('../utils/lkTime');
const router = express.Router();
const bad = (m) => { const e = new Error(m); e.status = 400; return e; };

router.post('/vendor-returns', async (req, res) => {
  let c;
  try {
    if (!audit.isOwner(req)) return res.status(403).json({ error: 'Only the owner or admin can record a return or discount' });
    const b = req.body || {};
    const billId = Number(b.bill_id), kind = String(b.kind || '').toUpperCase(), reason = String(b.reason || '').trim();
    if (!Number.isInteger(billId)) throw bad('bill_id is required');
    if (!['RETURN', 'DISCOUNT'].includes(kind)) throw bad('kind must be RETURN or DISCOUNT');
    if (!audit.reasonOk(reason)) throw bad('Give a reason (at least 3 letters)');
    const noteDate = b.note_date || todayLK();
    c = await pool.connect();
    await c.query('BEGIN');
    const bill = (await c.query('SELECT id, vendor_name, bill_no, total, voided FROM vendor_bills WHERE id=$1 FOR UPDATE', [billId])).rows[0];
    if (!bill || bill.voided) throw bad('Bill not found or voided');
    const credited = Number((await c.query('SELECT COALESCE(SUM(amount),0) AS s FROM vendor_credit_notes WHERE bill_id=$1', [billId])).rows[0].s);
    const room = A.r2(Number(bill.total) - credited);
    const detail = [];
    let amount = 0;
    if (kind === 'RETURN') {
      const lines = Array.isArray(b.lines) ? b.lines : [];
      if (!lines.length) throw bad('Add at least one line to return');
      const seen = new Set();
      for (const l of lines) {
        const code = String(l.item_code || '').trim();
        if (!code || seen.has(code)) throw bad('Each item once, with its item code'); seen.add(code);
        const p = (await c.query('SELECT item_code, name, stock_level, avg_cost FROM products WHERE item_code=$1 AND active=true FOR UPDATE', [code])).rows[0];
        if (!p) throw bad(`Item ${code} not found`);
        const r = A.returnLine({ stock: p.stock_level, avgCost: p.avg_cost, qty: l.qty, rate: l.rate });
        await c.query('UPDATE products SET stock_level=$1, avg_cost=$2 WHERE item_code=$3', [r.newStock, r.newAvgCost, code]);
        amount = A.r2(amount + r.credit);
        detail.push({ item_code: code, name: p.name, qty: Number(l.qty), credit: r.credit, stock_now: r.newStock, avg_cost_now: r.newAvgCost });
      }
    } else {
      amount = A.r2(Number(b.amount));
      const rows = (await c.query(`SELECT item_description, quantity, total_amount FROM grn_records WHERE grn_number=$1 AND supplier_name ILIKE $2`, [bill.bill_no, bill.vendor_name])).rows;
      const parts = A.splitDiscount(amount, rows.map((r) => ({ code: String(r.item_description).split(' - ')[0], qty: Number(r.quantity), value: Number(r.total_amount) })));
      for (const p of parts) {
        const it = (await c.query('SELECT stock_level, avg_cost FROM products WHERE item_code=$1 FOR UPDATE', [p.code])).rows[0];
        if (!it) continue;
        const d = A.discountLine({ stock: it.stock_level, avgCost: it.avg_cost, qtyOnBill: p.qty, share: p.share });
        await c.query('UPDATE products SET avg_cost=$1 WHERE item_code=$2', [d.newAvgCost, p.code]);
        detail.push({ item_code: p.code, share: p.share, avg_cost_now: d.newAvgCost, share_for_units_already_sold: d.soldShare });
      }
    }
    if (!(amount > 0)) throw bad('Nothing to credit');
    if (amount > room + 0.005) throw bad(`Credit ${amount} is more than the bill still owes (${room})`);
    const n = Number((await c.query('SELECT COUNT(*) AS n FROM vendor_credit_notes WHERE bill_id=$1', [billId])).rows[0].n) + 1;
    const note = (await c.query(
      `INSERT INTO vendor_credit_notes (branch_id, bill_id, note_no, amount, note_date, reason, created_by) VALUES (1,$1,$2,$3,$4,$5,$6) RETURNING id, note_no`,
      [billId, `${kind === 'RETURN' ? 'RET' : 'DSC'}-${bill.bill_no}-${n}`, amount, noteDate, `${kind}: ${reason}`, (req.session && req.session.user && req.session.user.username) || null])).rows[0];
    await c.query('COMMIT');
    audit.log(pool, { who: (req.session && req.session.user && req.session.user.username) || 'system', action: 'vendor_' + kind.toLowerCase(), table: 'vendor_bills', id: billId, oldValue: String(room), newValue: String(A.r2(room - amount)), reason }).catch(() => {});
    res.status(201).json({ kind, bill_id: billId, credit_note: note, credited: amount, owed_after: A.r2(room - amount), items: detail });
  } catch (e) {
    if (c) await c.query('ROLLBACK').catch(() => {});
    res.status(e.status || 500).json({ error: e.status ? e.message : 'Could not save (nothing was changed)' });
  } finally { if (c) c.release(); }
});
// BLOCK: lookup (14 Nov, AJ: "type the code, vendor and everything comes"). READ ONLY. Item + the open vendor bills that carried it, newest first.
router.get('/vendor-returns/lookup', async (req, res) => {
  try {
    if (!audit.isOwner(req)) return res.status(403).json({ error: 'Only the owner or admin can record a return' });
    const code = String(req.query.code || '').trim();
    if (!code) return res.status(400).json({ error: 'Type an item code' });
    const p = (await pool.query('SELECT item_code, name, stock_level, avg_cost FROM products WHERE item_code=$1 AND active=true', [code])).rows[0];
    if (!p) return res.status(404).json({ error: 'No item with code ' + code });
    const bills = (await pool.query(
      `SELECT b.id AS bill_id, b.vendor_name, b.bill_no, TO_CHAR(b.bill_date,'YYYY-MM-DD') AS bill_date, g.quantity AS bought, g.unit_cost,
              (b.total - COALESCE((SELECT SUM(amount) FROM vendor_credit_notes n WHERE n.bill_id=b.id),0)) AS room
         FROM grn_records g JOIN vendor_bills b ON b.bill_no = g.grn_number AND b.vendor_name ILIKE g.supplier_name AND NOT b.voided
        WHERE split_part(g.item_description,' - ',1) = $1
        ORDER BY b.bill_date DESC, b.id DESC LIMIT 6`, [code])).rows;
    res.json({ item: p, bills });
  } catch (e) { res.status(500).json({ error: 'Could not look that up' }); }
});

// BLOCK: bill lines (14 Nov, AJ: "we return vendor by vendor, not item by item"). READ ONLY. One bill with all its items, for the return screen.
router.get('/vendor-returns/bill/:id', async (req, res) => {
  try {
    if (!audit.isOwner(req)) return res.status(403).json({ error: 'Only the owner or admin can record a return' });
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad bill' });
    const bill = (await pool.query(
      `SELECT b.id, b.vendor_name, b.bill_no, TO_CHAR(b.bill_date,'YYYY-MM-DD') AS bill_date, b.total,
              (b.total - COALESCE((SELECT SUM(amount) FROM vendor_credit_notes n WHERE n.bill_id=b.id),0)) AS room
         FROM vendor_bills b WHERE b.id=$1 AND NOT b.voided`, [id])).rows[0];
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    const lines = (await pool.query(
      `SELECT split_part(g.item_description,' - ',1) AS item_code, MAX(p.name) AS name, SUM(g.quantity) AS bought,
              CASE WHEN SUM(g.quantity) > 0 THEN SUM(g.total_amount) / SUM(g.quantity) ELSE 0 END AS unit_cost, MAX(p.stock_level) AS stock
         FROM grn_records g LEFT JOIN products p ON p.item_code = split_part(g.item_description,' - ',1)
        WHERE g.grn_number = $1 AND g.supplier_name ILIKE $2
        GROUP BY 1 ORDER BY 1`, [bill.bill_no, bill.vendor_name])).rows;
    res.json({ bill, lines });
  } catch (e) { res.status(500).json({ error: 'Could not load the bill' }); }
});

module.exports = router;
