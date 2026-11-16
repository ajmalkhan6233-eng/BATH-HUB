'use strict';
// 16 Nov (AJ, from his handwritten paper codes): Metro 001-064 stays. Leo Marketing = 065-103 by the paper. Fazal = 104-143 and 153-157 by the paper (144-152 stay EMPTY on purpose).
// Items are found by NAME (and the vendor of their first GRN), so it does not matter what code they hold today.
// Cool Lanka = 158-170 by the paper. Not on a paper yet (Afham, Imran) are PARKED in the corner after the last code until AJ gives their paper codes. Returned Leo items with no paper code (BIDAY SPRAY BK, TOWEL BAR SINGLE 164) go first in the corner.
// 3 Leo items on the paper (305 hand shower, black square, 006 KD) already sit among the no-GRN leftovers: they get their paper code (created only if missing). BIDAY SPRAY COLOUR (returned) goes to the corner. Their GRN lines are listed at the end for AJ to enter (cost is on the invoice).
//   node scripts/set_vendor_codes.js            DRY RUN (nothing changes)
//   node scripts/set_vendor_codes.js --apply    does it. Undo: node scripts/renumber_item_codes.js --undo   (first delete the 3 new items 065, 071, 072 by name, otherwise undo shows two items on 065)
const { apply } = require('./renumber_item_codes');
const pad = (n) => String(n).padStart(3, '0');
const norm = (s) => String(s || '').toUpperCase().replace(/\s+/g, ' ').trim();
const LEO = [["HAND SHOWER AUSCO", "066"], ["HAND SHOWER SQUARE (BRASCO/CARD)", "067"], ["GULLY COVER POLO", "068"], ["GULLY COVER POP UP HEAVY", "069"], ["ANGLE VALVE LEO TWO WAY", "070"], ["BIDAY SPRAY LEO 002 SQUARE", "073"], ["BIDAY SPRAY SMART IVORY", "074"], ["BIDAY SPRAY SMART BLUE", "075"], ["BIDAY SPRAY SMART PINK", "076"], ["BIDAY SPRAY BK (WATER MASTER)", "RET"], ["BIDAY SPRAY C.P (BRASCO)", "077"], ["BIDAY SPRAY SMART WHITE", "078"], ["ALUMINIUM FRAME MIRROR 70X70CM (GOLD)", "079"], ["ALUMINIUM FRAME MIRROR 60X60CM (SILVER)", "080"], ["MIRROR LEO GX 150 (60X45)", "081"], ["MIRROR LEO GX 156 W/SHELF SQURE", "082"], ["WOODEN FRAME MIRROR GX 167 M", "083"], ["BASIN TAP ZAM", "084"], ["ANGLE VALVE LEVER TYPE LEO", "085"], ["BASIN TAP LEVER TYPE LEO", "086"], ["164 TOWEL BAR SINGLE", "RET"], ["SEAT COVER S/D ROUND (ONE UNIT)", "088"], ["SEAT COVER S/D SQUARE (ONE UNIT)", "089"], ["SEAT COVER HEAVY PINK (ROUND)", "090"], ["SEAT COVER HEAVY IVORY (ROUND)", "091"], ["SEAT COVER HEAVY WHITE (ROUND)", "092"], ["SEAT COVER - PP1 (A-510PP)", "093"], ["SEAT COVER 888 BLACK", "094"], ["SLOW DOWN SQUARE BLUE", "095"], ["SEAT COVER CLASSIC (GRAY)", "096"], ["SEAT COVER CLASSIC (MAROON)", "097"], ["SEAT COVER CLASSIC (BEIGE)", "098"], ["SEAT COVER CLASSIC (BLACK)", "099"], ["SEAT COVER CLASSIC (GREEN)", "100"], ["SHOWER PANEL SET ROSE GOLD", "101"], ["SHOWER PANEL SET MATT (SUS)", "102"], ["SHOWER PANEL SET BLACK", "103"]];
const FAZ = [["FH108-73 GLASS SHELF 50CM", "104"], ["1001 MIRROR FH HY [70x50]", "105"], ["412 MIRROR FH HY [50x70] LED", "106"], ["414 MIRROR FH HY [50x70] LED", "107"], ["367 MIRROR FH HY [60x60] LED", "108"], ["302 MIRROR FH HY [50x70]", "109"], ["FH1312S JET SHOWER 6in NAIL TYPE SQ SILVER", "128"], ["FH25 COMMODE BEND MAGIC LARGE", "129"], ["FH1193S SHOWER SET SILVER", "130"], ["FH1193B SHOWER SET BLACK", "131"], ["FH1193G SHOWER SET GREY", "132"], ["FH1258S RISER PIPE SQ SILVER", "133"], ["FH1257B RISER PIPE BLACK RND", "134"], ["FH1085 K/SINK SILVER BOWL", "135"], ["FH5040 K/SINK BLACK (KNIFE HOLDER DISPENSER)", "136"], ["FH5040 K/SINK SILVER", "137"], ["FH6045 K/SINK BLACK", "138"], ["FH6045 K/SINK SILVER", "139"], ["FH7843 K/SINK BLACK", "140"], ["FH7843 K/SINK SILVER", "141"], ["FH1212-75 ACC SET 7PCS SILVER", "142"], ["FH1214-75 ACC SET 7PCS SILVER", "143"], ["FH1208 SINK TAP FLEXIBLE SQ", "110"], ["FH1125B SINK TAP BLACK", "111"], ["FH1125S SINK TAP NICKEL", "112"], ["FH1307 BIDET SPRAY SILVER", "113"], ["FH1330S BIDET SPRAY SILVER", "114"], ["FH38 GULLY WESDA 6x6", "115"], ["FH1206S GULLY 6x6 SILVER", "116"], ["FH108-48 T/BRUSH HOLDER SQ", "117"], ["FH108-49 T/BRUSH HOLDER RND", "118"], ["FH1240S BASIN TAP SQ SILVER", "119"], ["FH1241S BIB TAP SQ SILVER", "120"], ["FH1242S CON/VALVE SQ SILVER", "121"], ["FH108-56 SOAP HOLDER DOUBLE SILVER", "122"], ["FH108-60 SOAP HOLDER SILVER", "123"], ["FH15 ANGLE VALVE (L/TYPE) BF", "124"], ["FH1062 ANGEL VALVE NICKEL", "125"], ["FH1063 ANGEL VALVE LIGHT", "126"], ["FH108-50 T/BRUSH HOLDER DOUBLE RND", "127"], ["2PCS SET EGO 5063 WHITE [FULL]", "153"], ["2PCS SET EGO FH20 WHITE [FULL ARIYANA]", "154"], ["2PCS SET EGO FH20 IVORY [FULL ARIYANA]", "155"], ["EGO HUILIDA WC DF-8261 WHITE [SQ]", "156"], ["EGO HUILIDA WC DF-8320 WHITE [RND]", "157"]];
const COOL = [["SENTRO COMMODE", "158"], ["AQUA COMMODE", "159"], ["MARVEL COMMODE", "160"], ["HACTOR COMMODE", "161"], ["DELTA BASIN", "162"], ["Shower set (N)", "163"], ["Shower set (P)", "164"], ["Accessories (N)", "165"], ["Wall hung basin JIM", "166"], ["Wall hung basin ETHAN", "167"], ["7019 Table top", "168"], ["4003 Small basin", "169"], ["REPOSE BASIN", "170"]];
const NEW_LEO = [['065', ['HAND SHOWER 305', '305 HAND SHOWER'], 3], ['071', ['BIDAY SPRAY LEO BLACK SQUARE'], 10], ['072', ['BIDAY SPRAY LEO 006 C.P. (KD)', '006 BIDAY SPRAY LEO', '006 BIDAY SPRAY LE0'], 10]];
const RET_FREE = ['BIDAY SPRAY COLOUR'];   // returned Leo item, no paper code, sits among the no-GRN leftovers
const RE = { leo: /\bleo\b/i, faz: /faz+a+l|fawaz/i, cool: /cool/i, park: /afh?am|imran/i };
async function plan(db) {
    const prods = (await db.query(`SELECT id, item_code, name FROM products WHERE item_code ~ '^[0-9]+$' ORDER BY item_code::bigint, id`)).rows;
    const first = (await db.query(`SELECT DISTINCT ON (split_part(item_description,' - ',1)) split_part(item_description,' - ',1) AS code, supplier_name FROM grn_records WHERE item_description LIKE '% - %' ORDER BY split_part(item_description,' - ',1), id`)).rows;
    const ven = new Map(first.map(r => [String(r.code).trim(), r.supplier_name || '']));
    const errs = [], used = new Set(), moved = new Map();
    const find = (name, re) => { const m = prods.filter(p => norm(p.name) === norm(name) && re.test(ven.get(String(p.item_code)) || '') && !used.has(p.id)); if (m.length !== 1) { errs.push(name + ' (' + m.length + ' found)'); return null; } used.add(m[0].id); return m[0]; };
    const rets = [];
    for (const [name, code] of LEO) { const p = find(name, RE.leo); if (!p) continue; if (code === 'RET') rets.push(p); else moved.set(p.id, { p, new: code }); }
    for (const [name, code] of FAZ) { const p = find(name, RE.faz); if (p) moved.set(p.id, { p, new: code }); }
    for (const [name, code] of COOL) { const p = find(name, RE.cool); if (p) moved.set(p.id, { p, new: code }); }
    const asFree = (names) => prods.find(p => !used.has(p.id) && !(ven.get(String(p.item_code)) || '') && names.map(norm).includes(norm(p.name)));
    const create = [];
    for (const [code, names, qty] of NEW_LEO) { const p = asFree(names); if (p) { used.add(p.id); moved.set(p.id, { p, new: code }); } else if (!prods.some(q => names.map(norm).includes(norm(q.name)) && moved.has(q.id) && moved.get(q.id).new === code)) create.push([code, names[0], qty]); }
    for (const nm of RET_FREE) { const p = asFree([nm]); if (p) { used.add(p.id); rets.push(p); } }
    const parked = prods.filter(p => !used.has(p.id) && RE.park.test(ven.get(String(p.item_code)) || ''));
    if (errs.length) throw new Error('could not match: ' + errs.join(' | '));
    const tg = new Set([...moved.values()].map(m => m.new));
    const displaced = prods.filter(p => !used.has(p.id) && !parked.includes(p) && tg.has(p.item_code));   // other items sitting on a code the paper needs (no-GRN leftovers) go to the corner
    const movedIds = new Set([...used, ...parked.map(p => p.id), ...displaced.map(p => p.id)]);

    let n = 324;   // fixed start, so a second run gives the same codes (a clash with another item aborts safely)
    const corner = pad(325);
    for (const p of rets.concat(parked, displaced)) { n++; moved.set(p.id, { p, new: pad(n) }); }
    const map = [...moved.values()].map(({ p, new: nw }) => ({ id: p.id, old: p.item_code, name: p.name, vendor: '(paper codes)', new: nw, changed: p.item_code !== nw }));
    const targets = new Set(map.map(m => m.new)), clash = prods.filter(p => !moved.has(p.id) && targets.has(p.item_code));
    if (clash.length) throw new Error('new codes would clash with other items: ' + clash.slice(0, 4).map(c => c.item_code + ' ' + c.name).join(' | '));
    return { map, create, rets: rets.length, parked: parked.length, displaced: displaced.length, corner };
}
module.exports = { plan };
if (require.main === module) {
    require('dotenv').config({ quiet: true });
    const pool = require('../utils/pool');
    (async () => {
        const c = await pool.connect();
        try {
            const p = await plan(c), ch = p.map.filter(x => x.changed);
            console.log('items to change:', ch.length, '| returned Leo to corner:', p.rets, '| parked (Afham/Imran):', p.parked, '| moved off paper codes:', p.displaced, '| corner starts:', p.corner, '| new items:', p.create.length);
            const keys = ['066', '070', '073', '077', '088', '103', '104', '109', '110', '127', '158', '170', '128', '143', '153', '157'];
            ch.slice().sort((a, b) => Number(a.new) - Number(b.new)).filter((x, i) => i < 2 || keys.includes(x.new) || Number(x.new) >= Number(p.corner)).forEach(x => console.log('  ', x.old, '->', x.new, x.name));
            if (!process.argv.includes('--apply')) { console.log('DRY RUN: nothing changed.'); return; }
            const r = await apply(c, p.map); console.log('APPLIED:', r.changed, 'changed');
            for (const x of p.create) { await c.query(`INSERT INTO products (item_code, name, stock_level, active) VALUES ($1,$2,0,true)`, [x[0], x[1]]); console.log('  created', x[0], x[1]); }
            const bad = (await c.query(`SELECT item_code FROM products WHERE item_code ~ '^[0-9]+$' GROUP BY 1 HAVING count(*)>1`)).rows;
            console.log('Duplicate codes after:', bad.length);
            console.log('GRN TO ENTER in the app (Leo invoice 0000010887, cost is on the invoice):'); NEW_LEO.forEach(x => console.log('  ', x[0], x[1][0], 'qty', x[2]));
        } catch (e) { console.error('FAILED:', e.message); process.exitCode = 1; }
        finally { c.release(); await pool.end().catch(() => {}); }
    })();
}
