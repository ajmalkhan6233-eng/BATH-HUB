// Parses extracted_text/DSBD.txt (Lasersoft "Sales By Item Detail" export, already
// OCR'd/extracted to text but never imported) into audit_invoice_items, then joins
// against products.avg_cost to estimate line-level cost/COGS/GP.
// Unit cost is an ESTIMATE from TODAY's avg_cost, not the real historical cost at
// time of sale - flagged honestly via cost_source, never labeled as if it were a
// real Lasersoft-verified cost figure.
const fs = require('fs');
const path = require('path');
const { Pool, types: pgTypes } = require('pg');
pgTypes.setTypeParser(1082, val => val);
require('dotenv').config();
const pool = new Pool({
    host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});

const DRY_RUN = process.argv.includes('--dry-run');
const FILE_PATH = path.join(__dirname, '..', 'extracted_text', 'DSBD.txt');

const DATE_LINE = /^(\d{4}-\d{2}-\d{2})$/;
const SUBTOTAL_LINE = /SUB TOTAL:/;
const GRAND_TOTAL_LINE = /GRAND TOTAL:/;
const HEADER_FOOTER_LINE = /SOFTWARE \(C\) LASERSOFT|^DOC NO\. CODE DESCRIPTION|^1ST CHOICE BATHCO|^DATE\s*:|^ITEM:/;
// DOC_NO  ITEM_CODE  DESCRIPTION(non-greedy)  QTY  UOM  UNIT_PRICE  EXT_AMOUNT
const DATA_LINE = /^((?:H?SL)\d+)\s+(\d+)\s+(.+?)\s+(-?\d+)\s+(\w+)\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})$/;

function parseFile() {
    const lines = fs.readFileSync(FILE_PATH, 'utf8').split('\n').map(l => l.trim());
    let currentDate = null;
    const rows = [];
    let unmatchedCount = 0, unmatchedSample = [];
    for (const line of lines) {
        if (!line) continue;
        if (HEADER_FOOTER_LINE.test(line) || GRAND_TOTAL_LINE.test(line)) continue;
        if (SUBTOTAL_LINE.test(line)) continue;
        const dm = line.match(DATE_LINE);
        if (dm) { currentDate = dm[1]; continue; }
        const m = line.match(DATA_LINE);
        if (m) {
            if (!currentDate) continue; // shouldn't happen, but guard
            const [, invoice_no, item_code, description, qty, uom, unit_price, line_total] = m;
            rows.push({
                sale_date: currentDate, invoice_no, item_code, description: description.trim(),
                qty: parseFloat(qty), uom, unit_price: parseFloat(unit_price.replace(/,/g, '')),
                line_total: parseFloat(line_total.replace(/,/g, '')),
            });
        } else {
            // Continuation line (wrapped description) or truly unrecognized - track for reporting.
            unmatchedCount++;
            if (unmatchedSample.length < 15) unmatchedSample.push(line);
        }
    }
    return { rows, unmatchedCount, unmatchedSample };
}

async function main() {
    const { rows, unmatchedCount, unmatchedSample } = parseFile();
    console.log(`Parsed ${rows.length} item-level sale lines.`);
    console.log(`${unmatchedCount} lines did not match the data pattern (mostly wrapped description continuations, expected).`);
    console.log('Sample of unmatched lines (first 15):');
    unmatchedSample.forEach(l => console.log('  ', JSON.stringify(l)));

    const dateRange = rows.reduce((acc, r) => ({
        min: !acc.min || r.sale_date < acc.min ? r.sale_date : acc.min,
        max: !acc.max || r.sale_date > acc.max ? r.sale_date : acc.max,
    }), {});
    console.log('Date range:', dateRange.min, 'to', dateRange.max);
    const totalAmount = rows.reduce((s, r) => s + r.line_total, 0);
    console.log('Sum of line_total across all parsed rows:', totalAmount.toLocaleString('en-US', {minimumFractionDigits:2}));

    if (DRY_RUN) { console.log('DRY RUN - not writing to DB.'); await pool.end(); return; }

    // Load products for avg_cost lookup (item_code -> avg_cost).
    const prodRes = await pool.query('SELECT item_code, avg_cost FROM products');
    const costMap = new Map(prodRes.rows.map(p => [String(p.item_code), p.avg_cost != null ? Number(p.avg_cost) : null]));

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('TRUNCATE audit_invoice_items RESTART IDENTITY'); // idempotent re-import
        let inserted = 0, withCost = 0;
        for (const r of rows) {
            const avgCost = costMap.get(r.item_code);
            const hasCost = avgCost != null && avgCost > 0;
            const unit_cost = hasCost ? avgCost : null;
            const line_cogs = hasCost ? Math.round(unit_cost * r.qty * 100) / 100 : null;
            const line_gp = hasCost ? Math.round((r.line_total - line_cogs) * 100) / 100 : null;
            const cost_source = hasCost ? 'EST-AVG-COST' : 'MISSING';
            if (hasCost) withCost++;
            const res = await client.query(
                `INSERT INTO audit_invoice_items
                 (sale_date, invoice_no, item_code, description, qty, uom, unit_price, line_total, unit_cost, line_cogs, line_gp, cost_source)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
                 ON CONFLICT (sale_date, invoice_no, item_code, line_total) DO NOTHING`,
                [r.sale_date, r.invoice_no, r.item_code, r.description, r.qty, r.uom, r.unit_price, r.line_total, unit_cost, line_cogs, line_gp, cost_source]);
            if (res.rowCount) inserted++;
        }
        await client.query('COMMIT');
        console.log(`Inserted ${inserted} rows (${rows.length - inserted} were duplicates, skipped).`);
        console.log(`${withCost} of ${inserted} rows have an estimated cost (products.avg_cost); ${inserted - withCost} are cost_source=MISSING (item_code not found in products, or avg_cost is 0/unset).`);
    } catch (e) {
        await client.query('ROLLBACK'); throw e;
    } finally {
        client.release(); await pool.end();
    }
}
main().catch(e => { console.error(e); process.exit(1); });
