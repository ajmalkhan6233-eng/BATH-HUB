// routes/investor_loans.js
// INVESTOR / FRIEND LOANS module for BATHCO Nature ERP (Bath Hub Thihariya instance).
// Own Pool (does NOT touch server.js's pool). Same conventions as staff_reports.js:
// pool.query with $1/$2 params, try/catch -> res.status(500).json({error}), TO_CHAR for dates.
//
// This is separate from staff_loans (loans TO staff) — this tracks loans FROM outside
// investors/friends INTO the business, with a flat agreed PROFIT SHARE per loan
// (Sharia-compliant: no interest/riba anywhere in this module, including in the
// data model — the column is profit_rate, not interest_rate).
//
// Tables:
//   investor_loans          -> the loan agreement (lender, amount, profit rate, dates)
//   investor_loan_payments  -> ledger of repayments made against a loan (audit trail)

require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const { fromBuffer: fileTypeFromBuffer } = require('file-type');

const router = express.Router();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

// ─── Idempotent schema migrations (own tables only, prefixed investor_) ─────────
pool.query(`
    CREATE TABLE IF NOT EXISTS investor_loans (
        id             SERIAL PRIMARY KEY,
        lender_name    VARCHAR(150) NOT NULL,
        amount         NUMERIC(12,2) NOT NULL,
        profit_rate    NUMERIC(5,2) DEFAULT 0,      -- flat % profit share agreed for the loan period (not annualized, not interest)
        date_given     DATE NOT NULL,
        due_date       DATE,                        -- nullable: owner may not have agreed a repayment date with this lender yet
        status         VARCHAR(20) DEFAULT 'active', -- active / repaid / overdue
        notes          TEXT,
        created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`).catch(e => console.error('[investor_loans] investor_loans migration failed:', e.message));

// One-time rename in case an earlier local test run created the old interest_rate
// column name before the Sharia-compliance rename — idempotent, safe to re-run.
pool.query(`
    DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='investor_loans' AND column_name='interest_rate')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='investor_loans' AND column_name='profit_rate')
        THEN
            ALTER TABLE investor_loans RENAME COLUMN interest_rate TO profit_rate;
        END IF;
    END $$;
`).catch(e => console.error('[investor_loans] profit_rate rename migration failed:', e.message));

// due_date was briefly required — relaxed back to optional (some lenders/friends
// haven't had a repayment date agreed yet). Idempotent, safe to re-run.
pool.query(`ALTER TABLE investor_loans ALTER COLUMN due_date DROP NOT NULL`)
    .catch(e => console.error('[investor_loans] due_date nullable migration failed:', e.message));

pool.query(`
    CREATE TABLE IF NOT EXISTS investor_loan_payments (
        id            SERIAL PRIMARY KEY,
        loan_id       INT REFERENCES investor_loans(id) ON DELETE CASCADE,
        amount        NUMERIC(12,2) NOT NULL,
        payment_date  DATE NOT NULL,
        notes         TEXT,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`).catch(e => console.error('[investor_loans] investor_loan_payments migration failed:', e.message));

// Loan documents — scanned agreements / WhatsApp screenshots / notes the owner
// uploads per loan so the terms are on record (not just remembered).
pool.query(`
    CREATE TABLE IF NOT EXISTS investor_loan_documents (
        id             SERIAL PRIMARY KEY,
        loan_id        INT REFERENCES investor_loans(id) ON DELETE CASCADE,
        original_name  VARCHAR(255) NOT NULL,
        stored_name    VARCHAR(255) NOT NULL,
        uploaded_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`).catch(e => console.error('[investor_loans] investor_loan_documents migration failed:', e.message));

// ─── File upload (own directory, same validated-extension + magic-byte pattern as server.js) ───
const DOC_DIR = path.join(__dirname, '..', 'uploads', 'investor_loans');
if (!fs.existsSync(DOC_DIR)) fs.mkdirSync(DOC_DIR, { recursive: true });

