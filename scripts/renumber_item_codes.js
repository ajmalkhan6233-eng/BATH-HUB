'use strict';
// Re-number item codes in VENDOR ARRIVAL ORDER (Ajmal 2026-11-04): Metro first (its codes stay as they are),
// then Fazal Hardware, Maheshan, Afam, Imran, Leo. Inside a vendor: order of the first GRN that brought the item.
//   node scripts/renumber_item_codes.js              DRY RUN (default): prints + writes data/item_renumber_plan.csv, changes NOTHING
//   node scripts/renumber_item_codes.js --apply      does it (ONE transaction, all or nothing). Take a backup first (scripts/backup_owner_db.ps1).
//   node scripts/renumber_item_codes.js --undo       puts the previous codes back (reads the log table item_code_renumber_log)
// Old codes are archived in item_code_renumber_log, never deleted. Items with a non-numeric code are left alone.
// Updated everywhere a code is stored: every table with a column named item_code, and the "CODE - name" text in grn_records.item_description.
const fs = require('fs');
const path = require('path');
const ORDER = [['Metro', /metro/i], ['Fazal Hardware', /fazal/i], ['Maheshan', /mahesh/i], ['Afam', /afam/i], ['Imran', /imran/i], ['Leo', /\bleo\b/i]];
const pad = (n) => String(n).padStart(3, '0');
const isNum = (c) => /^[0-9]{1,9}$/.test(String(c || ''));

async function plan(db) {
    const prods = (await db.query(`SELECT id, item_code, name, active FROM products ORDER BY id`)).rows;
    const first = (await db.query(`SELECT DISTINCT ON (split_part(item_description,' - ',1)) split_part(item_description,' - ',1) AS code, supplier_name, id FROM grn_records WHERE item_description LIKE '% - %' ORDER BY split_part(item_description,' - ',1), id`)).rows;
    const byCode = new Map(first.map(r => [String(r.code).trim(), r]));
    const rows = [], skipped = [];
    for (const p of prods) {
        if (!isNum(p.item_code)) { skipped.push({ ...p, why: 'code is not all digits' }); continue; }
        const g = byCode.get(String(p.item_code));
        const idx = g ? ORDER.findIndex(o => o[1].test(g.supplier_name || '')) : -1;
        rows.push({ id: p.id, old: p.item_code, name: p.name, active: p.active, vendor: g ? g.supplier_name : '(no GRN found)', rank: idx < 0 ? ORDER.length : idx, grn: g ? g.id : 1e12 });
    }
    rows.sort((a, b) => a.rank - b.rank || a.grn - b.grn || Number(a.old) - Number(b.old));
    const metro = rows.filter(r => r.rank === 0);
    let n = metro.reduce((m, r) => Math.max(m, Number(r.old)), 0);
    const map = [];
    for (const r of rows) {
        if (r.rank === 0) { map.push({ ...r, new: r.old, changed: false }); continue; }
        n++; map.push({ ...r, new: pad(n), changed: r.old !== pad(n) });
    }
    return { map, skipped, metroCount: metro.length, nextFree: pad(n + 1) };
}
async function codeTables(db) {
    return (await db.query(`SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='item_code' AND table_name<>'products' AND table_name<>'item_code_renumber_log' AND table_name NOT LIKE '%\\_bak\\_%' AND table_name NOT LIKE '%\\_bak' ORDER BY 1`)).rows.map(r => r.table_name);
}
async function apply(db, map) {   // db = one connected client
    const ch = map.filter(m => m.changed);
    if (!ch.length) return { changed: 0, tables: [] };
    await db.query(`CREATE TABLE IF NOT EXISTS item_code_renumber_log (id SERIAL PRIMARY KEY, run_id TEXT, old_code TEXT, new_code TEXT, item_name TEXT, vendor TEXT, run_at TIMESTAMPTZ DEFAULT NOW(), undone BOOLEAN DEFAULT FALSE)`);
    const run = 'R' + Date.now();
    await db.query('BEGIN');
    try {
        await db.query(`CREATE TEMP TABLE cmap (o TEXT PRIMARY KEY, n TEXT) ON COMMIT DROP`);
        for (const m of ch) { await db.query(`INSERT INTO cmap VALUES ($1,$2)`, [m.old, m.new]); await db.query(`INSERT INTO item_code_renumber_log (run_id, old_code, new_code, item_name, vendor) VALUES ($1,$2,$3,$4,$5)`, [run, m.old, m.new, m.name, m.vendor]); }
        const tabs = ['products'].concat(await codeTables(db));
        for (const t of tabs) {   // two steps (via a TMP- prefix) so a new code can never collide with an old one that is still waiting
            await db.query(`UPDATE ${t} x SET item_code='TMP-'||c.n FROM cmap c WHERE x.item_code=c.o`);
            await db.query(`UPDATE ${t} SET item_code=substr(item_code,5) WHERE item_code LIKE 'TMP-%'`);
        }
        await db.query(`UPDATE grn_records g SET item_description='TMP-'||c.n||substr(g.item_description,length(c.o)+1) FROM cmap c WHERE split_part(g.item_description,' - ',1)=c.o`);
        await db.query(`UPDATE grn_records SET item_description=substr(item_description,5) WHERE item_description LIKE 'TMP-%'`);
        await db.query('COMMIT');
    } catch (e) { await db.query('ROLLBACK').catch(() => {}); throw e; }
    return { changed: ch.length, run, tables: ['products', ...(await codeTables(db)), 'grn_records.item_description'] };
}
async function undo(db) {
    const last = (await db.query(`SELECT run_id FROM item_code_renumber_log WHERE undone=FALSE ORDER BY id DESC LIMIT 1`)).rows[0];
    if (!last) return { changed: 0 };
    const rows = (await db.query(`SELECT old_code, new_code FROM item_code_renumber_log WHERE run_id=$1`, [last.run_id])).rows;
    await db.query('BEGIN');
    try {
        await db.query(`CREATE TEMP TABLE cmap (o TEXT PRIMARY KEY, n TEXT) ON COMMIT DROP`);
        for (const r of rows) await db.query(`INSERT INTO cmap VALUES ($1,$2)`, [r.new_code, r.old_code]);
        for (const t of ['products'].concat(await codeTables(db))) {
            await db.query(`UPDATE ${t} x SET item_code='TMP-'||c.n FROM cmap c WHERE x.item_code=c.o`);
            await db.query(`UPDATE ${t} SET item_code=substr(item_code,5) WHERE item_code LIKE 'TMP-%'`);
        }
        await db.query(`UPDATE grn_records g SET item_description='TMP-'||c.n||substr(g.item_description,length(c.o)+1) FROM cmap c WHERE split_part(g.item_description,' - ',1)=c.o`);
        await db.query(`UPDATE grn_records SET item_description=substr(item_description,5) WHERE item_description LIKE 'TMP-%'`);
        await db.query(`UPDATE item_code_renumber_log SET undone=TRUE WHERE run_id=$1`, [last.run_id]);
        await db.query('COMMIT');
    } catch (e) { await db.query('ROLLBACK').catch(() => {}); throw e; }
    return { changed: rows.length, run: last.run_id };
}
module.exports = { plan, apply, undo, codeTables, ORDER };

