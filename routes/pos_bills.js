// routes/pos_bills.js
// POS BILL GENERATOR for Bath Hub Thihariya — a standalone, own-table bill/receipt
// feature. Own Pool, same conventions as investor_loans.js / sale_commissions.js.
//
// WHY A NEW TABLE (not lasersoft_invoices / daily_summary):
// AGENT_GUIDE/09_golden_core.md forbids altering financial-table schema, and
// lasersoft_invoices specifically holds data imported FROM the shop's external
// LaserSoft POS via Excel upload — it is a record of past sales, not something a
// live "Generate Bill" feature should write into. This module is fully separate:
// it neither reads nor writes any golden-core table.
//
// Discount handling: reuses the existing crm_discount_rules cap-check pattern
// conceptually, but stores the actual discount_pct/discount_amount actually
// applied to a given bill (that concept did not exist anywhere before this file —
// shop_operations.js's discount-check only validates a proposed % against a cap,
// it never persists one against a sale).
//
// Sharing: WhatsApp/email/print are handled client-side (wa.me / mailto: links,
// window.print()) — this file does NOT send anything itself. CLAUDE.md has a hard
// rule against starting this repo's whatsapp-bridge locally (kills the live shop's
// WhatsApp session), so no server-side WhatsApp send is wired here.
//
// Tables:
//   pos_bills       -> one row per generated bill (customer, discount, totals)
//   pos_bill_items  -> line items belonging to a bill

require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const PDFDocument = require('pdfkit');

const router = express.Router();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

// ─── Idempotent schema migrations ────────────────────────────────────────────
pool.query(`
    CREATE TABLE IF NOT EXISTS pos_bills (
        id               SERIAL PRIMARY KEY,
        bill_number      VARCHAR(30) UNIQUE NOT NULL,
        customer_name    VARCHAR(150),
        customer_phone   VARCHAR(30),
        subtotal         NUMERIC(12,2) NOT NULL,
        discount_pct     NUMERIC(5,2) NOT NULL DEFAULT 0,
        discount_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
        total            NUMERIC(12,2) NOT NULL,
        payment_method   VARCHAR(30) DEFAULT 'cash',
        notes            TEXT,
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`).catch(e => console.error('[pos_bills] pos_bills migration failed:', e.message));

pool.query(`
    CREATE TABLE IF NOT EXISTS pos_bill_items (
        id          SERIAL PRIMARY KEY,
        bill_id     INT REFERENCES pos_bills(id) ON DELETE CASCADE,
        item_name   VARCHAR(200) NOT NULL,
        qty         NUMERIC(10,2) NOT NULL DEFAULT 1,
        unit_price  NUMERIC(12,2) NOT NULL,
        line_total  NUMERIC(12,2) NOT NULL
    )
`).catch(e => console.error('[pos_bills] pos_bill_items migration failed:', e.message));

// Bill ids are whole numbers; anything else is simply "not found" (not a database error).
router.param('id', (req, res, next, id) => /^\d+$/.test(id) ? next() : res.status(404).json({ error: 'not found' }));

// Sequential per day (BHT-YYYYMMDD-0001, -0002 ...). Must run inside the bill's transaction:
// the advisory lock stops two cashiers being handed the same number. (The old random 4-digit
// suffix collided against the UNIQUE constraint after ~100 bills in a day and failed the sale.)
async function nextBillNumber(client) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const prefix = `BHT-${y}${m}${d}-`;
    await client.query('SELECT pg_advisory_xact_lock(774413)');
    const r = await client.query(
        `SELECT COALESCE(MAX(SUBSTRING(bill_number FROM '-([0-9]+)$')::int), 0) + 1 AS n FROM pos_bills WHERE bill_number LIKE $1`,
        [prefix + '%']);
    return prefix + String(r.rows[0].n).padStart(4, '0');
}

// Round to 2 decimals (money). Adding Number.EPSILON stops 1.005 -> 1.00.
const money2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

async function loadBill(id) {
    const bill = await pool.query(`SELECT * FROM pos_bills WHERE id = $1`, [id]);
    if (!bill.rows.length) return null;
    const items = await pool.query(
        `SELECT id, item_name, qty, unit_price, line_total FROM pos_bill_items WHERE bill_id = $1 ORDER BY id`,
        [id]
    );
    return { ...bill.rows[0], items: items.rows };
}

