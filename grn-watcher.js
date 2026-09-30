require('dotenv').config();
require('./utils/timezone');   // Sri Lanka time for Postgres sessions
const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');
const XLSX = require('xlsx');
const Anthropic = require('@anthropic-ai/sdk');

require('./utils/dbGuard').assertTemplateSafeDb('grn-watcher');

const pool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     process.env.DB_PORT     || 5432,
    database: process.env.DB_NAME     || 'bathco_template',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD,
});

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DROP_ROOT         = process.env.DROP_ROOT || path.join(__dirname, 'data', 'drop');
const GRN_INBOX         = path.join(DROP_ROOT, 'inbox', 'GRN');
const GRN_PROCESSED     = path.join(DROP_ROOT, 'processed', 'GRN');
const SCAN_INTERVAL_MS  = 30000;

// In-process set so we don't double-process a file during one run session.
// Real deduplication is handled by checking the DB for the file's basename.
const inFlight = new Set();

// ── Date parsing helpers ──────────────────────────────────────────────────────
// Parses an Excel cell value (serial number or string) to YYYY-MM-DD. Returns null if unrecognizable.
function parseDateCell(val) {
    if (val === null || val === undefined || val === '') return null;
    // Excel serial number: days since 1899-12-30 (standard xlsx epoch)
    if (typeof val === 'number' && val > 40000 && val < 60000) {
        const d = new Date(Math.round((val - 25569) * 86400 * 1000));
        const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, day = d.getUTCDate();
        if (y >= 2020 && y <= 2035)
            return `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    }
    const s = String(val).trim();
    // YYYY-MM-DD
    let m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
    // DD-MM-YYYY or DD/MM/YYYY
    m2 = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    if (m2) {
        const y = m2[3], mo = m2[2].padStart(2,'0'), d = m2[1].padStart(2,'0');
        return `${y}-${mo}-${d}`;
    }
    // Attempt JS date parse as fallback
    const ts = Date.parse(s);
    if (!isNaN(ts)) {
        const dt = new Date(ts);
        if (dt.getFullYear() >= 2020 && dt.getFullYear() <= 2035)
            return dt.toISOString().slice(0, 10);
    }
    return null;
}

// Extract a document date from the filename itself, e.g. GRN_27-11-2025.xlsx → 2025-11-27
function dateFromFilename(filePath) {
    const base = path.basename(filePath, path.extname(filePath));
    const m = base.match(/(\d{2})[-_](\d{2})[-_](\d{4})/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    const m2 = base.match(/(\d{4})[-_](\d{2})[-_](\d{2})/);
    if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
    return null;
}

// ── Extract data from Excel GRN ───────────────────────────────────────────────
function extractFromExcel(filePath) {
    const wb   = XLSX.readFile(filePath, { sheetRows: 60, raw: true });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    // raw:true gives us serial numbers for date cells
    const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
    const rows    = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    let grn_number = null, supplier_name = null, grn_date = null, total_amount = null;

    const flat    = rows.flat().map(String);
    const rawFlat = rawRows.flat();

    for (let i = 0; i < flat.length; i++) {
        const cell = flat[i];
        if (/GRN[-\s#]?\d+/i.test(cell) && !grn_number) grn_number = cell.match(/GRN[-\s#]?\d+/i)[0];
        // Label "Date" / "GRN Date" / "Invoice Date" followed by a date value
        if (/\bdate\b/i.test(cell) && !grn_date) {
            for (let j = i + 1; j <= i + 4 && j < flat.length; j++) {
                const d = parseDateCell(rawFlat[j]) || parseDateCell(flat[j]);
                if (d) { grn_date = d; break; }
            }
        }
        if (/total/i.test(cell)) {
            const next = flat[i + 1];
            if (next && /^\d/.test(next) && !total_amount) total_amount = parseFloat(next.replace(/,/g,'')) || null;
        }
    }

    // Scan raw cells for Excel serial-number dates (catches unlabelled date columns)
    if (!grn_date) {
        for (const v of rawFlat) {
            const d = parseDateCell(v);
            if (d) { grn_date = d; break; }
        }
    }
    // Last resort: parse from filename (e.g. GRN_27-11-2025.xlsx)
    if (!grn_date) grn_date = dateFromFilename(filePath);

    const preview = rows.slice(0, 20).filter(r => r.some(x => x !== ''));
    const item_description = preview.map(r => r.filter(x=>x!=='').join(' | ')).join('\n').slice(0, 800);

    return { grn_number, supplier_name, grn_date, item_description, quantity: null, unit_cost: null, total_amount, ocr_raw: { rows: rows.slice(0, 25) } };
}

// ── Extract data from image via Anthropic vision ──────────────────────────────
async function extractFromImage(filePath) {
    const stat = fs.statSync(filePath);
    if (stat.size > 5 * 1024 * 1024) {
        return { grn_number: null, supplier_name: null, grn_date: null,
                 item_description: 'File too large for OCR (>5 MB) — enter details manually',
                 quantity: null, unit_cost: null, total_amount: null, ocr_raw: null };
    }
    const ext       = path.extname(filePath).toLowerCase();
    const mediaType = ext === '.png' ? 'image/png' : 'image/jpeg';
    const b64       = fs.readFileSync(filePath).toString('base64');

    const resp = await anthropic.messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
            role: 'user',
            content: [
                { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
                { type: 'text',  text:
                    'This is a GRN (Goods Received Note) for Your Business Name, Sri Lanka. ' +
                    'Extract as JSON: grn_number, supplier_name, grn_date (YYYY-MM-DD), ' +
                    'item_description (1-2 sentence summary of items), quantity (main/total), ' +
                    'unit_cost (per unit price if shown), total_amount (invoice total). ' +
                    'Use null for missing fields. Return ONLY valid JSON, no markdown.' }
            ]
        }]
    });

    const raw = resp.content[0].text.trim();
    try {
        const m = raw.match(/\{[\s\S]*\}/);
        return { ...JSON.parse(m[0]), ocr_raw: { raw } };
    } catch {
        return { grn_number: null, supplier_name: null, grn_date: null,
                 item_description: 'OCR extraction failed — enter details manually',
                 quantity: null, unit_cost: null, total_amount: null, ocr_raw: { raw } };
    }
}

// ── Archive the processed file ────────────────────────────────────────────────
// Uses the document's own date (extracted from its content) for the folder path.
// Falls back to today only when no document date is available.
function archiveFile(filePath, docDateStr) {
    let d;
    if (docDateStr) {
        d = new Date(docDateStr + 'T00:00:00');
        if (isNaN(d.getTime())) d = new Date();
    } else {
        d = new Date();
    }
    const dir = path.join(GRN_PROCESSED,
                          `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,
                          String(d.getDate()).padStart(2,'0'));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    let dest = path.join(dir, path.basename(filePath));
    if (fs.existsSync(dest)) dest = path.join(dir, `${Date.now()}_${path.basename(filePath)}`);
    fs.renameSync(filePath, dest);
    return dest;
}

