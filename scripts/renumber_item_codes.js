'use strict';
// Re-number item codes in VENDOR ARRIVAL ORDER (Ajmal 2026-11-13: Metro, Fazal Hardware = Fawaz, Cool Water, Maheshan Hardware; one 001-onward series, no 4-digit codes like 0070).
// (older note) Metro first (its codes stay as they are),
// then Fazal Hardware, Maheshan, Afam, Imran, Leo. Inside a vendor: order of the first GRN that brought the item.
//   node scripts/renumber_item_codes.js              DRY RUN (default): prints + writes data/item_renumber_plan.csv, changes NOTHING
//   node scripts/renumber_item_codes.js --apply      does it (ONE transaction, all or nothing). Take a backup first (scripts/backup_owner_db.ps1).
//   node scripts/renumber_item_codes.js --undo       puts the previous codes back (reads the log table item_code_renumber_log)
// Old codes are archived in item_code_renumber_log, never deleted. Items with a non-numeric code are left alone.
// Updated everywhere a code is stored: every table with a column named item_code, and the "CODE - name" text in grn_records.item_description.
const fs = require('fs');
const path = require('path');
// 22 Nov (AJ): ONE gapless series 001 to the last, EVERY item (Metro too). Order: items on sale first, then hidden ones;
// inside each, vendor order Metro, Fazal Hardware, Cool Water, Maheshan, Leo, Lucky, Afham, then anything else; inside a vendor, the current code order (fewest changes).
const ORDER = [['Metro', /metro/i], ['Fazal Hardware (Fawaz)', /faz+a+l|fawaz/i], ['Cool Water / Cool Lanka', /cool/i], ['Maheshan Hardware', /mahesh/i], ['Leo', /\bleo\b/i], ['Lucky', /lucky/i], ['Afham', /afh?am/i]];
const pad = (n) => String(n).padStart(3, '0');
const isNum = (c) => /^[0-9]{1,9}$/.test(String(c || ''));

