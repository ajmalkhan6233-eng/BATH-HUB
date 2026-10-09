// routes/pos_bill_corrections.js
// POS BILL CORRECTION (isolated module): VOID and EDIT a POS bill. Owner/admin only.
//   POST /api/pos-bills/:id/void   { reason }   keep the bill, mark it VOID, give stock back, log who/when/why
//   PUT  /api/pos-bills/:id        { same body as creating a bill, reason? }  old version saved first, then totals + stock recomputed
// A bill is NEVER hard-deleted. Voided bills stay in the list (greyed, VOID tag) and are left out of every total (see pos_bills.js).
// New tables only (created in pos_bills.js with the other POS tables): pos_bill_voids, pos_bill_history. No ALTER on any table.
// Stock: only touched when POS_DEDUCT_STOCK=true, exactly mirroring bill creation (catalogue lines with an item_code, active products).
const express = require('express');
const { Pool } = require('pg');
const router = express.Router();

const pool = require('../utils/pool');

const money2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const roleOf = req => (req.session && req.session.user && req.session.user.role) || 'staff';
// Only the admin (the shop owner who runs the till) may correct a bill. The read-only 'owner' (uncle) account may not.
const isOwner = req => roleOf(req) === 'admin';
const whoOf = req => (req.session && req.session.user && (req.session.user.username || req.session.user.name)) || 'unknown';
const deductsStock = () => String(process.env.POS_DEDUCT_STOCK).toLowerCase() === 'true';

function ownerOnly(req, res, next) {
    if (!isOwner(req)) return res.status(403).json({ error: 'Only the admin (shop owner) can correct a bill.' });
    next();
}

// Same line / discount rules as creating a bill (routes/pos_bills.js), so an edited bill follows the same arithmetic.
function parseBill(body) {
    const { customer_name, customer_phone, items, discount_pct, payment_method, notes } = body || {};
    if (!Array.isArray(items) || !items.length) return { error: 'items (non-empty array) is required' };
    if (items.length > 100) return { error: 'a bill can have at most 100 items' };
    const lines = [];
    for (const [i, it] of items.entries()) {
        if (!it || !String(it.item_name || '').trim() || it.qty === undefined || it.unit_price === undefined)
            return { error: `item ${i + 1}: item_name, qty and unit_price are required` };
        const item_name = String(it.item_name).trim();
        if (item_name.length > 200) return { error: `item ${i + 1}: item_name is too long (max 200 characters)` };
        const q = Number(it.qty), pr = Number(it.unit_price);
        if (!Number.isFinite(q) || q <= 0) return { error: `item ${i + 1} (${item_name}): qty must be a number greater than 0` };
        if (!Number.isFinite(pr) || pr < 0) return { error: `item ${i + 1} (${item_name}): unit_price must be a number, 0 or more` };
        if (q > 99999999 || pr > 9999999999) return { error: `item ${i + 1} (${item_name}): qty or unit_price is too large` };
        const qty = money2(q), unit_price = money2(pr);
        const item_code = it.item_code == null || it.item_code === '' ? null : String(it.item_code).trim().slice(0, 50);
        lines.push({ item_name, item_code, qty, unit_price, line_total: money2(qty * unit_price) });
    }
    const subtotal = money2(lines.reduce((s, l) => s + l.line_total, 0));
    const pct = Number(discount_pct) || 0;
    if (pct < 0 || pct > 100) return { error: 'discount_pct must be between 0 and 100' };
    if (subtotal <= 0) return { error: 'the bill total must be more than 0' };
    if (String(customer_name || '').length > 150) return { error: 'customer_name is too long (max 150 characters)' };
    if (String(customer_phone || '').length > 30) return { error: 'customer_phone is too long (max 30 characters)' };
    const discount_amount = money2(subtotal * pct / 100);
    return {
        lines, pct, subtotal, discount_amount, total: money2(subtotal - discount_amount),
        customer_name: customer_name || null, customer_phone: customer_phone || null,
        payment_method: payment_method || 'cash', notes: notes || null,
    };
}

async function giveStockBack(client, items) {
    const restored = [];
    for (const l of items) {
        if (!l.item_code) continue;
        await client.query(`UPDATE products SET stock_level = COALESCE(stock_level, 0) + $1 WHERE item_code = $2 AND active = true`, [l.qty, l.item_code]);
        restored.push({ item_code: l.item_code, qty: Number(l.qty) });
    }
    return restored;
}

async function lockBill(client, id) {
    if (!/^\d+$/.test(String(id))) return null;
    const b = await client.query(`SELECT * FROM pos_bills WHERE id = $1 FOR UPDATE`, [id]);
    return b.rows[0] || null;
}
const isVoid = async (client, id) => (await client.query(`SELECT 1 FROM pos_bill_voids WHERE bill_id = $1`, [id])).rows.length > 0;
const itemsOf = async (client, id) => (await client.query(
    `SELECT item_name, item_code, qty, unit_price, line_total FROM pos_bill_items WHERE bill_id = $1 ORDER BY id`, [id])).rows;

