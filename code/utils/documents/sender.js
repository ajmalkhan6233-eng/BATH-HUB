'use strict';
// "Send on WhatsApp" for a saved document. Owner-only (the route checks), allow-list only, DRY RUN unless the live flags are on.
//  - Recipients live in document_recipients (starts EMPTY). Each has the document types it may receive. Phone is stored in full,
//    shown to the screen and written to logs as the last 3 digits only.
//  - A send goes into the EXISTING receipt_queue as a document message (sale_reference 'DOC-<doc>-<recipient>-<purpose>', status 'doc_queued').
//    The existing receipt sender only ever picks rows with status 'queued', so it never touches these. Nothing is edited in the receipt code.
//  - Every attempt (sent, dry run, refused, duplicate, failed) is written to document_sends: who asked, what, to last 3 digits, result, time.
//  - Idempotency: one real send per (document, recipient, purpose). A second try is refused (409). A failed send frees the key so it can be retried.
const fs = require('fs');
const path = require('path');
const store = require('./store');
const T = require('./transport');
const { normalizeSriLankaPhone } = require('../whatsappReceiptSender');

const ROLES = ['owner', 'colleague', 'contact'];
const PURPOSE_RE = /^[a-z0-9_-]{1,40}$/;
const CAPTION = 'Document from Royal Bath Hub. Sent by the owner.';

const hint = p => '***' + T.last3(p);
const parseTypes = s => { try { const a = JSON.parse(s); return Array.isArray(a) ? a.map(String) : []; } catch (e) { return []; } };
const presentRecipient = r => ({ id: r.id, name: r.name, role: r.role, phone_hint: hint(r.phone), allowed_types: parseTypes(r.allowed_types), active: !!r.active });
const bad = (status, msg) => { const e = new Error(msg); e.status = status; return e; };

// body: { name, role, phone, allowed_types: ['pnl', ...] | ['*'] }  -> clean row values, or throws a 400
function cleanRecipient(body, validKeys) {
    const b = body || {};
    const name = String(b.name || '').trim().slice(0, 100);
    if (!name) throw bad(400, 'Enter the name of the person.');
    const role = b.role === undefined ? 'contact' : String(b.role);
    if (!ROLES.includes(role)) throw bad(400, 'Role must be owner, colleague or contact.');
    const phone = normalizeSriLankaPhone(b.phone);
    if (!phone) throw bad(400, 'Enter a Sri Lanka mobile number, for example 0771234567.');
    let types = Array.isArray(b.allowed_types) ? b.allowed_types.map(String) : [];
    if (types.includes('*')) types = ['*'];
    if (!types.length) throw bad(400, 'Choose which documents this person may receive.');
    if (types.some(t => t !== '*' && !validKeys.includes(t))) throw bad(400, 'One of the document types is not known.');
    return { name, role, phone, allowed_types: JSON.stringify([...new Set(types)]) };
}

