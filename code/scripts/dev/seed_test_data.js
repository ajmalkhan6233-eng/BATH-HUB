// DEV / TEST ONLY: fills a throwaway test database with believable demo data so every screen has something to show.
// Refuses any database that is not a UTF8 "...test..." one. Run AFTER the app has booted once (it creates its own tables)
// and after the setup wizard:   node scripts/dev/seed_test_data.js [path-to-.test-login.txt]
// Safe to re-run: it skips tables that already have rows.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const ROOT = path.join(__dirname, '..', '..');
const BASE = `http://localhost:${process.env.PORT || 3100}`;

// Simple coloured tile picture saved as an item photo (so the website and catalogue show real images).
function tileSvg(base, vein) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" fill="${base}"/>` +
        `<path d="M30 0 Q90 120 60 240" stroke="${vein}" stroke-width="3" fill="none" opacity=".5"/><path d="M150 0 Q110 110 190 240" stroke="${vein}" stroke-width="2" fill="none" opacity=".4"/>` +
        `<rect x="1" y="1" width="238" height="238" fill="none" stroke="#0003" stroke-width="2"/></svg>`;
}

const PRODUCTS = [
    // code, name, category, stock, reorder, price, cost, base, vein, size, finish, use
    ['1001', 'Marble Ivory Floor Tile 60x60', 'Tiles', 120, 20, 4500, 2999, '#E9E4DA', '#B8B0A0', '60x60', 'Glossy', 'Floor, Wall'],
    ['1002', 'Carrara Grey Tile 60x120', 'Tiles', 8, 15, 7800, 5200, '#DADDDF', '#8D949A', '60x120', 'Nano polish', 'Floor'],
    ['1003', 'Slate Charcoal Matt 60x60', 'Tiles', 64, 20, 4200, 2800, '#45494D', '#2E3235', '60x60', 'Matt', 'Floor, Bathroom'],
    ['1004', 'Oak Plank Wood Look 20x120', 'Tiles', 40, 12, 5200, 3400, '#B98B5E', '#8E6440', '20x120', 'Matt', 'Floor'],
    ['1005', 'Mint Wall Tile 30x60', 'Tiles', 3, 10, 2900, 1800, '#BFE0D3', '#8FBFAE', '30x60', 'Glossy', 'Wall, Bathroom, Kitchen'],
    ['2001', 'Basin Mixer Tap Chrome', 'Taps', 14, 5, 12500, 7800, '#C9D3D8', '#8A9BA2', '', '', ''],
    ['2002', 'Rain Shower Set', 'Showers', 6, 3, 28500, 19000, '#C9D3D8', '#8A9BA2', '', '', ''],
    ['3001', 'Pedestal Basin White', 'Sanitary', 11, 4, 16800, 10500, '#F4F7F8', '#B9C6CB', '', '', ''],
];

