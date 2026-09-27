// routes/invoice_receipts.js
// WHATSAPP RECEIPTS for Bath Hub Thihariya: attach a customer phone to a saved invoice
// and send that customer a designed receipt image over the existing WhatsApp bridge.
//
// - daily_reports (the invoice table) is golden core and is NOT altered. The phone/customer
//   link and send status live in our own table, invoice_receipts.
// - Customers: the phone is matched against the existing `customers` table (any stored
//   format: 0771234567 / 94771234567 / +94 77 123 4567); if there is no match a new
//   walk_in customer row is created (existing columns only).
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

// ─── Invoice lookup (read-only on daily_reports) ─────────────────────────────
async function findInvoice({ report_id, report_date, invoice_no }) {
    let r;
    if (report_id) r = await pool.query(`SELECT * FROM daily_reports WHERE id = $1`, [report_id]).catch(() => null);
    if (!r || !r.rows.length) {
        if (!report_date) throw httpError(400, 'report_date is required');
        r = invoice_no
            ? await pool.query(`SELECT * FROM daily_reports WHERE report_date = $1 AND invoice_no = $2 ORDER BY created_at DESC LIMIT 1`, [report_date, invoice_no])
            : null;
    }
    if (!r || !r.rows.length) throw httpError(404, 'That invoice was not found — save the invoice first');
    return r.rows[0];
}

// ─── Receipt rendering ───────────────────────────────────────────────────────
const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const lkr = n => 'LKR ' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const shopName = () => process.env.SHOP_NAME || 'Bath Hub Thihariya';

function receiptData(inv, rec) {
    const methods = [['Cash', inv.cash_amount], ['Card', inv.card_amount], ['Online', inv.online_amount],
                     ['Credit', inv.credit_amount], ['Cheque', inv.cheque_amount]]
        .filter(([, v]) => Number(v) > 0);
    const d = inv.report_date instanceof Date ? inv.report_date.toISOString().slice(0, 10) : String(inv.report_date).slice(0, 10);
    return {
        shop: shopName(), invoice_no: inv.invoice_no || '—', date: d,
        customer: rec.customer_name || '', phone: rec.customer_phone,
        total: Number(inv.total_sale) || 0, is_refund: !!inv.is_refund, notes: inv.notes || '', methods,
    };
}

