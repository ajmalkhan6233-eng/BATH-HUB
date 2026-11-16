'use strict';
// 16 Nov (AJ): after code 058 the next item is 136. Close the gap: every numeric code above 058 is renumbered 059, 060, 061... in the SAME order, up to the last item.
//   node scripts/close_code_gap.js            DRY RUN (nothing changes), prints first/last rows
//   node scripts/close_code_gap.js --apply    does it (one transaction). Undo: node scripts/renumber_item_codes.js --undo
// Reuses apply() from renumber_item_codes.js: updates every table with item_code + GRN text, old codes logged.
const { apply } = require('./renumber_item_codes');
const pad = (n) => String(n).padStart(3, '0');
const FROM = 59;
async function plan(db) {
    const rows = (await db.query(`SELECT id, item_code, name, active FROM products WHERE item_code ~ '^[0-9]+$' AND item_code::bigint >= $1 ORDER BY item_code::bigint, id`, [FROM])).rows;
    let n = FROM - 1;
    return rows.map(r => { n++; return { id: r.id, old: r.item_code, name: r.name, vendor: '(gap close)', new: pad(n), changed: r.item_code !== pad(n) }; });
}
module.exports = { plan };
if (require.main === module) {
    require('dotenv').config({ quiet: true });
    const pool = require('../utils/pool');
    (async () => {
        const c = await pool.connect();
        try {
            const m = await plan(c), ch = m.filter(x => x.changed);
            console.log('Items from', pad(FROM), ':', m.length, '| will change:', ch.length);
            m.slice(0, 3).concat(m.slice(-3)).forEach(x => console.log('  ', x.old, '->', x.new, x.name));
            if (!process.argv.includes('--apply')) { console.log('DRY RUN: nothing changed.'); return; }
            console.log('APPLIED:', await apply(c, m));
            const bad = (await c.query(`SELECT item_code, count(*) FROM products WHERE item_code ~ '^[0-9]+$' GROUP BY 1 HAVING count(*)>1`)).rows;
            console.log('Duplicate codes after:', bad.length);
        } catch (e) { console.error('FAILED (nothing changed):', e.message); process.exitCode = 1; }
        finally { c.release(); await pool.end().catch(() => {}); }
    })();
}