async function logSend(pool, f) {
    try {
        const r = await pool.query(
            `INSERT INTO document_sends (document_id, document_title, recipient_id, purpose, idempotency_key, status, to_last3, detail, requested_by, queue_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
            [f.document_id || null, f.title ? String(f.title).slice(0, 200) : null, f.recipient_id || null, f.purpose || 'share', f.key || null, f.status,
                f.to ? T.last3(f.to) : null, f.detail ? String(f.detail).slice(0, 300) : null, f.by || null, f.queue_id || null]);
        console.log(`[documents] send doc=${f.document_id || '-'} to=${f.to ? '***' + T.last3(f.to) : '-'} result=${f.status} by=${f.by || '-'}`);
        return r.rows[0].id;
    } catch (e) { if (f.key) throw e; console.error('[documents] could not log a send:', e.message); return null; }   // a key-claiming insert must never fail silently
}

// Returns { status: <http>, body: {...} } and never throws.
async function sendDocument(pool, o) {
    const env = o.env || process.env;
    const doc = o.doc, by = o.by || null;
    const purpose = o.purpose === undefined || o.purpose === '' ? 'share' : String(o.purpose);
    const base = { document_id: doc.id, title: doc.title, purpose, by };
    try {
        if (!PURPOSE_RE.test(purpose)) return { status: 400, body: { error: 'The purpose is not valid (letters, numbers, - and _ only).' } };
        const rid = Number(o.recipientId);
        const rec = Number.isInteger(rid) && rid > 0 && rid <= 2147483647 ? (await pool.query(`SELECT * FROM document_recipients WHERE id = $1 AND active = TRUE`, [rid])).rows[0] : null;
        if (!rec) { await logSend(pool, { ...base, status: 'refused', detail: 'recipient is not on the allow-list' }); return { status: 403, body: { error: 'That person is not on the allow-list. Add them under Recipients first.' } }; }
        const types = parseTypes(rec.allowed_types);
        const b2 = { ...base, recipient_id: rec.id, to: rec.phone };
        if (!types.includes('*') && !types.includes(doc.type)) {
            await logSend(pool, { ...b2, status: 'refused', detail: `${doc.type} is not allowed for this recipient` });
            return { status: 403, body: { error: `${rec.name} is not allowed to receive this type of document.` } };
        }
        const filePath = store.resolveStored(o.root, doc.path);
        if (!filePath || !fs.existsSync(filePath)) { await logSend(pool, { ...b2, status: 'failed', detail: 'file missing' }); return { status: 404, body: { error: 'The document file is missing.' } }; }

        const key = `doc${doc.id}-rcpt${rec.id}-${purpose}`;
        const prior = await pool.query(`SELECT id, status FROM document_sends WHERE idempotency_key = $1`, [key]);
        if (prior.rows.length) {
            await logSend(pool, { ...b2, status: 'duplicate', detail: `already ${prior.rows[0].status} (send ${prior.rows[0].id})` });
            return { status: 409, body: { error: 'This document was already sent to this person for this purpose.', code: 'duplicate' } };
        }

        // into the existing queue (one row per document + person + purpose), as a document message the receipt sender ignores
        const ref = `DOC-${doc.id}-${rec.id}-${purpose}`.slice(0, 200);
        let q = (await pool.query(`SELECT id FROM receipt_queue WHERE sale_reference = $1 LIMIT 1`, [ref])).rows[0];
        if (!q) q = (await pool.query(`INSERT INTO receipt_queue (customer_phone, sale_reference, amount, status) VALUES ($1,$2,NULL,'doc_queued') RETURNING id`, [rec.phone, ref])).rows[0];
        const queue_id = q.id;

        const transport = o.transport || T.pickTransport(env);
        const msg = { to: rec.phone, filePath, fileName: `${doc.title.replace(/[^\w .-]+/g, '_').slice(0, 80)}.${path.extname(filePath).slice(1)}`, caption: CAPTION, mime: store.EXT[path.extname(filePath).slice(1)].split(';')[0] };

        if (!transport.live) {   // DRY RUN: nothing leaves the laptop, the message stays queued
            await transport.send(msg);
            const id = await logSend(pool, { ...b2, status: 'dry_run', detail: 'dry run: nothing was sent', queue_id });
            return { status: 200, body: { result: 'dry_run', message: `Dry run: would send to ${hint(rec.phone)}. Nothing was sent (WhatsApp sending is switched off).`, send_id: id, queue_id } };
        }

        let claimId;   // claim the key first, so two clicks can never send twice
        try { claimId = await logSend(pool, { ...b2, key, status: 'sending', detail: 'sending', queue_id }); }
        catch (e) { return { status: 409, body: { error: 'This document was already sent to this person for this purpose.', code: 'duplicate' } }; }
        try {
            const r = await transport.send(msg);
            await pool.query(`UPDATE document_sends SET status = 'sent', detail = $2 WHERE id = $1`, [claimId, r && r.id ? `message ${String(r.id).slice(0, 80)}` : 'sent']);
            await pool.query(`UPDATE receipt_queue SET status = 'doc_sent', sent_at = NOW() WHERE id = $1`, [queue_id]);
            console.log(`[documents] sent doc=${doc.id} to=${hint(rec.phone)}`);
            return { status: 200, body: { result: 'sent', message: `Sent to ${hint(rec.phone)}.`, send_id: claimId, queue_id } };
        } catch (e) {
            const why = T.safeReason(e, env);
            await pool.query(`UPDATE document_sends SET status = 'failed', detail = $2, idempotency_key = NULL WHERE id = $1`, [claimId, why]);   // frees the key: can be tried again
            await pool.query(`UPDATE receipt_queue SET status = 'doc_failed' WHERE id = $1`, [queue_id]);
            return { status: 502, body: { error: `Could not send: ${why}`, code: 'failed', send_id: claimId } };
        }
    } catch (e) {
        console.error('[documents] send error:', T.safeReason(e, env));
        return { status: 500, body: { error: 'Could not send the document.' } };
    }
}

module.exports = { ROLES, CAPTION, presentRecipient, cleanRecipient, parseTypes, sendDocument, logSend, hint };