function receiptHtml(r) {
    const logo = fs.existsSync(LOGO_PATH)
        ? `<img src="data:image/png;base64,${fs.readFileSync(LOGO_PATH).toString('base64')}" style="max-width:100%;max-height:100%">` : '';
    const rows = r.methods.map(([m, v]) => `<div class="row"><span>${m}</span><span>${lkr(v)}</span></div>`).join('');
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
      .row{display:flex;justify-content:space-between;font-size:14px;padding:4px 0}
      .total{display:flex;justify-content:space-between;align-items:baseline;background:#f7f4ec;border-radius:6px;padding:12px 14px;margin-top:6px}
      .total span:first-child{font-size:13px;color:#5c4033;text-transform:uppercase;letter-spacing:1px}
      .total span:last-child{font-size:24px;font-weight:700;color:#062e21}
      .refund{display:inline-block;background:#fdeaea;color:#b42318;font-weight:700;font-size:12px;padding:3px 10px;border-radius:99px;margin-top:8px}
      .notes{font-size:12px;color:#5c4033;margin-top:10px}
      .thanks{text-align:center;padding:4px 24px 22px;font-size:13px;color:#5c4033}
    </style></head><body><div class="card">
      <div class="head"><div class="logo">${logo}</div><div class="shop">${esc(r.shop)}</div><div class="tag">${r.is_refund ? 'Refund receipt' : 'Receipt'}</div></div>
      <div class="body">
        <div class="meta"><span>Invoice</span><b>${esc(r.invoice_no)}</b></div>
        <div class="meta"><span>Date</span><b>${esc(r.date)}</b></div>
        ${r.customer ? `<div class="meta"><span>Customer</span><b>${esc(r.customer)}</b></div>` : ''}
        <div class="meta"><span>Phone</span><b>${esc(r.phone)}</b></div>
        <hr>
        ${rows || '<div class="row"><span>Payment</span><span>—</span></div>'}
        <div class="total"><span>${r.is_refund ? 'Refunded' : 'Total'}</span><span>${lkr(r.total)}</span></div>
        ${r.is_refund ? '<div class="refund">REFUND</div>' : ''}
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
        const doc = new PDFDocument({ size: [300, 480], margin: 20 });
        const chunks = [];
        doc.on('data', c => chunks.push(c)).on('end', () => resolve(Buffer.concat(chunks))).on('error', reject);
        doc.rect(0, 0, 300, 70).fill('#062e21');
        doc.fillColor('#f7f4ec').fontSize(17).text(r.shop, 20, 22, { align: 'center', width: 260 });
        doc.fillColor('#c9a227').fontSize(9).text(r.is_refund ? 'REFUND RECEIPT' : 'RECEIPT', { align: 'center', width: 260 });
        doc.fillColor('#201c16').fontSize(10).moveDown(2);
        const line = (a, b) => { const y = doc.y; doc.text(a, 20, y, { width: 130 }); doc.text(b, 150, y, { width: 130, align: 'right' }); doc.moveDown(0.4); };
        doc.y = 90;
        line('Invoice', r.invoice_no); line('Date', r.date);
        if (r.customer) line('Customer', r.customer);
        line('Phone', r.phone); doc.moveDown(0.5);
        r.methods.forEach(([m, v]) => line(m, lkr(v)));
        doc.moveDown(0.5).fontSize(14).fillColor('#062e21');
        const y = doc.y; doc.text(r.is_refund ? 'Refunded' : 'Total', 20, y, { width: 110 }); doc.text(lkr(r.total), 130, y, { width: 150, align: 'right' });
        if (r.notes) doc.moveDown(1).fontSize(9).fillColor('#5c4033').text(r.notes, 20, doc.y, { width: 260 });
        doc.moveDown(2).fontSize(10).fillColor('#5c4033').text('Thank you for shopping with us!', 20, doc.y, { align: 'center', width: 260 });
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
async function linkInvoice(body, phoneRaw) {
    const inv = await findInvoice(body);
    const phone = normalizePhone(phoneRaw);
    const name = String(body.customer_name || '').trim() || null;
    const cust = await matchOrCreateCustomer(phone, name);
    const invoiceNo = inv.invoice_no || null;
    const existing = await pool.query(
        inv.id != null
            ? `SELECT id FROM invoice_receipts WHERE report_id = $1`
            : `SELECT id FROM invoice_receipts WHERE report_date = $1 AND invoice_no = $2`,
        inv.id != null ? [inv.id] : [inv.report_date, invoiceNo]);
    let rec;
    if (existing.rows.length) {
        rec = (await pool.query(
            `UPDATE invoice_receipts SET customer_id=$1, customer_name=$2, customer_phone=$3, updated_at=NOW() WHERE id=$4 RETURNING *`,
            [cust.id, cust.name, phone, existing.rows[0].id])).rows[0];
    } else {
        rec = (await pool.query(
            `INSERT INTO invoice_receipts (report_id, report_date, invoice_no, customer_id, customer_name, customer_phone)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [inv.id ?? null, inv.report_date, invoiceNo, cust.id, cust.name, phone])).rows[0];
    }
    return { inv, rec, customer_created: cust.created };
}

const fail = (res, e, what) => res.status(e.status || 500).json({ error: e.status ? e.message : `${what}: ${e.message}` });

// Attach a customer phone to an invoice (matches/creates the customer).
router.post('/invoice-receipts/link', async (req, res) => {
    try {
        const { rec, customer_created } = await linkInvoice(req.body || {}, (req.body || {}).customer_phone);
        res.status(201).json({ ...rec, customer_created });
    } catch (e) { fail(res, e, 'Could not link the customer to the invoice'); }
});

// Links for one day (so the invoice list can show the phone + send status).
router.get('/invoice-receipts', async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) return res.status(400).json({ error: 'date is required' });
        const r = await pool.query(
            `SELECT id, report_id, invoice_no, customer_name, customer_phone, status, last_error,
                    TO_CHAR(sent_at,'YYYY-MM-DD HH24:MI') AS sent_at
             FROM invoice_receipts WHERE report_date = $1 ORDER BY id DESC`, [date]);
        res.json(r.rows);
    } catch (e) { fail(res, e, 'Could not load receipt links'); }
});

// Preview the receipt image without sending anything.
router.get('/invoice-receipts/preview', async (req, res) => {
    try {
        const inv = await findInvoice({ report_id: req.query.report_id, report_date: req.query.date, invoice_no: req.query.invoice_no });
        const rec = { customer_name: req.query.customer_name || '', customer_phone: req.query.phone || '' };
        const out = await renderReceipt(receiptData(inv, rec));
        res.type(out.mimetype).send(out.buffer);
    } catch (e) { fail(res, e, 'Could not build the receipt preview'); }
});

// Link (if a phone is supplied), render, send over the bridge, record the outcome.
router.post('/invoice-receipts/send', async (req, res) => {
    let rec;
    try {
        const body = req.body || {};
        let inv, customer_created = false;
        if (body.customer_phone) {
            ({ inv, rec, customer_created } = await linkInvoice(body, body.customer_phone));
        } else {
            inv = await findInvoice(body);
            const q = await pool.query(
                inv.id != null ? `SELECT * FROM invoice_receipts WHERE report_id = $1`
                               : `SELECT * FROM invoice_receipts WHERE report_date = $1 AND invoice_no = $2`,
                inv.id != null ? [inv.id] : [inv.report_date, inv.invoice_no || null]);
            if (!q.rows.length) throw httpError(400, 'No customer phone is attached to this invoice — enter one');
            rec = q.rows[0];
        }

        const data = receiptData(inv, rec);
        const out = await renderReceipt(data);
        const caption = `${data.shop}\n${data.is_refund ? 'Refund receipt' : 'Receipt'} — invoice ${data.invoice_no}\nTotal: ${lkr(data.total)}\nThank you for shopping with us!`;

        const bridgeUrl = process.env.WHATSAPP_API_URL || 'http://localhost:3001/send';
        try {
            await axios.post(bridgeUrl, {
                to: rec.customer_phone, message: caption,
                media: { data: out.buffer.toString('base64'), mimetype: out.mimetype, filename: `receipt-${String(data.invoice_no).replace(/[^\w-]/g, '_')}.${out.ext}` },
            }, { timeout: 30000, maxBodyLength: Infinity });
        } catch (e) {
            const detail = e.response?.data?.error || e.message;
            const err = httpError(502, e.response
                ? `WhatsApp bridge refused the receipt: ${detail}`
                : `WhatsApp bridge is not reachable (${detail}) — the receipt was not sent`);
            throw err;
        }
        await pool.query(`UPDATE invoice_receipts SET status='sent', last_error=NULL, sent_at=NOW(), updated_at=NOW() WHERE id=$1`, [rec.id]);
        res.json({ sent: true, to: rec.customer_phone, format: out.ext, invoice_no: data.invoice_no, customer_created });
    } catch (e) {
        if (rec) await pool.query(`UPDATE invoice_receipts SET status='failed', last_error=$1, updated_at=NOW() WHERE id=$2`, [e.message, rec.id]).catch(() => {});
        fail(res, e, 'Could not send the receipt');
    }
});

module.exports = router;
module.exports.normalizePhone = normalizePhone;
