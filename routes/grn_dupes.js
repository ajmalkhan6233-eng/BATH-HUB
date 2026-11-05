// "Double-counted GRN" check + fix (owner only). Pattern: a vendor BILL has its own GRN lines, AND the same goods were entered earlier as
// other GRN numbers that have no bill (e.g. MG-20261009-01 + -02 = bill ME2026/1757). Those extra GRNs add the goods to stock twice.
// GET  /grn-dupes        -> shows the plan, changes nothing
// POST /grn-dupes/fix    -> {numbers:[...]} archives those GRN lines (table grn_records_archive, nothing is lost) and takes the quantities back out of stock.
// Safe: every line must match an item by code AND name; stock may not go below 0; otherwise nothing at all is changed.
const express = require('express');
const pool = require('../utils/pool');
const router = express.Router();
const roleOf = req => (req.session && req.session.user && req.session.user.role) || 'staff';
const ownerOnly = (req, res, next) => (['admin', 'owner'].includes(roleOf(req)) ? next() : res.status(403).json({ error: 'Owner only' }));
const key = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^0+(?=\d)/, '');
const r2 = x => Math.round(Number(x || 0) * 100) / 100;

async function plan() {
    const bills = (await pool.query(`SELECT id, vendor_name, bill_no, total FROM vendor_bills WHERE voided=FALSE`)).rows;
    const lines = (await pool.query(`SELECT id, grn_number, supplier_name, item_description, quantity, total_amount FROM grn_records`)).rows;
    const by = {};   // vendor|grnkey -> lines
    for (const l of lines) { const k = String(l.supplier_name || '').toLowerCase() + '|' + key(l.grn_number); (by[k] = by[k] || { number: l.grn_number, vendor: l.supplier_name, rows: [], total: 0 }); by[k].rows.push(l); by[k].total += Number(l.total_amount || 0); }
    const billKeys = new Set(bills.map(b => String(b.vendor_name || '').toLowerCase() + '|' + key(b.bill_no)));
    const out = [];
    for (const b of bills) {
        const own = by[String(b.vendor_name || '').toLowerCase() + '|' + key(b.bill_no)];
        if (!own) continue;
        const orphans = Object.entries(by).filter(([k, g]) => k.startsWith(String(b.vendor_name || '').toLowerCase() + '|') && !billKeys.has(k));
        const n = orphans.length, pick = [];
        for (let m = 1; m < (1 << Math.min(n, 8)); m++) {
            const set = orphans.slice(0, 8).filter((_, i) => m & (1 << i)).map(x => x[1]);
            if (set.length < 1 || set.length > 3) continue;
            const tot = set.reduce((s, g) => s + g.total, 0), cnt = set.reduce((s, g) => s + g.rows.length, 0);
            if (r2(tot) === r2(b.total) && cnt === own.rows.length) { pick.push(set); }
        }
        if (pick.length === 1) out.push({ bill_no: b.bill_no, vendor: b.vendor_name, total: Number(b.total), duplicate_numbers: pick[0].map(g => g.number), lines: pick[0].reduce((s, g) => s + g.rows.length, 0) });
    }
    return out;
}

router.get('/grn-dupes', ownerOnly, async (req, res) => {
    try { res.json({ found: await plan() }); } catch (e) { res.status(500).json({ error: 'Could not check: ' + e.message }); }
});

// The fix itself (also used by the morning job). Throws {status,message}; returns {lines, items}.
async function fixDupes(nums) {
    nums = (nums || []).map(String);
    if (!nums.length) throw Object.assign(new Error('Nothing chosen'), { status: 400 });
    const client = await pool.connect();
    try {
        const allowed = new Set((await plan()).flatMap(p => p.duplicate_numbers.map(String)));
        if (nums.some(n => !allowed.has(n))) throw Object.assign(new Error('That GRN is not a double-counted one. Nothing was changed.'), { status: 400 });
        await client.query('BEGIN');
        await client.query(`CREATE TABLE IF NOT EXISTS grn_records_archive (LIKE grn_records INCLUDING DEFAULTS)`);
        await client.query(`ALTER TABLE grn_records_archive ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NOW()`);
        await client.query(`ALTER TABLE grn_records_archive ADD COLUMN IF NOT EXISTS archived_reason TEXT`);
        const rows = (await client.query(`SELECT * FROM grn_records WHERE grn_number = ANY($1::text[]) FOR UPDATE`, [nums])).rows;
        const adj = []; let clamped = 0;
        for (const l of rows) {
            const m = /^\s*([A-Za-z0-9-]+)\s+-\s+(.*)$/.exec(String(l.item_description || ''));
            if (!m) throw Object.assign(new Error('Line "' + l.item_description + '" has no item code, cannot undo its stock'), { status: 409 });
            const p = (await client.query(`SELECT id, name, stock_level FROM products WHERE item_code=$1 FOR UPDATE`, [m[1]])).rows[0];
            if (!p || String(p.name).trim().toLowerCase() !== m[2].trim().toLowerCase()) throw Object.assign(new Error('Item ' + m[1] + ' does not match "' + m[2] + '" any more. Nothing was changed.'), { status: 409 });
            // Stock may not go below 0: take back only what is still there (the duplicate goods were already counted out or sit on the bill's own item).
            const have = Math.max(0, Number(p.stock_level || 0)), take = Math.min(have, Number(l.quantity || 0));
            if (take < Number(l.quantity || 0) - 0.0001) clamped++;
            adj.push({ id: p.id, qty: take });
        }
        for (const a of adj) await client.query(`UPDATE products SET stock_level = stock_level - $1 WHERE id=$2`, [a.qty, a.id]);
        await client.query(`INSERT INTO grn_records_archive SELECT g.*, NOW(), 'double-counted: same goods as a vendor bill' FROM grn_records g WHERE g.grn_number = ANY($1::text[])`, [nums]);
        await client.query(`DELETE FROM grn_records WHERE grn_number = ANY($1::text[])`, [nums]);
        await client.query('COMMIT');
        return { lines: rows.length, items: adj.length, clamped };
    } catch (e) { try { await client.query('ROLLBACK'); } catch (x) { /* ignore */ } throw e; } finally { client.release(); }
}
router.post('/grn-dupes/fix', ownerOnly, express.json(), async (req, res) => {
    try { const r = await fixDupes((req.body || {}).numbers); res.json({ ok: true, ...r }); }
    catch (e) { res.status(e.status || 500).json({ error: e.status ? e.message : 'Could not fix (nothing changed): ' + e.message }); }
});
module.exports = router;
module.exports.plan = plan;
module.exports.fixDupes = fixDupes;
