'use strict';
// 16 Nov (AJ, voice): the 304 SQUARE SOAP DISH belongs in the Metro group at 032. Black soap (now 032) and the items after it shift up by one,
// but only until the first FREE code (a gap) in 032..058, so 058 stays "60X60 ROUND TOUCH MIRROR" when a gap exists. Then every code after the Metro block
// (ME599 ... ME863, then the next vendors) is made continuous from the next number. Same order everywhere, nothing else touched.
//   node scripts/place_soap_dish.js            DRY RUN (nothing changes)
//   node scripts/place_soap_dish.js --apply    does it, one transaction, old codes logged. Undo: node scripts/renumber_item_codes.js --undo
const { apply } = require('./renumber_item_codes');
const pad = (n) => String(n).padStart(3, '0');
const AT = 32, METRO_END = 58;
async function plan(db) {
    const rows = (await db.query(`SELECT id, item_code, name FROM products WHERE item_code ~ '^[0-9]+$' ORDER BY item_code::bigint, id`)).rows;
    const soap = rows.filter(r => /304\s*SQUARE\s*SOAP\s*DISH/i.test(r.name));
    if (soap.length !== 1) throw new Error('expected exactly ONE "304 SQUARE SOAP DISH", found ' + soap.length);
    const s = soap[0];
    const rest = rows.filter(r => r.id !== s.id);
    const byNum = new Map(rest.map(r => [Number(r.item_code), r]));
    const map = [];
    // 1) first free code at or after AT (the soap dish's own old code is already out of the list)
    let g = AT; while (byNum.has(g)) g++;
    const gapUsed = g <= METRO_END;
    let top = 0;                                       // highest Metro code after the move
    for (const r of rest) {
        const c = Number(r.item_code); if (c > METRO_END) continue;
        const nc = (c >= AT && c < g) ? c + 1 : c; top = Math.max(top, nc);
        if (nc !== c) map.push({ id: r.id, old: r.item_code, name: r.name, new: pad(nc) });
    }
    top = Math.max(top, AT);
    map.push({ id: s.id, old: s.item_code, name: s.name, new: pad(AT) });
    // 2) everything after the Metro block, same order, continuous from top+1
    let n = top;
    for (const r of rest.filter(r => Number(r.item_code) > METRO_END)) { n++; map.push({ id: r.id, old: r.item_code, name: r.name, new: pad(n) }); }
    map.forEach(m => { m.vendor = '(soap dish placement)'; m.changed = m.old !== m.new; });
    return { map, gapUsed, gapAt: g, last: pad(n) };
}
module.exports = { plan };
if (require.main === module) {
    require('dotenv').config({ quiet: true });
    const pool = require('../utils/pool');
    (async () => {
        const c = await pool.connect();
        try {
            const p = await plan(c), ch = p.map.filter(x => x.changed);
            console.log('gap used:', p.gapUsed, '| first free code from 032:', pad(p.gapAt), '| changes:', ch.length, '| last code after:', p.last);
            ch.slice().sort((a, b) => Number(a.new) - Number(b.new)).filter((x, i, a) => i < 3 || i >= a.length - 3 || Number(x.new) >= 31 && Number(x.new) <= 35 || Number(x.new) >= 57 && Number(x.new) <= 66).forEach(x => console.log('  ', x.old, '->', x.new, x.name));
            if (!process.argv.includes('--apply')) { console.log('DRY RUN: nothing changed.'); return; }
            console.log('APPLIED:', await apply(c, p.map));
            const bad = (await c.query(`SELECT item_code FROM products WHERE item_code ~ '^[0-9]+$' GROUP BY 1 HAVING count(*)>1`)).rows;
            const chk = (await c.query(`SELECT item_code, name FROM products WHERE item_code IN ('031','032','033','058','059','060','064','065') ORDER BY 1`)).rows;
            console.log('Duplicate codes after:', bad.length); chk.forEach(r => console.log('  ', r.item_code, r.name));
        } catch (e) { console.error('FAILED (nothing changed):', e.message); process.exitCode = 1; }
        finally { c.release(); await pool.end().catch(() => {}); }
    })();
}
