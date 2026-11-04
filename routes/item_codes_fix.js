'use strict';
// ITEM CODE FIX (Ajmal 4 Nov 2026): Metro items keep their automatic codes (001...), Leo's items get EXACTLY the codes he typed in the
// Leo GRN (0065, 0066 ... 0101), every other item gets a "TBD-<id>" placeholder until he gives its code (item window, "Our item code").
// GET  /item-codes-fix/plan   -> what would change (changes nothing)
// POST /item-codes-fix/apply  -> does it in ONE transaction; every old code is logged (item_code_renumber_log), so "Undo last code change" puts it back.
// Items are matched to GRN lines by NAME (the code text in a GRN line can be out of step with the item list). Stock, prices and bills follow the code.
const express = require('express');
const pool = require('../utils/pool');
const R = require('../scripts/renumber_item_codes');
const router = express.Router();
const admin = (req, res, next) => (req.session && req.session.user && ['admin', 'owner'].includes(req.session.user.role)) ? next() : res.status(403).json({ error: 'Owner only' });
router.use('/item-codes-fix', admin);
const lc = x => String(x || '').trim().toLowerCase();

// After any code change: every GRN line's "CODE - name" text is re-stamped from the item list by NAME, so a line can never point at another item's code.
async function restamp(db) {
    await db.query(`UPDATE grn_records g SET item_description = p.item_code || ' - ' || p.name
        FROM (SELECT DISTINCT ON (lower(name)) lower(name) AS k, item_code, name FROM products ORDER BY lower(name), id) p
        WHERE g.item_description LIKE '% - %' AND lower(substr(g.item_description, position(' - ' in g.item_description) + 3)) = p.k
          AND split_part(g.item_description, ' - ', 1) <> p.item_code`);
}
async function plan(db) {
    const prods = (await db.query(`SELECT id, item_code, name, active FROM products ORDER BY id`)).rows;
    const byName = new Map();
    for (const p of prods) { const k = lc(p.name); if (!byName.has(k)) byName.set(k, p); }
    const grn = (await db.query(`SELECT supplier_name, item_description FROM grn_records WHERE item_description LIKE '% - %' ORDER BY id`)).rows;
    const metro = new Set(), leo = new Map();   // leo: product id -> typed code
    for (const g of grn) {
        const d = String(g.item_description), i = d.indexOf(' - '), code = d.slice(0, i).trim(), name = d.slice(i + 3).trim();
        const p = byName.get(lc(name)); if (!p) continue;
        if (/metro/i.test(g.supplier_name || '')) metro.add(p.id);
        else if (/\bleo\b/i.test(g.supplier_name || '') && code && !leo.has(p.id)) leo.set(p.id, code);
    }
    const problems = [], target = new Map();   // product id -> final code
    for (const p of prods) {
        if (metro.has(p.id)) target.set(p.id, p.item_code);
        else if (leo.has(p.id)) target.set(p.id, leo.get(p.id));
        else target.set(p.id, 'TBD-' + p.id);
    }
    const seen = new Map();
    for (const p of prods) { const c = target.get(p.id); if (seen.has(c)) problems.push('Code ' + c + ' would be used by two items: "' + seen.get(c) + '" and "' + p.name + '"'); else seen.set(c, p.name); }
    const olds = new Map(); for (const p of prods) { if (olds.has(p.item_code)) problems.push('Two items already share the code ' + p.item_code + ' ("' + olds.get(p.item_code) + '", "' + p.name + '"). Fix that first.'); else olds.set(p.item_code, p.name); }
    const map = prods.map(p => ({ id: p.id, old: p.item_code, new: target.get(p.id), name: p.name, vendor: metro.has(p.id) ? 'Metro' : leo.has(p.id) ? 'Leo' : 'other', changed: p.item_code !== target.get(p.id) }));
    const metroCodes = map.filter(m => m.vendor === 'Metro').map(m => m.new).filter(c => /^\d+$/.test(c)).map(Number);
    const leoCodes = map.filter(m => m.vendor === 'Leo').map(m => m.new).filter(c => /^\d+$/.test(c)).map(Number);
    if (metroCodes.length && leoCodes.length && Math.max(...metroCodes) >= Math.min(...leoCodes)) problems.push('Metro codes run up to ' + Math.max(...metroCodes) + ' but Leo starts at ' + Math.min(...leoCodes) + ': they overlap. Tell Claude.');
    return { map, problems, metro: { count: metroCodes.length, last: metroCodes.length ? Math.max(...metroCodes) : null },
             leo: { count: map.filter(m => m.vendor === 'Leo').length, first: leoCodes.length ? Math.min(...leoCodes) : null, last: leoCodes.length ? Math.max(...leoCodes) : null },
             other: map.filter(m => m.vendor === 'other').length };
}

router.get('/item-codes-fix/plan', async (req, res) => {
    try {
        const p = await plan(pool);
        res.json({ metro: p.metro, leo: p.leo, other: p.other, will_change: p.map.filter(m => m.changed).length, problems: p.problems,
            sample: p.map.filter(m => m.changed).slice(0, 12).map(m => ({ vendor: m.vendor, old: m.old, new: m.new, name: m.name })) });
    } catch (e) { res.status(500).json({ error: 'Could not check: ' + e.message }); }
});
router.post('/item-codes-fix/apply', async (req, res) => {
    const c = await pool.connect();
    try {
        const p = await plan(c);
        if (p.problems.length) return res.status(409).json({ error: p.problems[0] + ' Nothing was changed.' });
        const n = p.map.filter(m => m.changed).length;
        if (!n) return res.json({ ok: true, changed: 0, message: 'Codes are already right. Nothing to change.' });
        await c.query(`CREATE TABLE IF NOT EXISTS products_bak_codefix AS SELECT * FROM products WHERE FALSE`);
        await c.query(`DELETE FROM products_bak_codefix; INSERT INTO products_bak_codefix SELECT * FROM products`);
        const r = await R.apply(c, p.map);
        await restamp(c);
        res.json({ ok: true, changed: r.changed, message: r.changed + ' item codes fixed: Metro ' + p.metro.count + ' (up to ' + p.metro.last + '), Leo ' + p.leo.count + ' (' + p.leo.first + ' to ' + p.leo.last + '), others ' + p.other + ' now say TBD-... until you give their code.' });
    } catch (e) { res.status(500).json({ error: 'Nothing was changed: ' + e.message }); } finally { c.release(); }
});
module.exports = router;
module.exports.restamp = restamp;