// ═══════════════════════ CREATE a bill ═══════════════════════
// body: { customer_name, customer_phone, items:[{item_name, qty, unit_price}], discount_pct, payment_method, notes }
router.post('/pos-bills', async (req, res) => {
    const client = await pool.connect();
    try {
        const { customer_name, customer_phone, items, discount_pct, payment_method, notes } = req.body;
        if (!Array.isArray(items) || !items.length) {
            return res.status(400).json({ error: 'items (non-empty array) is required' });
        }
        if (items.length > 100) return res.status(400).json({ error: 'a bill can have at most 100 items' });
        const lines = [];
        for (const [i, it] of items.entries()) {
            if (!it || !String(it.item_name || '').trim() || it.qty === undefined || it.unit_price === undefined) {
                return res.status(400).json({ error: `item ${i + 1}: item_name, qty and unit_price are required` });
            }
            const item_name = String(it.item_name).trim();
            if (item_name.length > 200) return res.status(400).json({ error: `item ${i + 1}: item_name is too long (max 200 characters)` });
            const q = Number(it.qty), pr = Number(it.unit_price);
            if (!Number.isFinite(q) || q <= 0) return res.status(400).json({ error: `item ${i + 1} (${item_name}): qty must be a number greater than 0` });
            if (!Number.isFinite(pr) || pr < 0) return res.status(400).json({ error: `item ${i + 1} (${item_name}): unit_price must be a number, 0 or more` });
            if (q > 99999999 || pr > 9999999999) return res.status(400).json({ error: `item ${i + 1} (${item_name}): qty or unit_price is too large` });
            // Stored to 2 decimals, so price the line on the stored values: what prints is what adds up.
            const qty = money2(q), unit_price = money2(pr);
            lines.push({ item_name, qty, unit_price, line_total: money2(qty * unit_price) });
        }
        // Subtotal is the sum of the printed line totals (summing unrounded products drifted by cents).
        const subtotal = money2(lines.reduce((sum, l) => sum + l.line_total, 0));
        const pct = Number(discount_pct) || 0;
        if (pct < 0 || pct > 100) return res.status(400).json({ error: 'discount_pct must be between 0 and 100' });
        if (subtotal <= 0) return res.status(400).json({ error: 'the bill total must be more than 0' });
        if (String(customer_name || '').length > 150) return res.status(400).json({ error: 'customer_name is too long (max 150 characters)' });
        if (String(customer_phone || '').length > 30) return res.status(400).json({ error: 'customer_phone is too long (max 30 characters)' });
        const discount_amount = money2(subtotal * pct / 100);
        const total = money2(subtotal - discount_amount);

        await client.query('BEGIN');
        const billNumber = await nextBillNumber(client);
        const billRes = await client.query(`
            INSERT INTO pos_bills (bill_number, customer_name, customer_phone, subtotal, discount_pct, discount_amount, total, payment_method, notes)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING id
        `, [billNumber, customer_name || null, customer_phone || null, subtotal, pct, discount_amount, total, payment_method || 'cash', notes || null]);
        const billId = billRes.rows[0].id;

        for (const l of lines) {
            await client.query(`
                INSERT INTO pos_bill_items (bill_id, item_name, qty, unit_price, line_total)
                VALUES ($1,$2,$3,$4,$5)
            `, [billId, l.item_name, l.qty, l.unit_price, l.line_total]);
        }
        await client.query('COMMIT');

        // A bill with a phone gets its customer matched/created now (best effort — never fails the sale).
        if (customer_phone) {
            try { await require('./invoice_receipts').attachCustomer(billId); }
            catch (e) { console.warn('[pos_bills] customer link skipped:', e.message); }
        }

        const full = await loadBill(billId);
        res.json(full);
    } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        res.status(500).json({ error: `Could not save the bill: ${e.message}` });
    } finally {
        client.release();
    }
});

