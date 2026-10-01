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
const { todayLK } = require('../utils/lkTime');

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
`).then(() => pool.query(`
    CREATE TABLE IF NOT EXISTS pos_bill_items (
        id          SERIAL PRIMARY KEY,
        bill_id     INT REFERENCES pos_bills(id) ON DELETE CASCADE,
        item_name   VARCHAR(200) NOT NULL,
        qty         NUMERIC(10,2) NOT NULL DEFAULT 1,
        unit_price  NUMERIC(12,2) NOT NULL,
        line_total  NUMERIC(12,2) NOT NULL
    )`))
  // additive columns: which bills were given a discount above the cap (by the owner), and which catalogue item a line was
  .then(() => pool.query(`ALTER TABLE pos_bills ADD COLUMN IF NOT EXISTS discount_override BOOLEAN NOT NULL DEFAULT FALSE`))
  .then(() => pool.query(`ALTER TABLE pos_bill_items ADD COLUMN IF NOT EXISTS item_code VARCHAR(50)`))
  .catch(e => console.error('[pos_bills] migration failed:', e.message));

// Bill ids are whole numbers; anything else is simply "not found" (not a database error).
router.param('id', (req, res, next, id) => /^\d+$/.test(id) ? next() : res.status(404).json({ error: 'not found' }));

// Sequential per day (BHT-YYYYMMDD-0001, -0002 ...). Must run inside the bill's transaction:
// the advisory lock stops two cashiers being handed the same number. (The old random 4-digit
// suffix collided against the UNIQUE constraint after ~100 bills in a day and failed the sale.)
async function nextBillNumber(client) {
    const prefix = `BHT-${todayLK().replace(/-/g, '')}-`;
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
        `SELECT id, item_name, item_code, qty, unit_price, line_total FROM pos_bill_items WHERE bill_id = $1 ORDER BY id`,
        [id]
    );
    return { ...bill.rows[0], items: items.rows };
}

// ═══════════════════════ DISCOUNT CAP ═══════════════════════
// The cap is the owner's discount rule (Money / Shop settings, table discount_rules): a rule for the user's role wins over the
// rule for "all". No rule means no cap. A bill ABOVE the cap is refused (409) unless the person at the till is the owner/admin
// and confirms (override: true); that is recorded on the bill. Nobody else can go over the cap.
const roleOf = req => (req.session && req.session.user && req.session.user.role) || 'staff';
const canOverride = req => ['admin', 'owner'].includes(roleOf(req));

async function discountCapFor(role) {
    try {
        const r = await pool.query(
            `SELECT max_discount_pct FROM discount_rules WHERE active = true AND role IN ($1, 'all') ORDER BY (role = 'all'), id DESC LIMIT 1`, [role]);
        return r.rows.length ? Number(r.rows[0].max_discount_pct) : null;
    } catch (e) { return null; }                      // no rules table yet: no cap
}

// For the bill page: how much discount may I give, and can I go above it?
router.get('/pos-bills/discount-cap', async (req, res) => {
    res.json({ max_allowed: await discountCapFor(roleOf(req)), can_override: canOverride(req) });
});

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
            const item_code = it.item_code == null || it.item_code === '' ? null : String(it.item_code).trim().slice(0, 50);
            lines.push({ item_name, item_code, qty, unit_price, line_total: money2(qty * unit_price) });
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

        // Discount cap. Refused before anything is saved.
        let override = false;
        const cap = pct > 0 ? await discountCapFor(roleOf(req)) : null;
        if (cap !== null && pct > cap) {
            if (!(canOverride(req) && req.body.override === true)) {
                return res.status(409).json({
                    error: `A ${pct}% discount is more than the allowed ${cap}%` + (canOverride(req) ? '. You can approve it as the owner.' : '. Ask the owner to approve it.'),
                    code: 'discount_over_cap', max_allowed: cap, can_override: canOverride(req),
                });
            }
            override = true;
        }

        const deductStock = String(process.env.POS_DEDUCT_STOCK).toLowerCase() === 'true';
        await client.query('BEGIN');
        const billNumber = await nextBillNumber(client);
        const billRes = await client.query(`
            INSERT INTO pos_bills (bill_number, customer_name, customer_phone, subtotal, discount_pct, discount_amount, total, payment_method, notes, discount_override)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            RETURNING id
        `, [billNumber, customer_name || null, customer_phone || null, subtotal, pct, discount_amount, total, payment_method || 'cash', notes || null, override]);
        const billId = billRes.rows[0].id;

        for (const l of lines) {
            await client.query(`
                INSERT INTO pos_bill_items (bill_id, item_name, item_code, qty, unit_price, line_total)
                VALUES ($1,$2,$3,$4,$5,$6)
            `, [billId, l.item_name, l.item_code, l.qty, l.unit_price, l.line_total]);
            // Optional (POS_DEDUCT_STOCK=true): take catalogue items out of stock in the SAME transaction as the bill.
            // Off by default: if the shop's real stock is kept in another system (Lasersoft), deducting here would count twice.
            if (deductStock && l.item_code) {
                await client.query(`UPDATE products SET stock_level = COALESCE(stock_level, 0) - $1 WHERE item_code = $2 AND active = true`, [l.qty, l.item_code]);
            }
        }
        await client.query('COMMIT');

        // A bill with a phone gets its customer matched/created now (best effort — never fails the sale).
        if (customer_phone) {
            try { await require('./invoice_receipts').attachCustomer(billId); }
            catch (e) { console.warn('[pos_bills] customer link skipped:', e.message); }
        }

        const full = await loadBill(billId);
        res.json({ ...full, stock_deducted: deductStock });
    } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        res.status(500).json({ error: `Could not save the bill: ${e.message}` });
    } finally {
        client.release();
    }
});

// ═══════════════════════ TODAY'S BILLS (Sri Lanka date) ═══════════════════════
router.get('/pos-bills/today', async (req, res) => {
    try {
        const date = todayLK();
        const r = await pool.query(
            `SELECT id, bill_number, customer_name, subtotal, discount_pct, discount_amount, total, payment_method, discount_override, created_at
             FROM pos_bills WHERE created_at::date = $1::date ORDER BY created_at DESC, id DESC LIMIT 200`, [date]);
        const bills = r.rows.map(b => ({ ...b, subtotal: Number(b.subtotal), discount_amount: Number(b.discount_amount), total: Number(b.total) }));
        res.json({
            date, count: bills.length,
            total: money2(bills.reduce((a, b) => a + b.total, 0)),
            discount: money2(bills.reduce((a, b) => a + b.discount_amount, 0)),
            bills,
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ END-OF-DAY SUMMARY ═══════════════════════
// GET /pos-bills/summary?from=YYYY-MM-DD&to=YYYY-MM-DD   (both default to today; one date = that day)
// Totals and a per-payment-method split, for closing the till. Must stay above /pos-bills/:id.
const isDay = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v)) && !isNaN(Date.parse(v));
const todayStr = todayLK;

router.get('/pos-bills/summary', async (req, res) => {
    try {
        const from = String(req.query.from || req.query.date || todayStr());
        const to = String(req.query.to || req.query.date || from);
        if (!isDay(from) || !isDay(to)) return res.status(400).json({ error: 'from and to must be dates (YYYY-MM-DD)' });
        if (to < from) return res.status(400).json({ error: 'to cannot be before from' });
        const r = await pool.query(
            `SELECT COALESCE(payment_method, 'cash') AS payment_method, COUNT(*) AS bills,
                    SUM(subtotal) AS subtotal, SUM(discount_amount) AS discount, SUM(total) AS total
             FROM pos_bills WHERE created_at::date BETWEEN $1::date AND $2::date
             GROUP BY COALESCE(payment_method, 'cash') ORDER BY 1`, [from, to]);
        const by_payment = r.rows.map(x => ({
            payment_method: x.payment_method, bills: Number(x.bills),
            subtotal: money2(x.subtotal), discount: money2(x.discount), total: money2(x.total),
        })).sort((a, b) => a.payment_method.localeCompare(b.payment_method));
        const sum = k => money2(by_payment.reduce((a, x) => a + x[k], 0));
        res.json({
            from, to, bills: by_payment.reduce((a, x) => a + x.bills, 0),
            subtotal: sum('subtotal'), discount: sum('discount'), total: sum('total'), by_payment,
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ LIST bills ═══════════════════════
// ═══════════════════════ BEST SELLERS (from the bills themselves) ═══════════════════════
// GET /pos-bills/top-items?from=&to=&limit=10   Units and revenue per item name, biggest revenue first.
// Revenue is before any bill-level discount. Defaults: the last 30 days. Must stay above /pos-bills/:id.
router.get('/pos-bills/top-items', async (req, res) => {
    try {
        const d = new Date();
        const to = String(req.query.to || todayStr());
        const f = new Date(d.getTime() - 29 * 86400000);
        const from = String(req.query.from || `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`);
        if (!isDay(from) || !isDay(to)) return res.status(400).json({ error: 'from and to must be dates (YYYY-MM-DD)' });
        if (to < from) return res.status(400).json({ error: 'to cannot be before from' });
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
        const r = await pool.query(
            `SELECT i.item_name, SUM(i.qty) AS units, SUM(i.line_total) AS revenue, COUNT(DISTINCT i.bill_id) AS bills
             FROM pos_bill_items i JOIN pos_bills b ON b.id = i.bill_id
             WHERE b.created_at::date BETWEEN $1::date AND $2::date
             GROUP BY i.item_name`, [from, to]);
        const items = r.rows
            .map(x => ({ item_name: x.item_name, units: money2(x.units), revenue: money2(x.revenue), bills: Number(x.bills) }))
            .sort((a, b) => b.revenue - a.revenue || a.item_name.localeCompare(b.item_name))
            .slice(0, limit);
        res.json({ from, to, items });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Optional filters: ?date=YYYY-MM-DD (that day only) and ?q=text (bill number, customer name or phone contains it).
// With no filters it is still the latest 200 bills.
router.get('/pos-bills', async (req, res) => {
    try {
        const date = String(req.query.date || '');
        if (date && !isDay(date)) return res.status(400).json({ error: 'date must be a date (YYYY-MM-DD)' });
        const q = String(req.query.q || '').trim().toLowerCase().replace(/[\\%_]/g, m => '\\' + m);
        const r = await pool.query(
            `SELECT * FROM pos_bills
             WHERE ($1::date IS NULL OR created_at::date = $1::date)
               AND ($2 = '' OR LOWER(bill_number) LIKE '%' || $2 || '%' OR LOWER(COALESCE(customer_name,'')) LIKE '%' || $2 || '%'
                    OR COALESCE(customer_phone,'') LIKE '%' || $2 || '%')
             ORDER BY created_at DESC, id DESC LIMIT 200`, [date || null, q]);
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
