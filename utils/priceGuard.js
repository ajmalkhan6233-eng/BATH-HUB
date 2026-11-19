'use strict';
// Price guard (AJ 8 Nov 2026). The browser says what price a line sold at; the server must not just believe it.
// A line is "too low" when its price after the bill discount is under the floor:
//   floor = selling price x (1 - owner's max discount %)     when the owner has set a discount rule
//   floor = average cost                                     when there is no rule (never sell below cost silently)
// Audit E: with a discount rule the floor is the HIGHER of (selling price x (1 - max discount)) and the average cost, so an item priced below cost cannot pass.
// A price of 0 is always too low. A line with no item code (or a code the shop does not know) cannot be checked against a cost, so a big one needs the owner's approval:
// line total after the bill discount above NO_CODE_LIMIT (default Rs 5,000, env PRICE_GUARD_NO_CODE_LIMIT) -> reason 'no_code'.
// Returns the first bad line, or null. If the products table cannot be read, no line is blocked (never stop a sale on a lookup error).
const EPS = 0.01;
const noCodeLimit = () => { const n = Number(process.env.PRICE_GUARD_NO_CODE_LIMIT); return Number.isFinite(n) && n >= 0 ? n : 5000; };
async function findBadPrice(query, lines, pct, capPct, opts = {}) {
    const noCodeOn = !opts.ownerSale;   // the owner is the approver, so only staff sales are held for a big no-code line
    const eff = 1 - (Number(pct) || 0) / 100;
    for (const l of lines) {
        const price = l.unit_price * eff;
        if (l.unit_price === 0) return { line: l, price, floor: 0.01, reason: 'zero' };
        const lineAfter = (Number(l.line_total) || l.unit_price * (Number(l.qty) || 1)) * eff;
        if (!l.item_code) { if (noCodeOn && lineAfter > noCodeLimit()) return { line: l, price, floor: 0, reason: 'no_code' }; continue; }
        let p;
        try {
            const r = await query(`SELECT selling_price, avg_cost FROM products WHERE item_code = $1 AND active = true ORDER BY id LIMIT 1`, [l.item_code]);
            p = r.rows[0];
        } catch (e) { return null; }
        if (!p) { if (noCodeOn && lineAfter > noCodeLimit()) return { line: l, price, floor: 0, reason: 'no_code' }; continue; }
        const sp = Number(p.selling_price) || 0, ac = Number(p.avg_cost) || 0;
        let floor = 0;
        if (capPct !== null && capPct !== undefined && sp > 0) floor = sp * (1 - Number(capPct) / 100);
        floor = Math.max(floor, ac > 0 ? ac : 0);
        if (floor > 0 && price < floor - EPS) return { line: l, price, floor, reason: 'low' };
    }
    return null;
}
module.exports = { findBadPrice };