// ═══════════════════════ LIST bills ═══════════════════════
router.get('/pos-bills', async (req, res) => {
    try {
        const r = await pool.query(`SELECT * FROM pos_bills ORDER BY created_at DESC LIMIT 200`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ GET one bill + items ═══════════════════════
router.get('/pos-bills/:id', async (req, res) => {
    try {
        const full = await loadBill(req.params.id);
        if (!full) return res.status(404).json({ error: 'not found' });
        res.json(full);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ DOWNLOAD bill as PDF ═══════════════════════
router.get('/pos-bills/:id/pdf', async (req, res) => {
    try {
        const bill = await loadBill(req.params.id);
        if (!bill) return res.status(404).json({ error: 'not found' });

        let branding = { company_name: 'Bath Hub Thihariya', tagline: '', currency_symbol: 'Rs' };
        try {
            const fs = require('fs');
            const path = require('path');
            branding = { ...branding, ...JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'active.branding.json'), 'utf8')) };
        } catch { /* fall back to defaults above */ }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${bill.bill_number}.pdf"`);

        const PAGE_W = 227;
        const MARGIN = 16;
        const CONTENT_W = PAGE_W - MARGIN * 2;
        const doc = new PDFDocument({ size: [PAGE_W, 500], margin: MARGIN }); // ~80mm receipt width
        doc.pipe(res);

        // doc.circle/path draw calls do NOT move doc.y (the text cursor) — every
        // y coordinate below is tracked explicitly so vector art and text never overlap.
        let y = MARGIN;

        // ── Logo (drawn as vectors — no raster asset needed) ──
        const cx = PAGE_W / 2;
        const logoTop = y;
        doc.circle(cx, logoTop + 22, 22).fillAndStroke('#0a4531', '#d4af37');
        doc.save();
        doc.lineWidth(2.2).strokeColor('#e8cf7a')
            .moveTo(cx - 12, logoTop + 14).lineTo(cx - 2, logoTop + 14)
            .quadraticCurveTo(cx + 4, logoTop + 14, cx + 4, logoTop + 20)
            .lineTo(cx + 4, logoTop + 24).stroke();
        doc.circle(cx - 12, logoTop + 14, 2).fill('#e8cf7a');
        doc.circle(cx, logoTop + 30, 6).fill('#c9a227');
        doc.restore();
        y = logoTop + 44 + 8; // logo bottom (44px tall) + gap before the shop name

        doc.font('Helvetica-Bold').fontSize(13).fillColor('#0a4531')
            .text(branding.company_name || 'Bath Hub Thihariya', MARGIN, y, { width: CONTENT_W, align: 'center' });
        y = doc.y + 2;
        if (branding.tagline) {
            doc.font('Helvetica').fontSize(7).fillColor('#5c4033')
                .text(branding.tagline, MARGIN, y, { width: CONTENT_W, align: 'center' });
            y = doc.y;
        }
        y += 6;
        doc.strokeColor('#c9a227').lineWidth(0.75).moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).stroke();
        y += 8;

        doc.font('Helvetica').fontSize(8).fillColor('#000');
        doc.text(`Bill No: ${bill.bill_number}`, MARGIN, y, { width: CONTENT_W }); y = doc.y + 1;
        doc.text(`Date: ${new Date(bill.created_at).toLocaleString('en-LK')}`, MARGIN, y, { width: CONTENT_W }); y = doc.y + 1;
        if (bill.customer_name) { doc.text(`Customer: ${bill.customer_name}`, MARGIN, y, { width: CONTENT_W }); y = doc.y + 1; }
        if (bill.customer_phone) { doc.text(`Phone: ${bill.customer_phone}`, MARGIN, y, { width: CONTENT_W }); y = doc.y + 1; }
        y += 6;
        doc.strokeColor('#ccc').lineWidth(0.5).moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).stroke();
        y += 8;

        // ── Item table: explicit per-column x positions (no `continued` chaining —
        // it does not reliably advance the cursor between independently-widthed calls) ──
        const COL_NAME_X = MARGIN, COL_NAME_W = 110;
        const COL_QTY_X = MARGIN + 112, COL_QTY_W = 26;
        const COL_AMT_X = MARGIN + 112 + 28, COL_AMT_W = PAGE_W - MARGIN - (MARGIN + 112 + 28);

        function drawRow(name, qty, amount, opts = {}) {
            const rowFont = opts.bold ? 'Helvetica-Bold' : 'Helvetica';
            doc.font(rowFont).fontSize(8);
            const nameHeight = doc.heightOfString(name, { width: COL_NAME_W });
            doc.text(name, COL_NAME_X, y, { width: COL_NAME_W });
            doc.text(qty, COL_QTY_X, y, { width: COL_QTY_W, align: 'right' });
            doc.text(amount, COL_AMT_X, y, { width: COL_AMT_W, align: 'right' });
            y += Math.max(nameHeight, 10) + 2;
        }

        const sym = branding.currency_symbol || 'Rs';
        drawRow('Item', 'Qty', 'Amount', { bold: true });
        y += 2;
        for (const it of bill.items) {
            drawRow(it.item_name, String(it.qty), `${sym} ${Number(it.line_total).toFixed(2)}`);
        }
        y += 4;
        doc.strokeColor('#ccc').lineWidth(0.5).moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).stroke();
        y += 8;

        doc.font('Helvetica').fontSize(8.5).fillColor('#000')
            .text(`Subtotal: ${sym} ${Number(bill.subtotal).toFixed(2)}`, MARGIN, y, { width: CONTENT_W, align: 'right' });
        y = doc.y + 2;
        if (Number(bill.discount_amount) > 0) {
            doc.fillColor('#8b6f47')
                .text(`Discount (${Number(bill.discount_pct)}%): -${sym} ${Number(bill.discount_amount).toFixed(2)}`, MARGIN, y, { width: CONTENT_W, align: 'right' })
                .fillColor('#000');
            y = doc.y + 2;
        }
        doc.font('Helvetica-Bold').fontSize(11)
            .text(`Total: ${sym} ${Number(bill.total).toFixed(2)}`, MARGIN, y, { width: CONTENT_W, align: 'right' });
        y = doc.y + 2;
        doc.font('Helvetica').fontSize(8)
            .text(`Payment: ${(bill.payment_method || 'cash').toUpperCase()}`, MARGIN, y, { width: CONTENT_W, align: 'right' });
        y = doc.y + 14;

        doc.fontSize(7).fillColor('#5c4033')
            .text('Thank you for shopping with us!', MARGIN, y, { width: CONTENT_W, align: 'center' });

        doc.end();
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