async function plan(db) {
    const prods = (await db.query(`SELECT id, item_code, name, active, preferred_supplier FROM products ORDER BY id`)).rows;
    const first = (await db.query(`SELECT DISTINCT ON (split_part(item_description,' - ',1)) split_part(item_description,' - ',1) AS code, supplier_name, id FROM grn_records WHERE item_description LIKE '% - %' ORDER BY split_part(item_description,' - ',1), id`)).rows;
    const byCode = new Map(first.map(r => [String(r.code).trim(), r]));
    const seenOld = new Set(), left = [], rows = [];
    for (const p of prods) {
        if (seenOld.has(p.item_code)) { left.push({ ...p, why: 'same code as another item' }); continue; }   // never two items on one code
        seenOld.add(p.item_code);
        const g = byCode.get(String(p.item_code)), vendor = (g && g.supplier_name) || p.preferred_supplier || '';
        const idx = vendor ? ORDER.findIndex(o => o[1].test(vendor)) : -1;
        rows.push({ id: p.id, old: p.item_code, name: p.name, active: p.active, vendor: vendor || '(no GRN found)', rank: idx < 0 ? ORDER.length : idx, grn: g ? g.id : 1e12 });
    }
    const num = (c) => (isNum(c) ? Number(c) : 1e12);
    rows.sort((a, b) => (b.active === true) - (a.active === true) || a.rank - b.rank || num(a.old) - num(b.old) || a.grn - b.grn || a.id - b.id);   // inside a vendor: current code order (fewest changes)
    const map = rows.map((r, i) => ({ ...r, new: pad(i + 1), changed: r.old !== pad(i + 1) }));
    return { map, skipped: left, metroCount: rows.filter(r => r.rank === 0).length, activeCount: rows.filter(r => r.active === true).length, nextFree: pad(rows.length + 1) };
}
// 22 Nov (AJ): CODE LOCK. After this, no boot script, audit or screen can change products.item_code; only this script (it unlocks for its own transaction).
const LOCK_SQL = `CREATE OR REPLACE FUNCTION rbh_item_code_lock() RETURNS trigger AS $f$
BEGIN
  IF NEW.item_code IS DISTINCT FROM OLD.item_code AND COALESCE(current_setting('rbh.code_unlock', true), '') <> 'yes' THEN
    RAISE EXCEPTION 'Item codes are locked (AJ 22 Nov). Only scripts/renumber_item_codes.js may change them.';
  END IF;
  RETURN NEW;
END $f$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS rbh_item_code_lock ON products;
CREATE TRIGGER rbh_item_code_lock BEFORE UPDATE OF item_code ON products FOR EACH ROW EXECUTE FUNCTION rbh_item_code_lock();`;
async function lock(db) { await db.query(LOCK_SQL); return true; }
async function codeTables(db) {
    return (await db.query(`SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='item_code' AND table_name<>'products' AND table_name NOT IN ('item_code_renumber_log','item_name_fix_log','audit_baseline') AND table_name NOT LIKE '%\\_bak\\_%' AND table_name NOT LIKE '%\\_bak' ORDER BY 1`)).rows.map(r => r.table_name);
}
async function apply(db, map) {   // db = one connected client
    const ch = map.filter(m => m.changed);
    if (!ch.length) return { changed: 0, tables: [] };
    await db.query(`CREATE TABLE IF NOT EXISTS item_code_renumber_log (id SERIAL PRIMARY KEY, run_id TEXT, old_code TEXT, new_code TEXT, item_name TEXT, vendor TEXT, run_at TIMESTAMPTZ DEFAULT NOW(), undone BOOLEAN DEFAULT FALSE)`);
    const run = 'R' + Date.now();
    await db.query('BEGIN');
    await db.query("SET LOCAL rbh.code_unlock = 'yes'");   // the code lock lets only this transaction through
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
    await db.query("SET LOCAL rbh.code_unlock = 'yes'");   // the code lock lets only this transaction through
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
module.exports = { plan, apply, undo, codeTables, lock, ORDER };

if (require.main === module) {
    require('dotenv').config({ quiet: true });
    const pool = require('../utils/pool');
    (async () => {
        const client = await pool.connect();
        try {
            if (process.argv.includes('--undo')) { console.log('UNDO:', await undo(client)); return; }
            if (process.argv.includes('--lock')) { console.log('CODE LOCK on:', await lock(client)); return; }
            const p = await plan(client);
            const ch = p.map.filter(m => m.changed);
            const seenNum = {}; let fights = 0;   // two codes with the same number (like 070 and 0070) = "fighting"
            (await client.query(`SELECT item_code FROM products WHERE item_code ~ '^[0-9]+$'`)).rows.forEach(r => { const k = String(Number(r.item_code)); seenNum[k] = (seenNum[k] || 0) + 1; });
            Object.keys(seenNum).forEach(k => { if (seenNum[k] > 1) fights++; });
            console.log('Fighting code pairs now (same number, different zeros, like 070 and 0070):', fights);
            const dir = path.join(__dirname, '..', 'data'); fs.mkdirSync(dir, { recursive: true });
            const f = path.join(dir, 'item_renumber_plan.csv');
            fs.writeFileSync(f, 'vendor,old_code,new_code,name,changed\n' + p.map.map(m => [m.vendor, m.old, m.new, m.name, m.changed ? 'YES' : 'same'].map(x => '"' + String(x).replace(/"/g, '""') + '"').join(',')).join('\n') + '\n');
            const per = {}; p.map.forEach(m => { per[m.vendor] = (per[m.vendor] || 0) + 1; });
            console.log('Items:', p.map.length, '| on sale (first):', p.activeCount, '| Metro:', p.metroCount, '| will change:', ch.length, '| left alone (non-digit code):', p.skipped.length, '| next free code after:', p.nextFree);
            console.log('Per vendor:', JSON.stringify(per));
            console.log('Tables that hold item codes:', ['products', ...(await codeTables(client)), 'grn_records.item_description'].join(', '));
            ch.slice(0, 8).forEach(m => console.log('  ', m.old, '->', m.new, m.name, '(' + m.vendor + ')'));
            console.log('Full list:', f);
            if (!process.argv.includes('--apply')) { console.log('DRY RUN: nothing was changed. Add --apply after a backup.'); return; }
            console.log('APPLIED:', await apply(client, p.map));
            console.log('CODE LOCK on:', await lock(client));
        } catch (e) { console.error('FAILED (nothing changed):', e.message); process.exitCode = 1; }
        finally { client.release(); await pool.end().catch(() => {}); }
    })();
}
