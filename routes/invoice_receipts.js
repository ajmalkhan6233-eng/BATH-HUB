// routes/invoice_receipts.js
// WHATSAPP RECEIPTS for Bath Hub Thihariya: send a customer a designed receipt image for a
// POS bill (pos_bills / pos_bill_items — the POS Billing screen, where sales are entered)
// over the existing WhatsApp bridge.
//
// - pos_bills is read-only here. The phone/customer link and send status live in our own
//   table, invoice_receipts (bill_id -> customer, status).
// - Customers: the phone is matched against the existing `customers` table (any stored
//   format: 0771234567 / 94771234567 / +94 77 123 4567); if there is no match a new
//   walk_in customer row is created (existing columns only). pos_bills.js calls
//   attachCustomer() right after a bill with a phone is saved.
// - Receipt image: HTML -> PNG with headless Chrome (puppeteer-core, its own throw-away
//   profile — it never touches the bridge's WhatsApp session). If Chrome or puppeteer is
//   unavailable it falls back to a pdfkit PDF, sent as a document.
// - Sending: POST to the existing bridge /send (WHATSAPP_API_URL, default
//   http://localhost:3001/send) with the image as base64 media + a text caption. This
//   module never starts the bridge.
// - Logo: drop public/receipt-logo.png in place and it appears in the empty slot at the
//   top of the receipt. Shop name comes from SHOP_NAME (default "Bath Hub Thihariya").

require('dotenv').config();
const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');
const { Pool } = require('pg');

const router = express.Router();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

const LOGO_PATH = path.join(__dirname, '..', 'public', 'receipt-logo.png');
const CHROME_CANDIDATES = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean);

