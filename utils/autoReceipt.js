'use strict';
// Automatic receipt after a sale. ONE isolated module: puts the bill's receipt in receipt_queue, and ONLY when
// BOTH WHATSAPP_LIVE=true and WHATSAPP_AUTO_SEND=true are in .env (default: off) draws the picture and calls the
// existing sender (utils/whatsappReceiptSender.js). Runs in the background after the sale is saved:
// it never throws, never waits for WhatsApp, and can never stop a sale from saving.
const path = require('path');
const receiptImage = require('./receiptImage');
const sender = require('./whatsappReceiptSender');

const flag = v => String(v || '').toLowerCase() === 'true';
const autoSendOn = (env = process.env) => flag(env.WHATSAPP_LIVE) && flag(env.WHATSAPP_AUTO_SEND);

let ready = false;   // tables are checked once per process
async function ensureTables(pool) {
    if (ready) return;
    await pool.query(`CREATE TABLE IF NOT EXISTS receipt_queue (
        id SERIAL PRIMARY KEY, customer_phone VARCHAR(30) NOT NULL, sale_reference TEXT, amount NUMERIC(12,2),
        status VARCHAR(20) NOT NULL DEFAULT 'queued', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, sent_at TIMESTAMP)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS receipt_images (
        id SERIAL PRIMARY KEY, queue_id INT NOT NULL REFERENCES receipt_queue(id), bill_no VARCHAR(30), file_name VARCHAR(120) NOT NULL,
        width INT, height INT, bytes INT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    ready = true;
}

// bill = a saved POS bill with its items (as pos_bills loadBill returns it). Returns { status } and never throws.
async function queueReceiptForBill(pool, bill, opts = {}) {
    const env = opts.env || process.env;
    try {
        await ensureTables(pool);
        const ref = String(bill.bill_number);
        // once per bill: a receipt for this bill is already in the queue
        const have = await pool.query(`SELECT id FROM receipt_queue WHERE sale_reference = $1 LIMIT 1`, [ref]);
        if (have.rows.length) return { status: 'already_queued', queue_id: have.rows[0].id };

        const phone = sender.normalizeSriLankaPhone(bill.customer_phone);
        const ins = await pool.query(
            `INSERT INTO receipt_queue (customer_phone, sale_reference, amount, status) VALUES ($1,$2,$3,$4) RETURNING id`,
            [String(bill.customer_phone || '').slice(0, 30), ref, Number(bill.total) || null, phone ? 'queued' : 'no phone']);
        const id = ins.rows[0].id;
        if (!phone) return { status: 'no phone', queue_id: id };           // never guess a number
        if (!autoSendOn(env)) return { status: 'queued', queue_id: id };    // flags off: queue only

        const draw = opts.render || receiptImage.renderReceiptPng;
        let png;
        try {
            png = await draw({
                billNo: ref, customer: bill.customer_name || '', discount: Number(bill.discount_amount) || 0,
                date: new Date(bill.created_at || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                items: (bill.items || []).map(i => ({ name: i.item_name, qty: Number(i.qty), price: Number(i.unit_price) })),
            }, opts.dir ? { outDir: opts.dir } : {});
        } catch (e) { console.warn('[auto-receipt] picture not drawn:', e.message); return { status: 'queued', queue_id: id }; }
        await pool.query(`INSERT INTO receipt_images (queue_id, bill_no, file_name, width, height, bytes) VALUES ($1,$2,$3,$4,$5,$6)`,
            [id, ref.slice(0, 30), path.basename(png.file), png.width || null, png.height || null, png.bytes || null]);
        const r = await sender.sendReceiptForQueueItem(pool, id, opts);
        return { ...r, queue_id: id };
    } catch (e) {
        console.warn('[auto-receipt] skipped:', e.message);
        return { status: 'error', reason: e.message };
    }
}

// Called by the POS right AFTER the answer is sent. Fire and forget.
function afterSale(pool, bill) {
    try {
        setImmediate(() => {
            try { Promise.resolve(module.exports.queueReceiptForBill(pool, bill)).catch(e => console.warn('[auto-receipt] skipped:', e.message)); }
            catch (e) { console.warn('[auto-receipt] skipped:', e.message); }
        });
    } catch (e) { console.warn('[auto-receipt] skipped:', e.message); }
}

module.exports = { autoSendOn, queueReceiptForBill, afterSale };