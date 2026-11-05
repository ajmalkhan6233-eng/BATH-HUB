'use strict';
// Fazaal bills were saved while the items 059-098 were still empty placeholders, so the app made NEW items (200+) with the real stock.
// This gives each new item the placeholder's number (the one AJ typed) and retires the empty placeholder. Stock, prices and bills are not touched.
// plan() changes nothing. apply() makes a backup table first and logs through item_code_renumber_log (Undo works for the code move).
const R = require('../scripts/renumber_item_codes');
const clean = s => String(s || '').replace(/\?/g, '').replace(/\s+/g, ' ').trim();
const DEAD = /^(OLD|TBD|DUP)-/;

async function plan(db, extra) {
    const prods = (await db.query(`SELECT id, item_code, name, COALESCE(stock_level,0) AS st, active FROM products`)).rows;
    const tabs = await R.codeTables(db), pairs = [], problems = [], skipped = [];
    for (const x of (extra || [])) {
        const ph = prods.find(p => p.item_code === String(x.code));
        if (!ph) { skipped.push(x.code + ' not found (already merged?)'); continue; }
        const names = new Set([String(x.from || '').toLowerCase(), clean(x.name).toLowerCase(), ph.name.toLowerCase()].filter(Boolean));
        const fresh = prods.filter(p => p.id !== ph.id && !DEAD.test(p.item_code) && p.active !== false && names.has(p.name.toLowerCase()) && Number(p.item_code) > Number(ph.item_code));
        if (!fresh.length) { skipped.push(x.code + ' no new twin (nothing to merge)'); continue; }
        if (fresh.length > 1) { problems.push(x.code + ': ' + fresh.length + ' possible twins'); continue; }
        if (Number(ph.st) !== 0) { problems.push(x.code + ': placeholder has stock ' + ph.st); continue; }
        let refs = 0; for (const t of tabs) refs += Number((await db.query(`SELECT COUNT(*)::int n FROM ${t} WHERE item_code=$1`, [ph.item_code])).rows[0].n);
        if (refs) { problems.push(x.code + ': placeholder is used in ' + refs + ' rows'); continue; }
        pairs.push({ code: ph.item_code, ph_id: ph.id, twin_code: fresh[0].item_code, twin_id: fresh[0].id, twin_stock: fresh[0].st, name: clean(x.name) });
    }
    return { pairs, problems, skipped };
}
async function apply(pool, opts = {}) {
    const c = await pool.connect();
    try {
        const P = await plan(c, opts.extra); if (P.problems.length) return { ok: false, error: P.problems[0] + '. Nothing was changed.' };
        if (!P.pairs.length) return { ok: true, merged: 0, skipped: P.skipped };
        const ts = String(Date.now());
        await c.query(`CREATE TABLE products_bak_dupemerge_${ts} AS SELECT * FROM products`);
        await c.query('BEGIN');
        try { for (const p of P.pairs) await c.query(`UPDATE products SET item_code='DUP-'||item_code, active=false WHERE id=$1`, [p.ph_id]); await c.query('COMMIT'); }
        catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; }
        try {
            const r = await R.apply(c, P.pairs.map(p => ({ old: p.twin_code, new: p.code, changed: true, name: p.name, vendor: 'dupe-merge' })));
            for (const p of P.pairs) await c.query(`UPDATE products SET name=$2 WHERE id=$1`, [p.twin_id, p.name]);
            return { ok: true, merged: P.pairs.length, backup_table: 'products_bak_dupemerge_' + ts, run: r.run, skipped: P.skipped };
        } catch (e) {
            for (const p of P.pairs) await c.query(`UPDATE products SET item_code=$2, active=true WHERE id=$1 AND item_code=$3`, [p.ph_id, p.code, 'DUP-' + p.code]);
            return { ok: false, error: 'Nothing was changed: ' + e.message };
        }
    } finally { c.release(); }
}
module.exports = { plan, apply };