// ───────────── VOID ─────────────
router.post('/pos-bills/:id/void', ownerOnly, async (req, res) => {
    const reason = String((req.body && req.body.reason) || '').trim();
    if (reason.length < 3) return res.status(400).json({ error: 'A reason is required to void a bill.' });
    if (reason.length > 500) return res.status(400).json({ error: 'The reason is too long (max 500 characters).' });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const bill = await lockBill(client, req.params.id);
        if (!bill) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not found' }); }
        if (await isVoid(client, bill.id)) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'This bill is already void.' }); }
        const items = await itemsOf(client, bill.id);
        const restored = deductsStock() ? await giveStockBack(client, items) : [];
        await client.query(`INSERT INTO pos_bill_voids (bill_id, reason, voided_by, stock_restored) VALUES ($1,$2,$3,$4)`,
            [bill.id, reason, whoOf(req), JSON.stringify(restored)]);
        await client.query(`INSERT INTO pos_bill_history (bill_id, action, reason, changed_by, old_version) VALUES ($1,'void',$2,$3,$4)`,
            [bill.id, reason, whoOf(req), JSON.stringify({ bill, items })]);
        await client.query('COMMIT');
        res.json({ ok: true, bill_id: bill.id, bill_number: bill.bill_number, status: 'VOID', reason, voided_by: whoOf(req), stock_restored: restored });
    } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        res.status(500).json({ error: `Could not void the bill: ${e.message}` });
    } finally { client.release(); }
});

// ───────────── EDIT ─────────────
router.put('/pos-bills/:id', ownerOnly, async (req, res) => {
    const p = parseBill(req.body);
    if (p.error) return res.status(400).json({ error: p.error });
    const reason = String((req.body && req.body.reason) || '').trim().slice(0, 500) || null;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const bill = await lockBill(client, req.params.id);
        if (!bill) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not found' }); }
        if (await isVoid(client, bill.id)) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'A void bill cannot be edited.' }); }
        // A bill paid by cheque, credit or split keeps its payment rows: editing could make them disagree with the total.
        const hasPayRows = await client.query(`SELECT 1 FROM pos_bill_payments WHERE bill_id = $1 LIMIT 1`, [bill.id]).then(r => r.rows.length > 0).catch(() => false);
        if (hasPayRows) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'This bill was paid by cheque, credit or split payment. Void it and enter it again.', code: 'has_payment_rows' }); }

        // Discount above the owner's cap needs the owner's explicit OK, same as creating a bill.
        let override = false;
        if (p.pct > 0) {
            let cap = [];
            try {
                cap = (await client.query(`SELECT max_discount_pct FROM discount_rules WHERE active = true AND role IN ($1, 'all') ORDER BY (role = 'all'), id DESC LIMIT 1`, [roleOf(req)])).rows;
            } catch (e) { cap = []; }
            if (cap.length && p.pct > Number(cap[0].max_discount_pct)) {
                if (req.body.override !== true) {
                    await client.query('ROLLBACK');
                    return res.status(409).json({ error: `A ${p.pct}% discount is more than the allowed ${Number(cap[0].max_discount_pct)}%. Approve it as the owner.`, code: 'discount_over_cap', max_allowed: Number(cap[0].max_discount_pct), can_override: true });
                }
                override = true;
            }
        }

        const oldItems = await itemsOf(client, bill.id);
        await client.query(`INSERT INTO pos_bill_history (bill_id, action, reason, changed_by, old_version) VALUES ($1,'edit',$2,$3,$4)`,
            [bill.id, reason, whoOf(req), JSON.stringify({ bill, items: oldItems })]);

        if (deductsStock()) {
            await giveStockBack(client, oldItems);
            for (const l of p.lines) {
                if (l.item_code) await client.query(`UPDATE products SET stock_level = COALESCE(stock_level, 0) - $1 WHERE item_code = $2 AND active = true`, [l.qty, l.item_code]);
            }
        }
        await client.query(`DELETE FROM pos_bill_items WHERE bill_id = $1`, [bill.id]);
        for (const l of p.lines) {
            await client.query(`INSERT INTO pos_bill_items (bill_id, item_name, item_code, qty, unit_price, line_total) VALUES ($1,$2,$3,$4,$5,$6)`,
                [bill.id, l.item_name, l.item_code, l.qty, l.unit_price, l.line_total]);
        }
        await client.query(
            `UPDATE pos_bills SET customer_name=$1, customer_phone=$2, subtotal=$3, discount_pct=$4, discount_amount=$5, total=$6,
                    payment_method=$7, notes=$8, discount_override=$9 WHERE id=$10`,
            [p.customer_name, p.customer_phone, p.subtotal, p.pct, p.discount_amount, p.total, p.payment_method, p.notes, override || bill.discount_override, bill.id]);
        await client.query('COMMIT');

        const nb = (await pool.query(`SELECT * FROM pos_bills WHERE id = $1`, [bill.id])).rows[0];
        const ni = (await pool.query(`SELECT id, item_name, item_code, qty, unit_price, line_total FROM pos_bill_items WHERE bill_id = $1 ORDER BY id`, [bill.id])).rows;
        res.json({ ...nb, items: ni, edited_by: whoOf(req), stock_adjusted: deductsStock() });
    } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        res.status(500).json({ error: `Could not edit the bill: ${e.message}` });
    } finally { client.release(); }
});

// History of one bill (owner only): every earlier version and the void record.
router.get('/pos-bills/:id/history', ownerOnly, async (req, res) => {
    try {
        if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'not found' });
        const h = await pool.query(`SELECT id, action, reason, changed_by, changed_at, old_version FROM pos_bill_history WHERE bill_id = $1 ORDER BY id`, [req.params.id]);
        res.json(h.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;