// ── Main processing pipeline ──────────────────────────────────────────────────
async function processFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    let extracted;

    if (['.xlsx', '.xls'].includes(ext)) {
        extracted = extractFromExcel(filePath);
    } else if (['.jpg', '.jpeg', '.png'].includes(ext)) {
        extracted = await extractFromImage(filePath);
    } else if (ext === '.pdf') {
        extracted = { grn_number: null, supplier_name: null, grn_date: null,
                      item_description: 'PDF uploaded — enter details manually',
                      quantity: null, unit_cost: null, total_amount: null, ocr_raw: null };
    } else {
        console.log(`[GRN] Skipping unknown type: ${path.basename(filePath)}`);
        return;
    }

    const archivedPath = archiveFile(filePath, extracted.grn_date || null);

    await pool.query(`
        INSERT INTO grn_records
          (grn_number, supplier_name, grn_date, item_description,
           quantity, unit_cost, total_amount, source_file_path, status, ocr_raw)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'PENDING_REVIEW',$9)`,
        [ extracted.grn_number   || null,
          extracted.supplier_name || null,
          extracted.grn_date      || null,
          extracted.item_description || null,
          extracted.quantity      != null ? +extracted.quantity   : null,
          extracted.unit_cost     != null ? +extracted.unit_cost  : null,
          extracted.total_amount  != null ? +extracted.total_amount: null,
          archivedPath,
          JSON.stringify(extracted.ocr_raw || {}) ]
    );

    console.log(`[GRN] ✓ Ingested: ${path.basename(filePath)}`);
}

// ── Walk inbox recursively (depth-limited) ───────────────────────────────────
function walkInbox(dir, depth = 0) {
    if (depth > 4) return [];
    if (!fs.existsSync(dir)) return [];
    let entries;
    try { entries = fs.readdirSync(dir); } catch { return []; }
    const files = [];
    for (const entry of entries) {
        if (entry.startsWith('.') || entry.startsWith('~$')) continue;
        const full = path.join(dir, entry);
        let stat;
        try { stat = fs.statSync(full); } catch { continue; }
        if (stat.isDirectory()) files.push(...walkInbox(full, depth + 1));
        else if (stat.isFile())  files.push(full);
    }
    return files;
}

// ── Scan inbox on every tick ──────────────────────────────────────────────────
async function scanInbox() {
    if (!fs.existsSync(GRN_INBOX)) { fs.mkdirSync(GRN_INBOX, { recursive: true }); return; }

    const allFiles = walkInbox(GRN_INBOX);
    for (const full of allFiles) {
        if (inFlight.has(full)) continue;
        const file = path.basename(full);

        // Skip if already processed (match on basename to survive renames/moves)
        const exists = await pool.query(
            `SELECT 1 FROM grn_records WHERE source_file_path LIKE $1 LIMIT 1`,
            [`%${file}%`]
        );
        if (exists.rowCount > 0) { inFlight.add(full); continue; }

        inFlight.add(full);
        processFile(full).catch(err => {
            console.error(`[GRN] Error processing ${file}:`, err.message);
            inFlight.delete(full);
        });
    }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function boot() {
    // Ensure grn_records table exists (idempotent)
    await pool.query(`
        CREATE TABLE IF NOT EXISTS grn_records (
            id               SERIAL PRIMARY KEY,
            grn_number       VARCHAR(100),
            supplier_id      INT,
            supplier_name    VARCHAR(200),
            grn_date         DATE,
            item_description TEXT,
            quantity         NUMERIC(12,3),
            unit_cost        NUMERIC(12,2),
            total_amount     NUMERIC(14,2),
            source_file_path TEXT,
            status           VARCHAR(20) DEFAULT 'PENDING_REVIEW',
            ocr_raw          JSONB,
            notes            TEXT,
            created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

    console.log(`[GRN-WATCHER] Started — polling ${GRN_INBOX} every ${SCAN_INTERVAL_MS/1000}s`);
    scanInbox();
    setInterval(scanInbox, SCAN_INTERVAL_MS);
}

boot().catch(err => { console.error('[GRN-WATCHER] Fatal boot error:', err.message); process.exit(1); });