pool.query(`
    CREATE TABLE IF NOT EXISTS invoice_receipts (
        id             SERIAL PRIMARY KEY,
        report_id      INT,
        report_date    DATE NOT NULL,
        invoice_no     VARCHAR(100),
        customer_id    INT,
        customer_name  VARCHAR(200),
        customer_phone VARCHAR(30) NOT NULL,
        status         VARCHAR(20) NOT NULL DEFAULT 'not_sent',   -- not_sent / sent / failed
        last_error     TEXT,
        sent_at        TIMESTAMP,
        created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`).then(() => pool.query(`CREATE INDEX IF NOT EXISTS idx_invoice_receipts_date ON invoice_receipts (report_date)`))
  .then(() => pool.query(`ALTER TABLE invoice_receipts ADD COLUMN IF NOT EXISTS bill_id INT`))
  .then(() => pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_receipts_bill ON invoice_receipts (bill_id) WHERE bill_id IS NOT NULL`))
  .catch(e => console.error('[invoice_receipts] migration failed:', e.message));

function httpError(status, msg) { const e = new Error(msg); e.status = status; return e; }

// ─── Phone handling ──────────────────────────────────────────────────────────
// Returns digits in international form (Sri Lanka default): 94771234567.
function normalizePhone(raw) {
    let d = String(raw || '').replace(/\D/g, '');
    if (!d) throw httpError(400, 'Enter the customer phone number');
    if (d.startsWith('00')) d = d.slice(2);
    if (d.length === 10 && d.startsWith('0')) d = '94' + d.slice(1);     // 0771234567
    else if (d.length === 9 && d.startsWith('7')) d = '94' + d;          // 771234567
    if (d.length < 10 || d.length > 15) throw httpError(400, `"${raw}" is not a valid phone number (use e.g. 0771234567)`);
    return d;
}

// Find the customer by phone in any stored format, else create a walk-in customer.
async function matchOrCreateCustomer(phone, name) {
    const local = phone.startsWith('94') ? '0' + phone.slice(2) : phone;
    const found = await pool.query(
        `SELECT id, name, phone FROM customers
         WHERE regexp_replace(COALESCE(phone,''), '\\D', '', 'g') IN ($1, $2)
            OR regexp_replace(COALESCE(whatsapp,''), '\\D', '', 'g') IN ($1, $2)
         ORDER BY id LIMIT 1`, [phone, local]);
    if (found.rows.length) {
        const c = found.rows[0];
        if (!c.name && name) await pool.query(`UPDATE customers SET name = $1 WHERE id = $2`, [name, c.id]);
        return { id: c.id, name: c.name || name || null, created: false };
    }
    const ins = await pool.query(
        `INSERT INTO customers (name, phone, whatsapp, source) VALUES ($1,$2,$2,'walk_in') RETURNING id`,
        [name || null, phone]);
    return { id: ins.rows[0].id, name: name || null, created: true };
}

// ─── Bill lookup (read-only on pos_bills / pos_bill_items) ───────────────────
async function findBill({ bill_id, bill_number }) {
    let r;
    if (bill_id !== undefined && bill_id !== null && bill_id !== '') {
        if (!Number.isInteger(Number(bill_id))) throw httpError(400, 'bill_id must be a number');
        r = await pool.query(`SELECT * FROM pos_bills WHERE id = $1`, [bill_id]);
    } else if (bill_number) {
        r = await pool.query(`SELECT * FROM pos_bills WHERE bill_number = $1`, [bill_number]);
    } else {
        throw httpError(400, 'bill_id is required');
    }
    if (!r.rows.length) throw httpError(404, 'That bill was not found — generate the bill first');
    const bill = r.rows[0];
    bill.items = (await pool.query(`SELECT item_name, qty, unit_price, line_total FROM pos_bill_items WHERE bill_id = $1 ORDER BY id`, [bill.id])).rows;
    return bill;
}

// ─── Receipt rendering ───────────────────────────────────────────────────────
const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const lkr = n => { const v = Number(n || 0); const f = Number.isInteger(v) ? 0 : 2; return 'LKR ' + v.toLocaleString('en-US', { minimumFractionDigits: f, maximumFractionDigits: f }); };
const shopName = () => process.env.SHOP_NAME || 'Bath Hub Thihariya';

function receiptData(bill, rec) {
    const d = bill.created_at instanceof Date ? bill.created_at : new Date(bill.created_at);
    const pad = n => String(n).padStart(2, '0');
    return {
        shop: shopName(), bill_no: bill.bill_number,
        date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        customer: rec.customer_name || bill.customer_name || '', phone: rec.customer_phone,
        items: (bill.items || []).map(i => ({ name: i.item_name, qty: Number(i.qty), total: Number(i.line_total) })),
        subtotal: Number(bill.subtotal) || 0, discount_pct: Number(bill.discount_pct) || 0,
        discount: Number(bill.discount_amount) || 0, total: Number(bill.total) || 0,
        payment: String(bill.payment_method || 'cash'), notes: bill.notes || '',
    };
}

function receiptHtml(r) {
    const logo = fs.existsSync(LOGO_PATH)
        ? `<img src="data:image/png;base64,${fs.readFileSync(LOGO_PATH).toString('base64')}" style="max-width:100%;max-height:100%">` : '';
    const rows = r.items.map(i => `<div class="row"><span>${esc(i.name)} × ${i.qty}</span><span>${lkr(i.total)}</span></div>`).join('');
    return `<!doctype html><html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{width:420px;background:#f7f4ec;font-family:'Segoe UI',Arial,sans-serif;color:#201c16}
      .card{margin:0;background:#fff;border-top:10px solid #062e21}
      .head{background:#062e21;color:#f7f4ec;text-align:center;padding:22px 20px 20px}
      .logo{width:72px;height:72px;margin:0 auto 10px;display:flex;align-items:center;justify-content:center}
      .shop{font-size:22px;font-weight:700;letter-spacing:.5px}
      .tag{margin-top:4px;color:#c9a227;font-size:12px;letter-spacing:3px;text-transform:uppercase}
      .body{padding:20px 24px}
      .meta{display:flex;justify-content:space-between;font-size:13px;color:#5c4033;margin-bottom:4px}
      .meta b{color:#201c16}
      hr{border:0;border-top:1px dashed #d8d0bd;margin:14px 0}
      .row{display:flex;justify-content:space-between;gap:12px;font-size:14px;padding:4px 0}
      .row span:first-child{flex:1}
      .disc{color:#5c4033}
      .total{display:flex;justify-content:space-between;align-items:baseline;background:#f7f4ec;border-radius:6px;padding:12px 14px;margin-top:8px}
      .total span:first-child{font-size:13px;color:#5c4033;text-transform:uppercase;letter-spacing:1px}
      .total span:last-child{font-size:24px;font-weight:700;color:#062e21}
      .notes{font-size:12px;color:#5c4033;margin-top:10px}
      .thanks{text-align:center;padding:4px 24px 22px;font-size:13px;color:#5c4033}
    </style></head><body><div class="card">
      <div class="head"><div class="logo">${logo}</div><div class="shop">${esc(r.shop)}</div><div class="tag">Receipt</div></div>
      <div class="body">
        <div class="meta"><span>Bill</span><b>${esc(r.bill_no)}</b></div>
        <div class="meta"><span>Date</span><b>${esc(r.date)}</b></div>
        ${r.customer ? `<div class="meta"><span>Customer</span><b>${esc(r.customer)}</b></div>` : ''}
        <div class="meta"><span>Phone</span><b>${esc(r.phone)}</b></div>
        <hr>
        ${rows}
        <hr>
        <div class="row"><span>Subtotal</span><span>${lkr(r.subtotal)}</span></div>
        ${r.discount > 0 ? `<div class="row disc"><span>Discount (${r.discount_pct}%)</span><span>-${lkr(r.discount)}</span></div>` : ''}
        <div class="total"><span>Total</span><span>${lkr(r.total)}</span></div>
        <div class="row"><span>Paid by</span><span>${esc(r.payment.toUpperCase())}</span></div>
        ${r.notes ? `<div class="notes">${esc(r.notes)}</div>` : ''}
      </div>
      <div class="thanks">Thank you for shopping with us!</div>
    </div></body></html>`;
}

async function renderPng(r) {
    const chrome = CHROME_CANDIDATES.find(p => fs.existsSync(p));
    if (!chrome) throw new Error('Chrome not found');
    const puppeteer = require('puppeteer-core');
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'receipt-chrome-'));
    let browser;
    try {
        browser = await puppeteer.launch({
            executablePath: chrome, headless: true, userDataDir: profile,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 420, height: 600, deviceScaleFactor: 2 });
        await page.setContent(receiptHtml(r), { waitUntil: 'load' });
        const h = await page.evaluate(() => document.body.scrollHeight);
        await page.setViewport({ width: 420, height: h, deviceScaleFactor: 2 });
        return Buffer.from(await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 420, height: h } }));
    } finally {
        if (browser) await browser.close().catch(() => {});
        fs.rm(profile, { recursive: true, force: true }, () => {});
    }
}

function renderPdf(r) {
    const PDFDocument = require('pdfkit');
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: [300, 340 + r.items.length * 18], margin: 20 });
        const chunks = [];
        doc.on('data', c => chunks.push(c)).on('end', () => resolve(Buffer.concat(chunks))).on('error', reject);
        doc.rect(0, 0, 300, 70).fill('#062e21');
        doc.fillColor('#f7f4ec').fontSize(17).text(r.shop, 20, 22, { align: 'center', width: 260 });
        doc.fillColor('#c9a227').fontSize(9).text('RECEIPT', { align: 'center', width: 260 });
        doc.fillColor('#201c16').fontSize(10);
        const line = (a, b) => { const y = doc.y; doc.text(a, 20, y, { width: 170 }); doc.text(b, 150, y, { width: 130, align: 'right' }); doc.moveDown(0.4); };
        doc.y = 90;
        line('Bill', r.bill_no); line('Date', r.date);
        if (r.customer) line('Customer', r.customer);
        line('Phone', r.phone); doc.moveDown(0.5);
        r.items.forEach(i => line(`${i.name} x ${i.qty}`, lkr(i.total)));
        doc.moveDown(0.5);
        line('Subtotal', lkr(r.subtotal));
        if (r.discount > 0) line(`Discount (${r.discount_pct}%)`, '-' + lkr(r.discount));
        doc.moveDown(0.3).fontSize(14).fillColor('#062e21');
        const y = doc.y; doc.text('Total', 20, y, { width: 110 }); doc.text(lkr(r.total), 130, y, { width: 150, align: 'right' });
        doc.moveDown(0.6).fontSize(10).fillColor('#201c16'); line('Paid by', r.payment.toUpperCase());
        if (r.notes) doc.moveDown(0.5).fontSize(9).fillColor('#5c4033').text(r.notes, 20, doc.y, { width: 260 });
        doc.moveDown(1.5).fontSize(10).fillColor('#5c4033').text('Thank you for shopping with us!', 20, doc.y, { align: 'center', width: 260 });
        doc.end();
    });
}

// PNG preferred; PDF fallback so a missing Chrome never blocks a receipt.
async function renderReceipt(r) {
    try {
        return { buffer: await renderPng(r), mimetype: 'image/png', ext: 'png' };
    } catch (e) {
        console.warn('[invoice_receipts] PNG render unavailable, using PDF:', e.message);
        return { buffer: await renderPdf(r), mimetype: 'application/pdf', ext: 'pdf' };
    }
}

// ─── Routes ──────────────────────────────────────────────────────────────────
// Match/create the customer for a bill's phone and record the bill -> customer link.
async function linkBill(bill, phoneRaw, nameRaw) {
    const phone = normalizePhone(phoneRaw || bill.customer_phone);
    const name = String(nameRaw || bill.customer_name || '').trim() || null;
    const cust = await matchOrCreateCustomer(phone, name);
    const rec = (await pool.query(`
        INSERT INTO invoice_receipts (bill_id, report_date, invoice_no, customer_id, customer_name, customer_phone)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (bill_id) WHERE bill_id IS NOT NULL DO UPDATE SET
            customer_id = EXCLUDED.customer_id, customer_name = EXCLUDED.customer_name,
            customer_phone = EXCLUDED.customer_phone, updated_at = NOW()
        RETURNING *`,
        [bill.id, new Date(bill.created_at), bill.bill_number, cust.id, cust.name, phone])).rows[0];
    return { rec, customer_created: cust.created };
}

// Called by pos_bills.js right after a bill with a phone is saved (best effort there).
async function attachCustomer(billId) {
    const bill = await findBill({ bill_id: billId });
    if (!bill.customer_phone) return null;
    return linkBill(bill, bill.customer_phone, bill.customer_name);
}

const fail = (res, e, what) => res.status(e.status || 500).json({ error: e.status ? e.message : `${what}: ${e.message}` });

// Attach (or change) the customer phone for a bill.
router.post('/invoice-receipts/link', async (req, res) => {
    try {
        const body = req.body || {};
        const bill = await findBill(body);
        const { rec, customer_created } = await linkBill(bill, body.customer_phone, body.customer_name);
        res.status(201).json({ ...rec, customer_created });
    } catch (e) { fail(res, e, 'Could not link the customer to the bill'); }
});

// Receipt status for one bill (or, with ?date=, every bill's receipt status for that day).
router.get('/invoice-receipts', async (req, res) => {
    try {
        const { bill_id, date } = req.query;
        if (!bill_id && !date) return res.status(400).json({ error: 'bill_id or date is required' });
        const r = bill_id
            ? await pool.query(`SELECT * FROM invoice_receipts WHERE bill_id = $1`, [bill_id])
            : await pool.query(`SELECT * FROM invoice_receipts WHERE bill_id IS NOT NULL AND report_date::date = $1 ORDER BY id DESC`, [date]);
        res.json(r.rows.map(x => ({ id: x.id, bill_id: x.bill_id, bill_number: x.invoice_no, customer_name: x.customer_name,
            customer_phone: x.customer_phone, status: x.status, last_error: x.last_error, sent_at: x.sent_at })));
    } catch (e) { fail(res, e, 'Could not load receipt status'); }
});

// Preview the receipt image without sending anything.
router.get('/invoice-receipts/preview', async (req, res) => {
    try {
        const bill = await findBill({ bill_id: req.query.bill_id, bill_number: req.query.bill_number });
        const rec = { customer_name: req.query.customer_name || '', customer_phone: req.query.phone || bill.customer_phone || '' };
        const out = await renderReceipt(receiptData(bill, rec));
        res.type(out.mimetype).send(out.buffer);
    } catch (e) { fail(res, e, 'Could not build the receipt preview'); }
});

// Link (phone from the request or the bill), render, send over the bridge, record the outcome.
router.post('/invoice-receipts/send', async (req, res) => {
    let rec;
    try {
        const body = req.body || {};
        const bill = await findBill(body);
        let customer_created = false;
        if (body.customer_phone || bill.customer_phone) {
            ({ rec, customer_created } = await linkBill(bill, body.customer_phone, body.customer_name));
        } else {
            const q = await pool.query(`SELECT * FROM invoice_receipts WHERE bill_id = $1`, [bill.id]);
            if (!q.rows.length) throw httpError(400, 'No customer phone is attached to this bill — enter one');
            rec = q.rows[0];
        }

        const data = receiptData(bill, rec);
        const out = await renderReceipt(data);
        const caption = `${data.shop}\nReceipt — bill ${data.bill_no}\nTotal: ${lkr(data.total)}\nThank you for shopping with us!`;

        const bridgeUrl = process.env.WHATSAPP_API_URL || 'http://localhost:3001/send';
        try {
            await axios.post(bridgeUrl, {
                to: rec.customer_phone, message: caption,
                media: { data: out.buffer.toString('base64'), mimetype: out.mimetype, filename: `receipt-${String(data.bill_no).replace(/[^\w-]/g, '_')}.${out.ext}` },
            }, { timeout: 30000, maxBodyLength: Infinity });
        } catch (e) {
            const detail = e.response?.data?.error || e.message;
            throw httpError(502, e.response
                ? `WhatsApp bridge refused the receipt: ${detail}`
                : `WhatsApp bridge is not reachable (${detail}) — the receipt was not sent`);
        }
        await pool.query(`UPDATE invoice_receipts SET status='sent', last_error=NULL, sent_at=NOW(), updated_at=NOW() WHERE id=$1`, [rec.id]);
        res.json({ sent: true, to: rec.customer_phone, format: out.ext, bill_number: data.bill_no, customer_created });
    } catch (e) {
        if (rec) await pool.query(`UPDATE invoice_receipts SET status='failed', last_error=$1, updated_at=NOW() WHERE id=$2`, [e.message, rec.id]).catch(() => {});
        fail(res, e, 'Could not send the receipt');
    }
});

module.exports = router;
module.exports.normalizePhone = normalizePhone;
module.exports.attachCustomer = attachCustomer;