(async () => {
    const c = new Client({ host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
    await c.connect();
    const { db, enc } = (await c.query(`SELECT current_database() AS db, pg_encoding_to_char(encoding) AS enc FROM pg_database WHERE datname = current_database()`)).rows[0];
    if (!/test/i.test(db) || enc !== 'UTF8') { console.error(`Refusing: "${db}" (${enc}) is not a UTF8 throwaway test database.`); process.exit(1); }
    const empty = async t => Number((await c.query(`SELECT COUNT(*) AS n FROM ${t}`)).rows[0].n) === 0;

    // photos
    const photoDir = path.join(ROOT, 'uploads', 'item_photos');
    fs.mkdirSync(photoDir, { recursive: true });

    if (await empty('products')) {
        for (const [code, name, cat, stock, reorder, price, cost, base, vein] of PRODUCTS) {
            const file = `demo-${code}.svg`;
            fs.writeFileSync(path.join(photoDir, file), tileSvg(base, vein));
            await c.query(`INSERT INTO products (item_code, name, category, stock_level, reorder_threshold, selling_price, avg_cost, photo_url, active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)`,
                [code, name, cat, stock, reorder, price, cost, `/api/item-photos/${file}`]);
        }
        console.log('products + photos added');
    }
    if (await empty('suppliers')) {
        await c.query(`INSERT INTO suppliers (name, phone, category, active) VALUES ('Lanka Ceramics (demo)','0112345678','Tiles',true), ('Aqua Fittings (demo)','0117654321','Sanitary',true)`);
        await c.query(`INSERT INTO supplier_payments (supplier_id, amount, pay_date) VALUES (1, 150000, CURRENT_DATE - 20)`);
        await c.query(`INSERT INTO grn_records (grn_number, supplier_id, supplier_name, grn_date, item_description, quantity, unit_cost, total_amount, status)
            VALUES ('MG-DEMO-01', 1, 'Lanka Ceramics (demo)', CURRENT_DATE - 45, '1001 - Marble Ivory Floor Tile', 100, 2999, 299900, 'APPROVED'),
                   ('MG-DEMO-02', 2, 'Aqua Fittings (demo)', CURRENT_DATE - 10, '2001 - Basin Mixer Tap', 20, 7800, 156000, 'PENDING_REVIEW')`);
        console.log('suppliers + GRNs added');
    }
    if (await empty('customers')) {
        await c.query(`INSERT INTO customers (name, phone, whatsapp, source) VALUES ('Kamal Perera (demo)','0771234567','0771234567','walk_in'), ('Sunil Silva (demo)','0712223334','0712223334','tiktok')`);
        await c.query(`INSERT INTO credit_customers (customer_id, name, invoice_date, invoice_no, amount, paid, due_date) VALUES (1,'Kamal Perera (demo)', CURRENT_DATE - 40, 'INV-1001', 90000, 20000, CURRENT_DATE - 10)`);
        await c.query(`INSERT INTO cheques (customer_id, amount, due_date, bank, cheque_no, status) VALUES (1, 35000, CURRENT_DATE + 6, 'HNB', 'CHQ-0001', 'pending')`);
        console.log('customers, credit and cheque added');
    }
    {   // 15 days including today; existing days are left alone
        for (let i = 14; i >= 0; i--) {
            const sale = 280000 + ((i * 37919) % 160000), gp = Math.round(sale * 0.22), exp = 60000 + ((i * 7331) % 25000);
            await c.query(`INSERT INTO daily_summary (report_date, total_sale, cash_sale, card_sale, online_sale, credit_sale, total_expenses, gross_profit, net_profit, gp_status, day_status, sales_source, expenses_source, source)
                VALUES (CURRENT_DATE - $1::int, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTUAL', 'COMPLETE', 'demo', 'demo', 'demo') ON CONFLICT (report_date) DO NOTHING`,
                [i, sale, Math.round(sale * 0.55), Math.round(sale * 0.25), Math.round(sale * 0.1), Math.round(sale * 0.1), exp, gp, gp - exp]);
        }
        console.log('15 days of daily sales (up to today) in place');
    }
    await c.end();

    // New-module demo data goes through the app itself (needs the login file written by the setup step).
    const loginFile = process.argv[2] || path.join(ROOT, '.test-login.txt');
    if (!fs.existsSync(loginFile)) { console.log('No login file; skipped enquiries/content/catalogue demo data.'); return; }
    const [u, p] = fs.readFileSync(loginFile, 'utf8').split('\n').slice(0, 2).map(l => l.split(': ')[1].trim());
    const lr = await fetch(`${BASE}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) });
    if (!lr.ok) { console.log('Login failed; skipped app-level demo data.'); return; }
    const cookie = lr.headers.get('set-cookie').split(';')[0];
    const call = (m, url, body) => fetch(BASE + url, { method: m, headers: { 'Content-Type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined }).then(r => r.json().catch(() => ({})));

    // publish tiles on the website
    for (const x of PRODUCTS.filter(p => p[9])) await call('PUT', `/api/catalogue-web/${x[0]}`, { size_cm: x[9], finish: x[10], use: x[11], published: true });
    // enquiries
    if (((await call('GET', '/api/enquiries')) || []).length === 0) {
        for (const [channel, status, interest] of [['tiktok', 'won', 'floor tile 60x60'], ['tiktok', 'quoted', 'bathroom wall tile'], ['walk-in', 'won', 'basin and tap'], ['whatsapp', 'new', 'shower set'], ['facebook', 'lost', 'wood look tile'], ['tiktok', 'new', 'price per sqm']]) {
            const e = await call('POST', '/api/enquiries', { channel, product_interest: interest, how_found_us: channel === 'tiktok' ? 'saw a video' : '' });
            if (status !== 'new' && e.id) await call('PUT', `/api/enquiries/${e.id}/status`, { status });
        }
    }
    await call('POST', '/api/content-posts/plan-week', { week_of: new Date().toISOString().slice(0, 10) });
    await call('POST', '/api/branches', { name: 'Thihariya (main shop)' });
    await call('POST', '/api/policy-notes', { date: new Date().toISOString().slice(0, 10), topic: 'cess', summary: 'Demo note: check the current cess on imported tiles before quoting.', price_risk: 'high' });
    await call('POST', '/api/agent-brain/draft', { channel: 'whatsapp', customer_ref: '0771234567', incoming_text: 'Do you have item 1001 in stock?' });
    await call('POST', '/api/agent-brain/draft', { channel: 'whatsapp', customer_ref: '0712223334', incoming_text: 'Can I get 20% off item 1002?' });
    console.log('demo data for the new tabs added');
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
