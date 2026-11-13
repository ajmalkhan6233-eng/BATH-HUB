'use strict';
// Fill EMPTY selling prices (null or 0) from what the app already saved. Never touches a price that is already set.
//   node scripts/recover_selling_prices.js            DRY RUN: prints counts, writes data/price_recovery.csv, changes NOTHING
//   node scripts/recover_selling_prices.js --apply    fills the empty ones (one transaction), logs each in price_history
// Sources, best first: (1) the "sell" price AJ typed on a GRN line (grn_bill_extra, newest bill wins, matched by item name),
//                      (2) the last non-zero price in price_history.
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const pool = require('../utils/pool');
const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
(async () => {
    const c = await pool.connect();
    try {
        const prods = (await c.query(`SELECT id, item_code, name, selling_price, avg_cost, active FROM products WHERE active = true`)).rows;
        const empty = prods.filter(p => !(Number(p.selling_price) > 0));
        const byName = new Map(), byCode = new Map();
        let extra = []; try { extra = (await c.query(`SELECT bill_id, lines FROM grn_bill_extra ORDER BY bill_id ASC`)).rows; } catch (e) { extra = []; }
        extra.forEach(r => (r.lines || []).forEach(l => { const s = Number(l.sell); if (s > 0 && l.name) byName.set(norm(l.name), { price: s, src: 'GRN line, bill ' + r.bill_id }); }));
        let hist = []; try { hist = (await c.query(`SELECT item_code, new_price FROM price_history WHERE reason LIKE 'selling_price%' AND new_price > 0 ORDER BY id ASC`)).rows; } catch (e) { hist = []; }
        hist.forEach(h => byCode.set(String(h.item_code), { price: Number(h.new_price), src: 'price history' }));
        const fill = [], still = [];
        empty.forEach(p => {
            const f = byName.get(norm(p.name)) || byCode.get(String(p.item_code));
            if (f) fill.push({ p, price: f.price, src: f.src }); else still.push(p);
        });
        const dir = path.join(__dirname, '..', 'data'); fs.mkdirSync(dir, { recursive: true });
        const rows = fill.map(x => [x.p.item_code, x.p.name, x.price, x.src]).concat(still.map(p => [p.item_code, p.name, '', 'NOT FOUND']));
        fs.writeFileSync(path.join(dir, 'price_recovery.csv'), 'code,name,price,source\n' + rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n'));
        console.log('Active items:', prods.length, '| empty selling price:', empty.length, '| can be filled:', fill.length, '| still empty:', still.length);
        const bySrc = {}; fill.forEach(x => { const k = x.src.startsWith('GRN') ? 'GRN lines' : 'price history'; bySrc[k] = (bySrc[k] || 0) + 1; });
        console.log('Found in:', JSON.stringify(bySrc), '| list: data/price_recovery.csv');
        if (!process.argv.includes('--apply')) { console.log('DRY RUN: nothing was changed. Add --apply to fill them.'); return; }
        await c.query('BEGIN');
        try {
            for (const x of fill) {
                await c.query(`UPDATE products SET selling_price = $1 WHERE id = $2 AND COALESCE(selling_price, 0) = 0`, [x.price, x.p.id]);
                try { await c.query(`INSERT INTO price_history (item_code, old_price, new_price, changed_by, reason) VALUES ($1,$2,$3,'recovery','selling_price: recovered 13 Nov from ' || $4::text)`, [String(x.p.item_code), x.p.selling_price, x.price, x.src]); } catch (e) { /* history is a nicety */ }
            }
            await c.query('COMMIT'); console.log('APPLIED:', fill.length, 'selling prices filled. Prices that were already set were not touched.');
        } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; }
    } catch (e) { console.error('FAILED:', e.message); process.exitCode = 1; }
    finally { c.release(); await pool.end().catch(() => {}); }
})();
