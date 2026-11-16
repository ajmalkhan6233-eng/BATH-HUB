'use strict';
// 16 Nov (AJ, voice): Leo Marketing is the SECOND vendor: its items start right after Metro (065), in their current order; the other vendors follow in their current order.
// Items with no GRN (the leftover letter-code ones) are not touched. Same safe apply() as the other renumber scripts (one transaction, old codes logged).
//   node scripts/move_leo_second.js            DRY RUN
//   node scripts/move_leo_second.js --apply    does it. Undo: node scripts/renumber_item_codes.js --undo
const { apply } = require('./renumber_item_codes');
const pad = (n) => String(n).padStart(3, '0');
const METRO_END = 64;
async function plan(db) {
    const prods = (await db.query(`SELECT id, item_code, name FROM products WHERE item_code ~ '^[0-9]+$' ORDER BY item_code::bigint, id`)).rows;
    const first = (await db.query(`SELECT DISTINCT ON (split_part(item_description,' - ',1)) split_part(item_description,' - ',1) AS code, supplier_name FROM grn_records WHERE item_description LIKE '% - %' ORDER BY split_part(item_description,' - ',1), id`)).rows;
    const ven = new Map(first.map(r => [String(r.code).trim(), r.supplier_name || '']));
    const block = prods.filter(p => Number(p.item_code) > METRO_END && ven.has(String(p.item_code)));
    const fixed = prods.filter(p => Number(p.item_code) > METRO_END && !ven.has(String(p.item_code)));
    const isLeo = (p) => /\bleo\b/i.test(ven.get(String(p.item_code)));
    const ordered = block.filter(isLeo).concat(block.filter(p => !isLeo(p)));
    const map = ordered.map((p, i) => ({ id: p.id, old: p.item_code, name: p.name, vendor: '(leo second)', new: pad(METRO_END + 1 + i) }));
    map.forEach(m => { m.changed = m.old !== m.new; });
    const targets = new Set(map.map(m => m.new)); const clash = fixed.filter(p => targets.has(p.item_code));
    if (clash.length) throw new Error('new codes would clash with items that have no GRN: ' + clash.slice(0, 3).map(c => c.item_code).join(','));
    return { map, leo: ordered.filter(isLeo).length };
}
module.exports = { plan };
if (require.main === module) {
    require('dotenv').config({ quiet: true });
    const pool = require('../utils/pool');
    (async () => {
        const c = await pool.connect();
        try {
            const p = await plan(c), ch = p.map.filter(x => x.changed);
            console.log('Leo items:', p.leo, '| changes:', ch.length);
            const f = (x) => console.log('  ', x.old, '->', x.new, x.name);
            ch.slice(0, 7).forEach(f); console.log('   ...'); ch.slice(p.leo - 1, p.leo + 2).forEach(f); ch.slice(-2).forEach(f);
            if (!process.argv.includes('--apply')) { console.log('DRY RUN: nothing changed.'); return; }
            console.log('APPLIED:', (await apply(c, p.map)).changed, 'changed');
            const bad = (await c.query(`SELECT item_code FROM products WHERE item_code ~ '^[0-9]+$' GROUP BY 1 HAVING count(*)>1`)).rows;
            console.log('Duplicate codes after:', bad.length);
        } catch (e) { console.error('FAILED (nothing changed):', e.message); process.exitCode = 1; }
        finally { c.release(); await pool.end().catch(() => {}); }
    })();
}
