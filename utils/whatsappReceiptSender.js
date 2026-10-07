'use strict';
// Sends the Royal Bath Hub receipt PICTURE to the customer on WhatsApp, using Meta's OFFICIAL WhatsApp Business Cloud API.
// One isolated module: reads a receipt_queue row + its saved PNG (receipt_images), sends, updates the row, logs.
//
// SAFETY (owner's rules):
//  - DRY RUN by default: nothing is sent unless .env has WHATSAPP_LIVE=true (and the keys below exist).
//  - Keys live in .env only:  WHATSAPP_API_TOKEN, WHATSAPP_PHONE_NUMBER_ID,
//    optional WHATSAPP_RECEIPT_TEMPLATE (approved template name, needed for customers outside the 24-hour window).
//  - Sends only to the phone saved on that bill's queue row, once per bill. Never guesses a number.
//  - Logs show bill no, time and result; phone only as the last 3 digits. Tokens are never logged.
//  - A failure never throws into billing: every function returns a result object.
//  - Never starts or talks to whatsapp-bridge (forbidden on this laptop).
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const receiptImage = require('./receiptImage');

const CAPTION = 'Thank you for shopping at Royal Bath Hub. Your receipt is attached.';
const GRAPH = 'https://graph.facebook.com/v20.0';
const RETRIES = 2;                       // 1 first try + 2 retries
const RETRY_WAIT_MS = 1500;

// Sri Lanka numbers -> '+94771234567', or null when it cannot be one. Never guesses.
function normalizeSriLankaPhone(raw) {
    let d = String(raw == null ? '' : raw).replace(/\D/g, '');
    if (!d) return null;
    if (d.startsWith('00')) d = d.slice(2);
    if (d.length === 10 && d.startsWith('07')) d = '94' + d.slice(1);
    else if (d.length === 9 && d.startsWith('7')) d = '94' + d;
    // Only Sri Lanka mobiles (94 7X XXXXXXX) are accepted: 11 digits.
    if (!/^947\d{8}$/.test(d)) return null;
    return '+' + d;
}
const last3 = p => (p ? String(p).replace(/\D/g, '').slice(-3) : '???');
const mask = p => '***' + last3(p);

function isLive(env = process.env) { return String(env.WHATSAPP_LIVE || '').toLowerCase() === 'true'; }
function haveKeys(env = process.env) { return !!(env.WHATSAPP_API_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID); }

