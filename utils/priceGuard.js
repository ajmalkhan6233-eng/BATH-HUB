'use strict';
// Price guard (AJ 8 Nov 2026). The browser says what price a line sold at; the server must not just believe it.
// A line is "too low" when its price after the bill discount is under the floor:
//   floor = selling price x (1 - owner's max discount %)     when the owner has set a discount rule
//   floor = average cost                                     when there is no rule (never sell below cost silently)
// A price of 0 is always too low. Lines with no item code are only checked for 0.
// Returns the first bad line, or null. If the products table cannot be read, no line is blocked (never stop a sale on a lookup error).
const EPS = 0.01;
async function findBadPrice(query, lines, pct, capPct) {
    const eff = 1 - (Number(pct) || 0) / 100;
    for (const l of lines) {
        const price = l.unit_price * eff;
        if (l.unit_price === 0) return { line: l, price, floor: 0.01, reason: 'zero' };
        if (!l.item_code) continue;
        let p;
        try {
            const r = await query(`SELECT selling_price, avg_cost FROM products WHERE item_code = $1 AND active = true ORDER BY id LIMIT 1`, [l.item_code]);
            p = r.rows[0];
        } catch (e) { return null; }
        if (!p) continue;
        const sp = Number(p.selling_price) || 0, ac = Number(p.avg_cost) || 0;
        let floor = 0;
        if (capPct !== null && capPct !== undefined && sp > 0) floor = sp * (1 - Number(capPct) / 100);
        else if (ac > 0) floor = ac;
        if (floor > 0 && price < floor - EPS) return { line: l, price, floor, reason: 'low' };
    }
    return null;
}
module.exports = { findBadPrice };