const ALLOWED_DOC_EXTS = new Set(['jpg', 'jpeg', 'png', 'pdf']);
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, DOC_DIR),
        filename: (req, file, cb) => {
            const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
            cb(null, `${Date.now()}-${safe}`);
        }
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (/\.(jpg|jpeg|png|pdf)$/i.test(file.originalname)) cb(null, true);
        else cb(new Error('Only .jpg .jpeg .png .pdf files are allowed'));
    }
});

// multer's own fileFilter/size errors bypass a normal try/catch (they surface
// via the callback below, not a thrown exception) — without this wrapper an
// invalid upload falls through to Express's default handler, which returns a
// raw HTML page with a full server stack trace (file paths included) instead
// of a clean JSON error.
function uploadDocument(req, res, next) {
    upload.single('file')(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.message });
        next();
    });
}

// Shared SELECT: loan + computed totals (total due w/ agreed profit share, repaid, outstanding).
const LOAN_SELECT = `
    SELECT
        l.id, l.lender_name, l.amount, l.profit_rate, l.qr_outstanding,
        TO_CHAR(l.date_given,'YYYY-MM-DD') AS date_given,
        TO_CHAR(l.due_date,'YYYY-MM-DD') AS due_date,
        l.status, l.notes, l.created_at,
        ROUND(l.amount + (l.amount * l.profit_rate / 100), 2) AS total_due,
        COALESCE(p.total_paid, 0) AS total_repaid,
        ROUND(l.amount + (l.amount * l.profit_rate / 100) - COALESCE(p.total_paid, 0), 2) AS outstanding,
        (l.due_date - CURRENT_DATE) AS days_to_due
    FROM investor_loans l
    LEFT JOIN (
        SELECT loan_id, SUM(amount) AS total_paid
        FROM investor_loan_payments
        GROUP BY loan_id
    ) p ON p.loan_id = l.id
`;

pool.query(`ALTER TABLE investor_loans ADD COLUMN IF NOT EXISTS qr_outstanding NUMERIC(12,2) DEFAULT 0`)
    .catch(e => console.error('[investor_loans] qr_outstanding migration failed:', e.message));