const ready = new WeakSet();   // schema is checked once per connection pool
async function ensureSchema(pool) {
    if (ready.has(pool)) return;
    await pool.query(`ALTER TABLE receipt_queue ADD COLUMN IF NOT EXISTS last_error TEXT`);
    await pool.query(`ALTER TABLE receipt_queue ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0`);
    await pool.query(`CREATE TABLE IF NOT EXISTS wa_receipt_log (
        id SERIAL PRIMARY KEY, queue_id INT, bill_no TEXT, phone_last3 VARCHAR(3),
        result VARCHAR(20) NOT NULL, detail TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    ready.add(pool);
}

async function logAttempt(pool, row, result, detail) {
    const p3 = last3(row && row.customer_phone);
    const line = `[wa-receipt] bill=${(row && row.sale_reference) || '-'} queue=${row && row.id} to=***${p3} at=${new Date().toISOString()} result=${result}${detail ? ' (' + String(detail).slice(0, 200) + ')' : ''}`;
    console.log(line);
    try {
        await pool.query(`INSERT INTO wa_receipt_log (queue_id, bill_no, phone_last3, result, detail) VALUES ($1,$2,$3,$4,$5)`,
            [row.id, row.sale_reference || null, p3, result, detail ? String(detail).slice(0, 300) : null]);
    } catch (e) { /* logging must never break anything */ }
}

// Meta error text can echo request parts: strip the token and long digit runs (phone numbers) before it is stored.
function safeReason(e, env = process.env) {
    let m = (e && e.response && e.response.data && e.response.data.error && e.response.data.error.message) || (e && e.message) || 'unknown error';
    m = String(m);
    if (env.WHATSAPP_API_TOKEN) m = m.split(env.WHATSAPP_API_TOKEN).join('[token]');
    return m.replace(/\d{7,}/g, n => '***' + n.slice(-3)).slice(0, 200);
}

// The real network part. Uploads the PNG, then sends it either as an approved TEMPLATE with the picture in the
// header (works any time) or as a plain image with caption (only inside the customer's 24-hour window).
async function sendViaCloudApi({ to, filePath, env = process.env, http = axios }) {
    const auth = { Authorization: `Bearer ${env.WHATSAPP_API_TOKEN}` };
    const base = `${GRAPH}/${env.WHATSAPP_PHONE_NUMBER_ID}`;
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', 'image/png');
    form.append('file', new Blob([fs.readFileSync(filePath)], { type: 'image/png' }), 'receipt.png');
    const up = await http.post(`${base}/media`, form, { headers: auth, timeout: 30000 });
    const mediaId = up.data && up.data.id;
    if (!mediaId) throw new Error('WhatsApp did not accept the picture upload');
    const toDigits = to.replace(/\D/g, '');
    const tpl = env.WHATSAPP_RECEIPT_TEMPLATE;
    const body = tpl
        ? { messaging_product: 'whatsapp', to: toDigits, type: 'template', template: { name: tpl, language: { code: env.WHATSAPP_RECEIPT_TEMPLATE_LANG || 'en' },
            components: [{ type: 'header', parameters: [{ type: 'image', image: { id: mediaId } }] }] } }
        : { messaging_product: 'whatsapp', to: toDigits, type: 'image', image: { id: mediaId, caption: CAPTION } };
    const res = await http.post(`${base}/messages`, body, { headers: { ...auth, 'Content-Type': 'application/json' }, timeout: 30000 });
    return { id: res.data && res.data.messages && res.data.messages[0] && res.data.messages[0].id };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Sends the receipt for one queue row. Returns { status, ... } and NEVER throws.
// opts: env, send (replaceable sender for tests), retryWaitMs, dir (where the PNGs are)
async function sendReceiptForQueueItem(pool, queueId, opts = {}) {
    const env = opts.env || process.env;
    const send = opts.send || sendViaCloudApi;
    const wait = opts.retryWaitMs == null ? RETRY_WAIT_MS : opts.retryWaitMs;
    const dir = opts.dir || receiptImage.DEFAULT_DIR;
    let row;
    try {
        await ensureSchema(pool);
        if (!/^\d+$/.test(String(queueId))) return { status: 'not_found' };
        const q = await pool.query(`SELECT id, customer_phone, sale_reference, status FROM receipt_queue WHERE id = $1`, [queueId]);
        if (!q.rows.length) return { status: 'not_found' };
        row = q.rows[0];

        if (row.status === 'sent') { await logAttempt(pool, row, 'already_sent'); return { status: 'already_sent' }; }
        if (row.status !== 'queued') { return { status: 'skipped', reason: `row is "${row.status}", only "queued" rows are sent` }; }

        // 1. valid Sri Lanka number on the bill, else "no phone" and skip. Never guess.
        const to = normalizeSriLankaPhone(row.customer_phone);
        if (!to) {
            await pool.query(`UPDATE receipt_queue SET status='no phone', last_error=$2 WHERE id=$1 AND status='queued'`, [row.id, 'no valid phone on this bill']);
            await logAttempt(pool, row, 'no_phone');
            return { status: 'no phone' };
        }

        // 2. once per bill: another queue row for the same bill already sent (or is sending) -> do not send again.
        if (row.sale_reference) {
            const dup = await pool.query(`SELECT id FROM receipt_queue WHERE sale_reference = $1 AND id <> $2 AND status IN ('sent','sending') LIMIT 1`, [row.sale_reference, row.id]);
            if (dup.rows.length) {
                await pool.query(`UPDATE receipt_queue SET status='duplicate', last_error=$2 WHERE id=$1 AND status='queued'`, [row.id, 'this bill was already sent']);
                await logAttempt(pool, row, 'duplicate', 'bill already sent on queue ' + dup.rows[0].id);
                return { status: 'duplicate' };
            }
        }

        // 3. the saved receipt picture
        const img = await pool.query(`SELECT file_name FROM receipt_images WHERE queue_id = $1 ORDER BY id DESC LIMIT 1`, [row.id]);
        if (!img.rows.length) { await logAttempt(pool, row, 'waiting', 'no receipt picture drawn yet'); return { status: 'waiting', reason: 'no receipt picture yet' }; }
        const filePath = path.join(dir, path.basename(img.rows[0].file_name));
        if (!fs.existsSync(filePath)) { await logAttempt(pool, row, 'waiting', 'picture file missing'); return { status: 'waiting', reason: 'picture file missing' }; }

        // 4. DRY RUN unless WHATSAPP_LIVE=true. Nothing sent, row stays "queued".
        if (!isLive(env)) {
            await logAttempt(pool, row, 'dry_run', `would send receipt picture to ${mask(to)} with caption "${CAPTION}"`);
            return { status: 'dry_run', to: mask(to), caption: CAPTION };
        }
        if (!haveKeys(env)) {
            await logAttempt(pool, row, 'no_keys', 'WHATSAPP_LIVE=true but keys missing in .env');
            return { status: 'no_keys', reason: 'WHATSAPP_API_TOKEN / WHATSAPP_PHONE_NUMBER_ID missing in .env' };
        }

        // 5. claim the row (so two clicks cannot send twice), then send with 2 retries.
        const claim = await pool.query(`UPDATE receipt_queue SET status='sending' WHERE id=$1 AND status='queued' RETURNING id`, [row.id]);
        if (!claim.rows.length) return { status: 'skipped', reason: 'already being sent' };
        let lastErr = '';
        for (let attempt = 1; attempt <= 1 + RETRIES; attempt++) {
            try {
                await pool.query(`UPDATE receipt_queue SET attempts = attempts + 1 WHERE id=$1`, [row.id]);
                const r = await send({ to, filePath, env });
                await pool.query(`UPDATE receipt_queue SET status='sent', sent_at=NOW(), last_error=NULL WHERE id=$1`, [row.id]);
                await logAttempt(pool, row, 'sent', `attempt ${attempt}${r && r.id ? ', message ' + r.id : ''}`);
                return { status: 'sent', attempts: attempt };
            } catch (e) {
                lastErr = safeReason(e, env);
                await logAttempt(pool, row, 'error', `attempt ${attempt}: ${lastErr}`);
                if (attempt <= RETRIES) await sleep(wait);
            }
        }
        await pool.query(`UPDATE receipt_queue SET status='failed', last_error=$2 WHERE id=$1`, [row.id, lastErr]);
        await logAttempt(pool, row, 'failed', lastErr);
        return { status: 'failed', reason: lastErr };
    } catch (e) {
        // Anything unexpected: report, never throw into billing. A row stuck in "sending" is put back to failed.
        const reason = safeReason(e, env);
        try { if (row) await pool.query(`UPDATE receipt_queue SET status='failed', last_error=$2 WHERE id=$1 AND status='sending'`, [row.id, reason]); } catch (_) {}
        console.error('[wa-receipt] unexpected error:', reason);
        return { status: 'failed', reason };
    }
}

// Every "queued" row, oldest first (run by the script or by hand).
async function sendAllQueued(pool, opts = {}) {
    await ensureSchema(pool);
    const q = await pool.query(`SELECT id FROM receipt_queue WHERE status = 'queued' ORDER BY id`);
    const out = [];
    for (const r of q.rows) out.push({ id: r.id, ...(await sendReceiptForQueueItem(pool, r.id, opts)) });
    return out;
}

module.exports = { CAPTION, normalizeSriLankaPhone, sendReceiptForQueueItem, sendAllQueued, sendViaCloudApi, isLive, haveKeys, ensureSchema, safeReason };