if (require.main === module) {
    require('dotenv').config({ quiet: true });
    const pool = require('../utils/pool');
    (async () => {
        const client = await pool.connect();
        try {
            if (process.argv.includes('--undo')) { console.log('UNDO:', await undo(client)); return; }
            const p = await plan(client);
            const ch = p.map.filter(m => m.changed);
            const dir = path.join(__dirname, '..', 'data'); fs.mkdirSync(dir, { recursive: true });
            const f = path.join(dir, 'item_renumber_plan.csv');
            fs.writeFileSync(f, 'vendor,old_code,new_code,name,changed\n' + p.map.map(m => [m.vendor, m.old, m.new, m.name, m.changed ? 'YES' : 'same'].map(x => '"' + String(x).replace(/"/g, '""') + '"').join(',')).join('\n') + '\n');
            const per = {}; p.map.forEach(m => { per[m.vendor] = (per[m.vendor] || 0) + 1; });
            console.log('Items:', p.map.length, '| Metro kept as is:', p.metroCount, '| will change:', ch.length, '| left alone (non-digit code):', p.skipped.length, '| next free code after:', p.nextFree);
            console.log('Per vendor:', JSON.stringify(per));
            console.log('Tables that hold item codes:', ['products', ...(await codeTables(client)), 'grn_records.item_description'].join(', '));
            ch.slice(0, 8).forEach(m => console.log('  ', m.old, '->', m.new, m.name, '(' + m.vendor + ')'));
            console.log('Full list:', f);
            if (!process.argv.includes('--apply')) { console.log('DRY RUN: nothing was changed. Add --apply after a backup.'); return; }
            console.log('APPLIED:', await apply(client, p.map));
        } catch (e) { console.error('FAILED (nothing changed):', e.message); process.exitCode = 1; }
        finally { client.release(); await pool.end().catch(() => {}); }
    })();
}
