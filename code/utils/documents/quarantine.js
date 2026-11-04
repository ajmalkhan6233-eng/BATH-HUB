'use strict';
// INBOUND FILES, stage 2: a file that arrives (from WhatsApp later, or uploaded by the owner as a test) lands in QUARANTINE first.
//   - real type checked from the file CONTENT (file-type), only jpg / png / pdf allowed, size limit, random file name, folder uploads/inbox/
//   - a SUGGESTED place is worked out from the file name and caption (GRN, expense sheet, supplier bill, cheque photo): a hint only
//   - NOTHING is posted to any ledger from here. The owner taps Confirm; Confirm hands the file to the EXISTING Document Inbox as a
//     "to check" paper (routes/document_inbox.js), where the owner still checks the fields and presses File. Reject deletes the file.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' };
const MIME_OF = { jpg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf' };
const FILE_RE = /^[a-f0-9]{32}\.(jpg|png|pdf)$/;

// place -> label, and the Document Inbox paper type it is handed over as
const PLACES = {
    grn:           { label: 'GRN (goods received)', inbox_type: 'grn' },
    expense_sheet: { label: 'Expense sheet',        inbox_type: 'expense_sheet' },
    supplier_bill: { label: 'Supplier bill',        inbox_type: 'invoice' },
    cheque_photo:  { label: 'Cheque photo',         inbox_type: 'cheque' },
};
const RULES = [   // first match wins; checked against file name + caption
    ['cheque_photo', /\b(cheque|check|chq)\b/i, 'the name or caption mentions a cheque'],
    ['grn', /\b(grn|goods\s*received|received\s*note)\b/i, 'the name or caption mentions a GRN'],
    ['expense_sheet', /\b(expense|expenses|petty\s*cash)\b/i, 'the name or caption mentions expenses'],
    ['supplier_bill', /\b(invoice|supplier|bill)\b/i, 'the name or caption mentions a bill or invoice'],
];
function suggestPlace(name, caption) {
    const text = `${name || ''} ${caption || ''}`.replace(/[_.-]+/g, ' ');
    for (const [place, re, why] of RULES) if (re.test(text)) return { place, reason: why };
    return { place: null, reason: 'no clue in the name or caption: choose it yourself' };
}

const defaultRoot = () => path.resolve(process.env.INBOX_QUARANTINE_DIR || path.join(__dirname, '..', '..', 'uploads', 'inbox'));

// Real type from the file content. Fails closed: if the checker is missing or unsure, the file is refused.
async function detectType(buf) {
    try {
        const ft = require('file-type');
        const fn = ft.fromBuffer || ft.fileTypeFromBuffer;
        const t = typeof fn === 'function' ? await fn(buf) : null;
        return t && ALLOWED[t.mime] ? ALLOWED[t.mime] : null;
    } catch (e) { return null; }
}
const bad = (status, msg) => { const e = new Error(msg); e.status = status; return e; };

// o: { buffer, originalName, source, fromRef, caption, root, detect, maxBytes }  -> the saved row. Throws Error with .status (400/413/415).
async function intake(pool, o) {
    const buf = o.buffer;
    if (!Buffer.isBuffer(buf) || buf.length === 0) throw bad(400, 'The file is empty.');
    if (buf.length > (o.maxBytes || MAX_BYTES)) throw bad(413, `The file is too large (the limit is ${Math.round((o.maxBytes || MAX_BYTES) / 1048576)} MB).`);
    const ext = await (o.detect || detectType)(buf);
    if (!ext || !MIME_OF[ext]) throw bad(415, 'Only photos (JPG, PNG) and PDF files are accepted. The file content is not one of those.');
    const root = o.root || defaultRoot();
    const sha = crypto.createHash('sha256').update(buf).digest('hex');
    const dup = await pool.query(`SELECT * FROM document_quarantine WHERE sha256 = $1 AND status = 'quarantined' LIMIT 1`, [sha]);
    if (dup.rows[0]) return { ...dup.rows[0], duplicate: true };       // the same file is already waiting: do not stack copies
    const fileName = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(path.join(root, fileName), buf, { flag: 'wx' });
    const original = String(o.originalName || '').replace(/[\r\n\0]/g, ' ').slice(0, 200);
    const caption = String(o.caption || '').replace(/[\r\n\0]/g, ' ').slice(0, 300);
    const sug = suggestPlace(original, caption);
    try {
        const r = await pool.query(
            `INSERT INTO document_quarantine (file_name, ext, mime, bytes, sha256, original_name, source, from_ref, caption, suggested_place, suggested_reason)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
            [fileName, ext, MIME_OF[ext], buf.length, sha, original, String(o.source || 'upload').slice(0, 30), String(o.fromRef || '').slice(0, 100), caption, sug.place, sug.reason]);
        return r.rows[0];
    } catch (e) { fs.unlink(path.join(root, fileName), () => {}); throw e; }
}

const present = r => ({
    id: r.id, original_name: r.original_name, mime: r.mime, bytes: r.bytes, source: r.source, caption: r.caption, status: r.status,
    suggested_place: r.suggested_place, suggested_label: r.suggested_place && PLACES[r.suggested_place] ? PLACES[r.suggested_place].label : null,
    suggested_reason: r.suggested_reason, created_at: r.created_at, inbox_id: r.inbox_id, duplicate: !!r.duplicate,
});

function filePathOf(root, row) {
    if (!row || !FILE_RE.test(String(row.file_name))) return null;
    const abs = path.resolve(root, row.file_name);
    return abs.startsWith(path.resolve(root) + path.sep) ? abs : null;
}

module.exports = { MAX_BYTES, ALLOWED, PLACES, suggestPlace, detectType, intake, present, filePathOf, defaultRoot, FILE_RE };
