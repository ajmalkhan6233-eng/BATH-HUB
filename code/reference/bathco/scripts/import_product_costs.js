// Imports data/QUANTITY AND PRICE.xlsx (real Lasersoft "Item Price List As Of
// 22 April 2026", CODE/DESCRIPTION/COST/PRICE/UOM/TOTALQTY, 2634 rows) into the
// products table - upserts avg_cost/selling_price/stock_level for existing item
// codes, creates new rows for item codes not yet in products. Fixes the 85-row
// products table's near-total lack of cost coverage (was matching only 134 of
// 9236 real sold line items before this import).
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({
    host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});

const DRY_RUN = process.argv.includes('--dry-run');

function parseFile() {
    const wb = XLSX.readFile(path.join(__dirname, '..', 'data', 'QUANTITY AND PRICE.xlsx'));
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
    const rows = [];
    for (const r of data) {
        const code = r?.[2];
        if (!code || !/^\d+$/.test(String(code).trim())) continue; // skip header/footer/blank rows
        const description = (r[4] || '').trim();
        const cost = parseFloat(String(r[10] || '0').replace(/,/g, ''));
        const price = parseFloat(String(r[13] || '0').replace(/,/g, ''));
        const uom = (r[16] || '').trim();
        const qty = parseInt(String(r[18] || '0').replace(/,/g, ''), 10) || 0;
        rows.push({ item_code: String(code).trim(), description, cost, price, uom, qty });
    }
    return rows;
}

async function main() {
    const rows = parseFile();
    console.log(`Parsed ${rows.length} product cost rows.`);
    console.log('Sample:', JSON.stringify(rows.slice(0, 3)));
    const withRealCost = rows.filter(r => r.cost > 0).length;
    console.log(`${withRealCost} of ${rows.length} have cost > 0.`);

    if (DRY_RUN) { console.log('DRY RUN - not writing to DB.'); await pool.end(); return; }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let updated = 0, created = 0;
        for (const r of rows) {
            const res = await client.query(
                `UPDATE products SET avg_cost=$2, selling_price=$3, stock_level=$4, updated_at=NOW()
                 WHERE item_code=$1 RETURNING id`,
                [r.item_code, r.cost, r.price, r.qty]);
            if (res.rowCount) { updated++; continue; }
            await client.query(
                `INSERT INTO products (item_code, name, avg_cost, selling_price, stock_level, active)
                 VALUES ($1,$2,$3,$4,$5,true)
                 ON CONFLICT (item_code) DO NOTHING`,
                [r.item_code, r.description || r.item_code, r.cost, r.price, r.qty]);
            created++;
        }
        await client.query('COMMIT');
        console.log(`Updated ${updated} existing products, created ${created} new product rows.`);
    } catch (e) {
        await client.query('ROLLBACK'); throw e;
    } finally {
        client.release(); await pool.end();
    }
}
main().catch(e => { console.error(e); process.exit(1); });
