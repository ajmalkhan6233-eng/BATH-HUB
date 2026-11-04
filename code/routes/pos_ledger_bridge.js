// routes/pos_ledger_bridge.js
// READ SIDE for POS cheque / credit bills and the "already billed" quotation marker.
// Nothing here changes cheques, credit_customers, aging, VAT, fiscal close or daily_summary.
// Voided bills (a row in pos_bill_voids) never appear. A split bill shows only its own cheque or credit part
// because every list reads pos_bill_payments rows, one per part.
// The only writes: pos_cheque_registered (link "this POS cheque was copied to the Cheques page").
const express = require('express');
const router = express.Router();
const pool = require('../utils/pool');

const num = r => ({ ...r, amount: Number(r.amount) });
const isId = v => /^\d+$/.test(String(v));

// Cheque parts of live bills that are not on the Cheques page yet.
router.get('/pos-ledger/cheques', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT p.id AS payment_id, p.amount, p.reference, b.id AS bill_id, b.bill_number, b.customer_name, b.customer_phone,
                   TO_CHAR(b.created_at,'YYYY-MM-DD') AS bill_date
            FROM pos_bill_payments p
            JOIN pos_bills b ON b.id = p.bill_id
            LEFT JOIN pos_bill_voids v ON v.bill_id = b.id
            LEFT JOIN pos_cheque_registered g ON g.payment_id = p.id
            WHERE p.method = 'cheque' AND v.bill_id IS NULL AND g.payment_id IS NULL
            ORDER BY b.created_at DESC, p.id DESC`);
        // match each bill's phone to a customer record (the Cheques page needs a customer id)
        const phones = [...new Set(r.rows.map(x => x.customer_phone).filter(Boolean))];
        const ids = {};
        if (phones.length) {
            const c = await pool.query(`SELECT id, phone FROM customers WHERE phone = ANY($1::text[]) ORDER BY id DESC`, [phones]);
            for (const x of c.rows) ids[x.phone] = x.id;   // lowest id wins (rows run newest first)
        }
        res.json(r.rows.map(x => ({ ...num(x), customer_id: ids[x.customer_phone] || null })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Step 1 of "Register this cheque": claim the POS cheque. A second claim is refused (never registered twice).
router.post('/pos-ledger/cheques/:id/claim', async (req, res) => {
    try {
        if (!isId(req.params.id)) return res.status(404).json({ error: 'not found' });
        const ok = await pool.query(`
            SELECT p.id FROM pos_bill_payments p LEFT JOIN pos_bill_voids v ON v.bill_id = p.bill_id
            WHERE p.id = $1 AND p.method = 'cheque' AND v.bill_id IS NULL`, [req.params.id]);
        if (!ok.rows.length) return res.status(404).json({ error: 'No such live POS cheque.' });
        const c = await pool.query(`INSERT INTO pos_cheque_registered (payment_id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING payment_id`, [req.params.id]);
        if (!c.rows.length) return res.status(409).json({ error: 'This cheque is already registered.' });
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Step 3: store the id of the cheque the existing POST /api/cheques made.
router.post('/pos-ledger/cheques/:id/done', async (req, res) => {
    try {
        if (!isId(req.params.id) || !isId(req.body && req.body.cheque_id)) return res.status(400).json({ error: 'cheque_id required' });
        const r = await pool.query(`UPDATE pos_cheque_registered SET cheque_id = $2 WHERE payment_id = $1 RETURNING payment_id`, [req.params.id, req.body.cheque_id]);
        if (!r.rows.length) return res.status(404).json({ error: 'not claimed' });
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Only if creating the cheque failed: give the claim back (a claim that already has a cheque id is never released).
router.post('/pos-ledger/cheques/:id/release', async (req, res) => {
    try {
        if (!isId(req.params.id)) return res.status(404).json({ error: 'not found' });
        await pool.query(`DELETE FROM pos_cheque_registered WHERE payment_id = $1 AND cheque_id IS NULL`, [req.params.id]);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Credit parts of live bills. Separate from Credit & Aging: never added to its totals.
router.get('/pos-ledger/credit', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT p.id AS payment_id, p.amount, b.bill_number, b.customer_name, b.customer_phone, TO_CHAR(b.created_at,'YYYY-MM-DD') AS bill_date
            FROM pos_bill_payments p
            JOIN pos_bills b ON b.id = p.bill_id
            LEFT JOIN pos_bill_voids v ON v.bill_id = b.id
            WHERE p.method = 'credit' AND v.bill_id IS NULL
            ORDER BY b.created_at DESC, p.id DESC`);
        const bills = r.rows.map(num);
        const by = new Map();
        for (const x of bills) {
            const key = x.customer_phone || x.customer_name || '(no name)';
            const e = by.get(key) || { customer: x.customer_name || x.customer_phone || '(no name)', phone: x.customer_phone || '', total: 0, bills: 0 };
            e.total = Math.round((e.total + x.amount) * 100) / 100; e.bills += 1; by.set(key, e);
        }
        const customers = [...by.values()].sort((a, b) => b.total - a.total);
        res.json({ bills, customers, total: Math.round(bills.reduce((s, x) => s + x.amount, 0) * 100) / 100 });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// quotation id -> bill number, for live bills only (a voided bill frees the quotation again).
router.get('/pos-ledger/quotation-billed', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT q.quotation_id, b.bill_number FROM pos_quotation_billed q
            JOIN pos_bills b ON b.id = q.bill_id LEFT JOIN pos_bill_voids v ON v.bill_id = b.id
            WHERE v.bill_id IS NULL ORDER BY q.bill_id`);
        const map = {};
        for (const x of r.rows) map[x.quotation_id] = x.bill_number;
        res.json(map);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
