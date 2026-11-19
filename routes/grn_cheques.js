// Vendor cheques list for the GRN screen: see all, edit, delete. Uses the existing table vendor_bill_cheques (no new tables).
// Add = existing POST /grn-workbench/cheque. Clear / bounce / cancel = existing /vendor-ledger/cheques/:id/*.
const express = require('express');
const pool = require('../utils/pool');
const router = express.Router();
const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v)) && !isNaN(Date.parse(v));
const bad = (m, s) => Object.assign(new Error(m), { status: s || 400 });

router.get('/grn-cheques', async (req, res) => {
    try {
        const r = await pool.query(`SELECT c.id, c.bill_id, c.cheque_no, c.bank, c.payee, c.amount, to_char(c.cheque_date,'YYYY-MM-DD') AS cheque_date, to_char(c.due_date,'YYYY-MM-DD') AS due_date,
              c.status, c.photo_path, b.vendor_name, b.bill_no
            FROM vendor_bill_cheques c JOIN vendor_bills b ON b.id = c.bill_id ORDER BY c.due_date DESC, c.id DESC LIMIT 500`);
        // Remaining per bill follows the ledger rule: a bill drops only when a cheque is CLEARED, or cash is paid, or a credit note is applied.
        const bl = await pool.query(`SELECT b.id, b.vendor_name, b.bill_no, to_char(b.bill_date,'YYYY-MM-DD') AS bill_date, b.total,
              b.total - COALESCE((SELECT SUM(amount) FROM vendor_payments WHERE bill_id=b.id),0) - COALESCE((SELECT SUM(amount) FROM vendor_credit_notes WHERE bill_id=b.id),0)
                - COALESCE((SELECT SUM(amount) FROM vendor_bill_cheques WHERE bill_id=b.id AND status='CLEARED'),0) AS remaining,
              COALESCE((SELECT SUM(amount) FROM vendor_bill_cheques WHERE bill_id=b.id AND status='ISSUED'),0) AS issued
            FROM vendor_bills b WHERE b.voided=FALSE ORDER BY b.vendor_name, b.bill_date, b.id`);
        const bills = bl.rows.map(x => ({ ...x, total: Number(x.total), remaining: Number(x.remaining), issued: Number(x.issued) }));
        res.json({ cheques: r.rows.map(x => ({ ...x, amount: Number(x.amount) })), bills });
    } catch (e) { res.status(500).json({ error: 'Could not load cheques: ' + e.message }); }
});

router.put('/grn-cheques/:id', express.json(), async (req, res) => {
    try {
        const id = Number(req.params.id), b = req.body || {};
        const cur = (await pool.query(`SELECT * FROM vendor_bill_cheques WHERE id=$1`, [id])).rows[0];
        if (!cur) throw bad('Cheque not found', 404);
        if (cur.status === 'CLEARED') throw bad('A cleared cheque cannot be changed', 409);
        const amount = b.amount === undefined ? Number(cur.amount) : Math.round(Number(b.amount) * 100) / 100;
        if (!(amount > 0)) throw bad('Amount must be more than 0');
        const cheque_date = b.cheque_date === undefined ? null : b.cheque_date, due_date = b.due_date === undefined ? null : b.due_date;
        if (cheque_date !== null && !isDate(cheque_date)) throw bad('Cheque date is not valid');
        if (due_date !== null && !isDate(due_date)) throw bad('Due date is not valid');
        const cheque_no = b.cheque_no === undefined ? cur.cheque_no : (String(b.cheque_no).trim().slice(0, 40) || null);
        const bank = b.bank === undefined ? cur.bank : (String(b.bank).trim().slice(0, 60) || null);
        if (cheque_no) {
            const dup = await pool.query(`SELECT 1 FROM vendor_bill_cheques WHERE cheque_no=$1 AND COALESCE(bank,'')=COALESCE($2,'') AND status<>'CANCELLED' AND id<>$3 LIMIT 1`, [cheque_no, bank, id]);
            if (dup.rows.length) throw bad('Cheque ' + cheque_no + ' is already entered', 409);
        }
        const r = await pool.query(`UPDATE vendor_bill_cheques SET cheque_no=$1, bank=$2, amount=$3, cheque_date=COALESCE($4::date,cheque_date), due_date=COALESCE($5::date,due_date) WHERE id=$6 RETURNING id`,
            [cheque_no, bank, amount, cheque_date, due_date, id]);
        res.json({ ok: true, id: r.rows[0].id });
    } catch (e) { res.status(e.status || 500).json({ error: e.status ? e.message : 'Could not save: ' + e.message }); }
});

router.delete('/grn-cheques/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const cur = (await pool.query(`SELECT status FROM vendor_bill_cheques WHERE id=$1`, [id])).rows[0];
        if (!cur) throw bad('Cheque not found', 404);
        if (cur.status === 'CLEARED') throw bad('A cleared cheque cannot be deleted. It is already paid.', 409);
        await pool.query(`DELETE FROM vendor_bill_cheques WHERE id=$1`, [id]);
        res.json({ ok: true });
    } catch (e) { res.status(e.status || 500).json({ error: e.status ? e.message : 'Could not delete: ' + e.message }); }
});
module.exports = router;