// Manually update the QR (Qatari Riyal) side of a loan — kept separate from the
// LKR amount/interest/payments math above since it's a different currency with
// no exchange-rate conversion built in. Owner updates this by hand when the QR
// balance changes.
router.put('/investor-loans/:id/qr-balance', async (req, res) => {
    try {
        const { qr_outstanding } = req.body;
        if (qr_outstanding === undefined) return res.status(400).json({ error: 'qr_outstanding is required' });
        const r = await pool.query(`
            UPDATE investor_loans SET qr_outstanding = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 RETURNING id, qr_outstanding
        `, [qr_outstanding, req.params.id]);
        if (!r.rows.length) return res.status(404).json({ error: 'not found' });
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ LIST all loans ═══════════════════════
router.get('/investor-loans', async (req, res) => {
    try {
        const { status } = req.query;
        const vals = [];
        let where = '';
        if (status) { vals.push(status); where = `WHERE l.status = $1`; }
        const r = await pool.query(`${LOAN_SELECT} ${where} ORDER BY l.date_given DESC`, vals);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ SUMMARY (for dashboard / LAYLA cash-flow check) ═══════════════════════
router.get('/investor-loans/summary', async (req, res) => {
    try {
        const r = await pool.query(`${LOAN_SELECT} WHERE l.status != 'repaid'`);
        const totals = r.rows.reduce((acc, row) => {
            acc.total_outstanding += Number(row.outstanding);
            acc.total_borrowed += Number(row.total_due);
            acc.total_repaid += Number(row.total_repaid);
            return acc;
        }, { total_outstanding: 0, total_borrowed: 0, total_repaid: 0 });
        const dueSoon = r.rows.filter(row => row.days_to_due !== null && row.days_to_due <= 7 && row.days_to_due >= 0);
        res.json({ ...totals, due_within_7_days: dueSoon });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ GET one loan + its payment history ═══════════════════════
router.get('/investor-loans/:id', async (req, res) => {
    try {
        const r = await pool.query(`${LOAN_SELECT} WHERE l.id = $1`, [req.params.id]);
        if (!r.rows.length) return res.status(404).json({ error: 'not found' });
        const payments = await pool.query(
            `SELECT id, amount, TO_CHAR(payment_date,'YYYY-MM-DD') AS payment_date, notes, created_at
             FROM investor_loan_payments WHERE loan_id = $1 ORDER BY payment_date DESC`,
            [req.params.id]
        );
        const documents = await pool.query(
            `SELECT id, original_name, uploaded_at FROM investor_loan_documents WHERE loan_id = $1 ORDER BY uploaded_at DESC`,
            [req.params.id]
        );
        res.json({ ...r.rows[0], payments: payments.rows, documents: documents.rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ CREATE a loan ═══════════════════════
router.post('/investor-loans', async (req, res) => {
    try {
        const { lender_name, amount, profit_rate, date_given, due_date, notes } = req.body;
        if (!lender_name || !amount || !date_given) {
            return res.status(400).json({ error: 'lender_name, amount, date_given are required' });
        }
        const r = await pool.query(`
            INSERT INTO investor_loans (lender_name, amount, profit_rate, date_given, due_date, notes)
            VALUES ($1,$2,$3,$4,$5,$6)
            RETURNING id
        `, [lender_name, amount, profit_rate || 0, date_given, due_date || null, notes || null]);
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ EDIT a loan's basic details (and end/re-open it) ═══════════════════════
router.put('/investor-loans/:id', async (req, res) => {
    try {
        const { lender_name, amount, profit_rate, date_given, due_date, notes, status, clear_due_date } = req.body;
        const r = await pool.query(`
            UPDATE investor_loans
            SET lender_name = COALESCE($1, lender_name),
                amount = COALESCE($2, amount),
                profit_rate = COALESCE($3, profit_rate),
                date_given = COALESCE($4, date_given),
                due_date = CASE WHEN $8::boolean THEN NULL ELSE COALESCE($5, due_date) END,
                notes = COALESCE($6, notes),
                status = COALESCE($9, status),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $7
            RETURNING id
        `, [lender_name, amount, profit_rate, date_given, due_date, notes, req.params.id, !!clear_due_date, status || null]);
        if (!r.rows.length) return res.status(404).json({ error: 'not found' });
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ RECORD a repayment ═══════════════════════
router.post('/investor-loans/:id/payments', async (req, res) => {
    try {
        const { amount, payment_date, notes } = req.body;
        if (!amount || !payment_date) return res.status(400).json({ error: 'amount and payment_date are required' });

        const loan = await pool.query(`SELECT id FROM investor_loans WHERE id = $1`, [req.params.id]);
        if (!loan.rows.length) return res.status(404).json({ error: 'loan not found' });

        await pool.query(`
            INSERT INTO investor_loan_payments (loan_id, amount, payment_date, notes)
            VALUES ($1,$2,$3,$4)
        `, [req.params.id, amount, payment_date, notes || null]);

        // Auto-mark repaid if payments now cover principal + agreed profit share.
        const check = await pool.query(`${LOAN_SELECT} WHERE l.id = $1`, [req.params.id]);
        const outstanding = Number(check.rows[0].outstanding);
        if (outstanding <= 0) {
            await pool.query(`UPDATE investor_loans SET status = 'repaid', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [req.params.id]);
        }
        res.json(check.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ UPLOAD a document (agreement, screenshot, note) ═══════════════════════
router.post('/investor-loans/:id/documents', uploadDocument, async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'file is required' });
        const loan = await pool.query(`SELECT id FROM investor_loans WHERE id = $1`, [req.params.id]);
        if (!loan.rows.length) {
            fs.unlink(req.file.path, () => {});
            return res.status(404).json({ error: 'loan not found' });
        }
        // Magic-byte check (same defense as server.js's general upload path) —
        // a renamed .exe with a .pdf extension would pass the fileFilter above.
        const buf = fs.readFileSync(req.file.path);
        const type = await fileTypeFromBuffer(buf);
        if (!type || !ALLOWED_DOC_EXTS.has(type.ext)) {
            fs.unlink(req.file.path, () => {});
            return res.status(400).json({ error: `File content does not match an allowed type (got: ${type?.mime || 'unknown'})` });
        }
        const r = await pool.query(`
            INSERT INTO investor_loan_documents (loan_id, original_name, stored_name)
            VALUES ($1,$2,$3) RETURNING id, original_name, uploaded_at
        `, [req.params.id, req.file.originalname, req.file.filename]);
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ LIST documents for a loan ═══════════════════════
router.get('/investor-loans/:id/documents', async (req, res) => {
    try {
        const r = await pool.query(
            `SELECT id, original_name, uploaded_at FROM investor_loan_documents WHERE loan_id = $1 ORDER BY uploaded_at DESC`,
            [req.params.id]
        );
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ DOWNLOAD one document ═══════════════════════
router.get('/investor-loans/documents/:docId/download', async (req, res) => {
    try {
        const r = await pool.query(`SELECT original_name, stored_name FROM investor_loan_documents WHERE id = $1`, [req.params.docId]);
        if (!r.rows.length) return res.status(404).json({ error: 'not found' });
        const filePath = path.join(DOC_DIR, r.rows[0].stored_name);
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'file missing on disk' });
        // res.download()/res.sendFile() without a `root` option check the WHOLE
        // absolute path for a dot-prefixed segment (send@1.2.1) — this worktree
        // lives under .claude/worktrees/..., which false-positives as a hidden
        // dotfile and 404s. Passing `root` + the relative filename avoids it.
        res.download(r.rows[0].stored_name, r.rows[0].original_name, { root: DOC_DIR });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ DELETE a document ═══════════════════════
router.delete('/investor-loans/documents/:docId', async (req, res) => {
    try {
        const r = await pool.query(`DELETE FROM investor_loan_documents WHERE id = $1 RETURNING stored_name`, [req.params.docId]);
        if (!r.rows.length) return res.status(404).json({ error: 'not found' });
        fs.unlink(path.join(DOC_DIR, r.rows[0].stored_name), () => {});
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ ONE-TIME REPORT — full status + payment history as PDF ═══════════════════════
router.get('/investor-loans/:id/report/pdf', async (req, res) => {
    try {
        const r = await pool.query(`${LOAN_SELECT} WHERE l.id = $1`, [req.params.id]);
        if (!r.rows.length) return res.status(404).json({ error: 'not found' });
        const loan = r.rows[0];
        const payments = await pool.query(
            `SELECT amount, TO_CHAR(payment_date,'YYYY-MM-DD') AS payment_date, notes
             FROM investor_loan_payments WHERE loan_id = $1 ORDER BY payment_date ASC`,
            [req.params.id]
        );

        let branding = { company_name: 'Bath Hub Thihariya', currency_symbol: 'Rs' };
        try {
            branding = { ...branding, ...JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'active.branding.json'), 'utf8')) };
        } catch { /* fall back to defaults above */ }
        const sym = branding.currency_symbol || 'Rs';
        const money = n => `${sym} ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="loan-report-${loan.lender_name.replace(/[^a-zA-Z0-9]/g, '_')}-${loan.id}.pdf"`);

        const PAGE_W = 595.28, PAGE_H = 841.89; // A4
        const MARGIN = 50;
        const CONTENT_W = PAGE_W - MARGIN * 2;
        const doc = new PDFDocument({ size: [PAGE_W, PAGE_H], margin: MARGIN });
        doc.pipe(res);

        // Same convention as pos_bills.js: vector draws don't move doc.y, so y is tracked manually throughout.
        let y = MARGIN;
        const cx = MARGIN + 20;
        doc.circle(cx, y + 20, 20).fillAndStroke('#0a4531', '#d4af37');
        doc.save();
        doc.lineWidth(2).strokeColor('#e8cf7a')
            .moveTo(cx - 11, y + 13).lineTo(cx - 2, y + 13)
            .quadraticCurveTo(cx + 4, y + 13, cx + 4, y + 18)
            .lineTo(cx + 4, y + 22).stroke();
        doc.circle(cx - 11, y + 13, 2).fill('#e8cf7a');
        doc.circle(cx, y + 27, 5).fill('#c9a227');
        doc.restore();

        doc.font('Helvetica-Bold').fontSize(16).fillColor('#0a4531')
            .text(branding.company_name || 'Bath Hub Thihariya', MARGIN + 48, y + 4, { width: CONTENT_W - 48 });
        doc.font('Helvetica').fontSize(9).fillColor('#5c4033')
            .text('Investor / Friend Loan Report', MARGIN + 48, doc.y + 1, { width: CONTENT_W - 48 });
        y = Math.max(y + 44, doc.y) + 12;
        doc.strokeColor('#c9a227').lineWidth(1).moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).stroke();
        y += 16;

        doc.font('Helvetica-Bold').fontSize(13).fillColor('#000').text(loan.lender_name, MARGIN, y);
        y = doc.y + 4;
        doc.font('Helvetica').fontSize(9).fillColor('#5c4033')
            .text(`Generated ${new Date().toLocaleString('en-LK')}`, MARGIN, y);
        y = doc.y + 14;

        // ── Loan summary block ──
        const LABEL_X = MARGIN, VALUE_X = MARGIN + 160;
        function summaryRow(label, value, opts = {}) {
            doc.font('Helvetica').fontSize(10).fillColor('#5c4033').text(label, LABEL_X, y, { width: 150 });
            doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor(opts.color || '#000')
                .text(value, VALUE_X, y, { width: CONTENT_W - 160 });
            y = doc.y + 6;
        }
        summaryRow('Amount borrowed', money(loan.amount));
        summaryRow('Profit share', `${Number(loan.profit_rate)}% (flat, agreed for the loan period)`);
        summaryRow('Date given', loan.date_given);
        summaryRow('Due date', loan.due_date || 'Not yet agreed — open');
        summaryRow('Status', loan.status === 'repaid' ? 'Repaid / Ended' : 'Active');
        if (loan.notes) summaryRow('Notes', loan.notes);
        y += 6;
        doc.strokeColor('#ccc').lineWidth(0.5).moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).stroke();
        y += 14;

        summaryRow('Total payable (incl. profit share)', money(loan.total_due), { bold: true });
        summaryRow('Total repaid to date', money(loan.total_repaid), { color: '#1e5c3f' });
        summaryRow('Outstanding balance', money(loan.outstanding), { bold: true, color: loan.outstanding > 0 ? '#a02020' : '#1e5c3f' });
        y += 10;
        doc.strokeColor('#c9a227').lineWidth(1).moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).stroke();
        y += 16;

        // ── Payment history table ──
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#0a4531').text('Payment history', MARGIN, y);
        y = doc.y + 8;

        const COL_DATE_X = MARGIN, COL_DATE_W = 90;
        const COL_AMT_X = MARGIN + 100, COL_AMT_W = 110;
        const COL_NOTES_X = MARGIN + 220, COL_NOTES_W = CONTENT_W - 220;
        function drawPaymentRow(date, amount, notes, bold) {
            const font = bold ? 'Helvetica-Bold' : 'Helvetica';
            doc.font(font).fontSize(9).fillColor('#000');
            const notesHeight = doc.heightOfString(notes, { width: COL_NOTES_W });
            doc.text(date, COL_DATE_X, y, { width: COL_DATE_W });
            doc.text(amount, COL_AMT_X, y, { width: COL_AMT_W });
            doc.text(notes, COL_NOTES_X, y, { width: COL_NOTES_W });
            y += Math.max(notesHeight, 12) + 4;
        }
        drawPaymentRow('Date', 'Amount', 'Notes', true);
        doc.strokeColor('#ccc').lineWidth(0.5).moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).stroke();
        y += 6;
        if (!payments.rows.length) {
            doc.font('Helvetica').fontSize(9).fillColor('#8b6f47').text('No repayments recorded yet.', MARGIN, y);
            y = doc.y + 6;
        } else {
            for (const p of payments.rows) {
                if (y > PAGE_H - MARGIN - 40) { doc.addPage(); y = MARGIN; }
                drawPaymentRow(p.payment_date, money(p.amount), p.notes || '—');
            }
        }

        y += 10;
        doc.font('Helvetica').fontSize(8).fillColor('#8b6f47')
            .text('Bath Hub Thihariya — internal record, generated by the app.', MARGIN, PAGE_H - MARGIN - 10, { width: CONTENT_W, align: 'center' });

        doc.end();
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
