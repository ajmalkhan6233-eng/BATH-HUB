'use strict';
// ITEM CATALOG FIX (Ajmal 5 Nov 2026, from his own words):
//  1) no "?" in item names;  2) the vendor's code is NOT a separate field: it is printed in FRONT of the name (e.g. "FH 1208 Flexible Tap?" -> "FH1208 Flexible Tap", "SQUARE SOAP DISH 304" -> "304 SQUARE SOAP DISH");
//  3) Leo's items get EXACTLY the 4-digit codes he typed in the Leo bill (0065 ...);  4) GRN lines that show OLD-xxx / TBD-xxx get the live item's code.
// Never touches stock, prices, cost or bills' money. plan() changes nothing. apply() backs up first (tables products_bak_catalogfix_<time>, item_name_fix_log, item_code_renumber_log).
const fs = require('fs'), path = require('path');
const R = require('../scripts/renumber_item_codes');
const root = path.resolve(__dirname, '..');
const DEAD = /^(OLD|TBD)-/i, isLive = c => !DEAD.test(String(c || ''));
const clean = s => String(s || '').replace(/\?/g, '').replace(/\s+/g, ' ').trim();
// FRONT RULE (Ajmal 5 Nov 2026, final): the vendor's code is printed in FRONT of the name, like "WT00167 PILLAR SINK TAP MQ203 WTC".
// A code already in front stays. Items with a vendor code in the old separate field get it in front. A model code at the END ("SQUARE SOAP DISH 304") moves to the front.
// Sizes (60X80, 1.5FT, 3 PIN) are never codes. "?" is removed everywhere.
const LEAD = [/^FH\s*\d+/i, /^ME\d+\s+\S/i, /^[A-Za-z]{1,4}\d{3,}[A-Za-z0-9-]*\s+\S/, /^\d{2,3}-\d{1,3}\s+\S/, /^[A-Za-z]{1,2}\d*-\d{1,3}\s+\S/, /^\d{3,4}\s+[A-Za-z(]/];
const TAIL = /^(?:[A-Za-z]{1,2}\d*-\d{1,3}|[A-Za-z]{0,3}\d{3,}[A-Za-z]{0,2})$/;
const NOTCODE = /^\d+(?:X\d+)+$|^\d+(?:MM|CM|IN|FT|MTR|KG|L|W|A|V|M|G)$|^\d+\/\d+/i;
function cleanName(name, vendorCode) {
    let s = clean(name);
    s = s.replace(/^FH\s*(\d+)(?:\s*\(([A-Za-z0-9])\))?/i, (m, d, v) => 'FH' + d + (v ? '(' + v.toUpperCase() + ')' : ''));
    const vc = clean(vendorCode);
    const hasLead = LEAD.some(re => re.test(s));
    if (vc && !hasLead && !s.toLowerCase().startsWith(vc.toLowerCase())) return (vc + ' ' + s.replace(new RegExp('\\s*' + vc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'i'), '')).trim();
    if (!hasLead) {
        const w = s.split(' ');
        if (w.length >= 2) { const last = w[w.length - 1]; if (TAIL.test(last) && !NOTCODE.test(last) && /\d/.test(last)) return (last + ' ' + w.slice(0, -1).join(' ')).trim(); }
    }
    return s;
}
async function leoCodes(db, prods) {   // typed 4-digit codes from saved bill lines, matched to a live item by NAME
    const out = [], skipped = [], seenCode = new Set(), byName = new Map();
    for (const p of prods) if (isLive(p.item_code)) { const k = clean(p.name).toLowerCase(); if (!byName.has(k)) byName.set(k, p); }
    let rows = []; try { rows = (await db.query(`SELECT bill_id, lines FROM grn_bill_extra ORDER BY bill_id`)).rows; } catch (e) { rows = []; }
    for (const r of rows) for (const l of (r.lines || [])) {
        const code = String(l.vendor_code || '').trim(); if (!/^0\d{3}$/.test(code)) continue;
        const p = byName.get(clean(l.name).toLowerCase()) || byName.get(clean(cleanName(l.name)).toLowerCase());
        if (!p) { skipped.push(code + ' ' + l.name + ' (no item with this name)'); continue; }
        if (seenCode.has(code)) { skipped.push(code + ' ' + l.name + ' (code typed twice)'); continue; }
        seenCode.add(code); if (p.item_code !== code) out.push({ id: p.id, old: p.item_code, new: code, name: p.name, vendor: 'Leo', changed: true });
    }
    return { codes: out, skipped };
}
async function plan(db, extra) {
    const prods = (await db.query(`SELECT id, item_code, name, vendor_code FROM products ORDER BY id`)).rows;
    const renames = []; for (const p of prods) { if (!isLive(p.item_code)) continue; const nn = cleanName(p.name, p.vendor_code); if (nn !== p.name || p.vendor_code) renames.push({ id: p.id, code: p.item_code, old: p.name, new: nn, vendor_code: p.vendor_code || null }); }
    // explicit renames chosen from the bill lines (placeholder item -> the exact name on the bill, so saving the bill later adds stock to THIS item)
    for (const x of (extra || [])) { const p = prods.find(q => q.item_code === String(x.code) && isLive(q.item_code)); if (!p) continue; const nn = clean(x.name); const i = renames.findIndex(r => r.id === p.id); const rec = { id: p.id, code: p.item_code, old: p.name, new: nn, vendor_code: p.vendor_code || null }; if (nn === p.name) { if (i >= 0) renames.splice(i, 1); } else if (i >= 0) renames[i] = rec; else renames.push(rec); }
    const L = await leoCodes(db, prods), problems = [];
    const used = new Map(prods.map(p => [p.item_code, p.id])); for (const c of L.codes) { if (used.has(c.new) && used.get(c.new) !== c.id) problems.push('Code ' + c.new + ' is already used by another item'); }
    const dead = (await db.query(`SELECT count(*)::int n FROM grn_records WHERE item_description ~ '^(OLD|TBD)-'`)).rows[0].n;
    return { renames, codes: L.codes, skipped: L.skipped, problems, grn_lines_with_old_codes: dead, products: prods.length };
}
const stamp = async db => db.query(`UPDATE grn_records g SET item_description = p.item_code || ' - ' || p.name
    FROM (SELECT DISTINCT ON (lower(name)) lower(name) AS k, item_code, name FROM products WHERE item_code !~ '^(OLD|TBD)-' ORDER BY lower(name), id) p
    WHERE g.item_description ~ '^(OLD|TBD)-' AND lower(substr(g.item_description, position(' - ' in g.item_description) + 3)) = p.k`);
async function nameTables(db) { return (await db.query(`SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='item_name' AND table_name IN (SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='item_code') AND table_name NOT IN ('products','item_code_renumber_log') ORDER BY 1`)).rows.map(r => r.table_name); }
async function apply(pool, opts = {}) {
    const c = await pool.connect();
    try {
        const P = await plan(c, opts.extra); if (P.problems.length) return { ok: false, error: P.problems[0] + '. Nothing was changed.' };
        const ts = String(Date.now()), run = 'N' + Date.now();
        await c.query('BEGIN');
        await c.query(`CREATE TABLE products_bak_catalogfix_${ts} AS SELECT * FROM products`);
        await c.query(`CREATE TABLE IF NOT EXISTS item_name_fix_log (id SERIAL PRIMARY KEY, run_id TEXT, product_id INT, item_code TEXT, old_name TEXT, new_name TEXT, old_vendor_code TEXT, run_at TIMESTAMPTZ DEFAULT NOW(), undone BOOLEAN DEFAULT FALSE)`);
        await stamp(c);   // 1) GRN lines that show OLD-/TBD- get the live item's code (by the OLD name, before any rename)
        const tabs = await nameTables(c), map = new Map();
        for (const r of P.renames) {   // 2) names
            await c.query(`INSERT INTO item_name_fix_log (run_id, product_id, item_code, old_name, new_name, old_vendor_code) VALUES ($1,$2,$3,$4,$5,$6)`, [run, r.id, r.code, r.old, r.new, r.vendor_code]);
            await c.query(`UPDATE products SET name=$1, vendor_code=NULL WHERE id=$2`, [r.new, r.id]);
            for (const t of tabs) await c.query(`UPDATE ${t} SET item_name=$1 WHERE item_code=$2 AND lower(item_name)=lower($3)`, [r.new, r.code, r.old]);
            await c.query(`UPDATE grn_records SET item_description = $1 || ' - ' || $2 WHERE split_part(item_description,' - ',1)=$1 AND lower(substr(item_description, position(' - ' in item_description)+3))=lower($3)`, [r.code, r.new, r.old]);
            map.set(r.old.toLowerCase(), r.new);
        }
        const ex = (await c.query(`SELECT bill_id, lines FROM grn_bill_extra`)).rows;
        for (const e of ex) { let ch = false; const L = (e.lines || []).map(l => { const n = map.get(String(l.name || '').toLowerCase()); if (n && n !== l.name) { ch = true; return Object.assign({}, l, { name: n }); } return l; }); if (ch) await c.query(`UPDATE grn_bill_extra SET lines=$1::jsonb WHERE bill_id=$2`, [JSON.stringify(L), e.bill_id]); }
        await c.query('COMMIT');
        let codes = { changed: 0 }; if (P.codes.length) codes = await R.apply(c, P.codes);   // 3) Leo's typed codes (own transaction, logged for Undo)
        const live = new Map((await c.query(`SELECT item_code, name FROM products WHERE item_code !~ '^(OLD|TBD)-'`)).rows.map(r => [r.name.toLowerCase(), r.item_code]));
        let files = 0;   // 4) saved bills file: names + empty/OLD/TBD codes
        const f = path.join(root, 'data', 'grn_bills.json');
        if (!opts.noFile && fs.existsSync(f)) { try {
            const list = JSON.parse(fs.readFileSync(f, 'utf8')); fs.copyFileSync(f, f + '.bak_catalogfix_' + ts);
            const cm = new Map(P.codes.map(x => [x.old, x.new]));
            for (const b of list) for (const l of (b.lines || [])) { const n = map.get(String(l.name || '').toLowerCase()); if (n) { l.name = n; files++; } const lc = live.get(String(l.name || '').toLowerCase()); if (lc && (!l.code || DEAD.test(l.code) || cm.has(l.code))) { if (l.code !== lc) files++; l.code = lc; } }
            fs.writeFileSync(f, JSON.stringify(list, null, 1)); } catch (e) { /* the database is fixed; the file is a nicety */ } }
        return { ok: true, renamed: P.renames.length, codes_changed: codes.changed || 0, skipped: P.skipped, backup_table: 'products_bak_catalogfix_' + ts, file_edits: files, run };
    } catch (e) { try { await c.query('ROLLBACK'); } catch (x) { /* ignore */ } return { ok: false, error: 'Nothing was changed: ' + e.message }; } finally { c.release(); }
}
module.exports = { plan, apply, cleanName };
