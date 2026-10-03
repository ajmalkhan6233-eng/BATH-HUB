// routes/corrections.js
// EDIT + VOID-WITH-REASON for records that could only be added before. Mounted at /api/corrections. ADMIN ONLY.
//   GET  /api/corrections/modules              which modules exist (and what can be edited)
//   GET  /api/corrections/:m                   list (newest first, max 200, voided ones included with voided + void_reason)
//   PUT  /api/corrections/:m/:id               edit whitelisted columns (old row saved to record_history first; refused if voided)
//   POST /api/corrections/:m/:id/void {reason} void (reason >= 3 chars; record is KEPT; 409 if already voided)
//   GET  /api/corrections/:m/:id/history       every edit / void of that record
// Money records are never hard-deleted. New tables only: record_voids, record_history, price_history (nothing existing is altered).
// daily_sales and expenses are GOLDEN-CORE: this module never writes to daily_summary / expenses_detail; it only records a
// void FLAG + reason + snapshot in its own tables and shows the existing figures read-only. Every action also writes admin_audit.
const express = require('express');
const { Pool } = require('pg');
const { ensureAdminAudit, logAdmin, adminOnly } = require('../utils/adminAudit');

const router = express.Router();
const pool = require('../utils/pool');

const ready = (async () => {
    try {
        await ensureAdminAudit(pool);
        await pool.query(`CREATE TABLE IF NOT EXISTS record_voids (
            id SERIAL PRIMARY KEY, module VARCHAR(40), record_id VARCHAR(100), reason TEXT NOT NULL,
            voided_by VARCHAR(100), voided_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(module, record_id))`);
        await pool.query(`CREATE TABLE IF NOT EXISTS record_history (
            id SERIAL PRIMARY KEY, module VARCHAR(40), record_id VARCHAR(100), action VARCHAR(10), changed_by VARCHAR(100),
            changed_at TIMESTAMPTZ DEFAULT NOW(), reason TEXT, old_version JSONB, new_version JSONB)`);
        await pool.query(`CREATE TABLE IF NOT EXISTS price_history (
            id SERIAL PRIMARY KEY, item_code TEXT, old_price NUMERIC, new_price NUMERIC, changed_by VARCHAR(100),
            changed_at TIMESTAMPTZ DEFAULT NOW(), reason TEXT)`);
    } catch (e) { console.error('[corrections] init failed:', e.message); }
})();

// ---- what each module is -------------------------------------------------------------------------------------------
// fields: whitelist of editable columns. t=text, n=number, b=boolean, d=date. req = cannot be blank, min/max for numbers.
const T = (o = {}) => ({ t: 't', max: 300, ...o });
const N = (o = {}) => ({ t: 'n', min: 0, ...o });
const B = () => ({ t: 'b' });
const D = (o = {}) => ({ t: 'd', ...o });

const MODULES = {
    suppliers: { label: 'Vendors', table: 'suppliers', show: ['id', 'name', 'phone', 'category', 'active', 'notes'],
        fields: { name: T({ req: true }), phone: T({ max: 40 }), category: T({ max: 100 }), notes: T({ max: 2000 }), active: B() } },
    stock_items: { label: 'Stock items', table: 'stock_items', show: ['id', 'item_name', 'unit', 'current_qty', 'reorder_level', 'notes'],
        fields: { item_name: T({ req: true }), unit: T({ max: 40 }), current_qty: N({ max: 1e9 }), reorder_level: N({ max: 1e9 }), notes: T({ max: 2000 }) } },
    products: { label: 'Catalogue items', table: 'products', show: ['id', 'item_code', 'name', 'category', 'selling_price', 'avg_cost', 'reorder_threshold', 'active'],
        fields: { name: T({ req: true }), category: T({ max: 100 }), selling_price: N({ max: 1e9 }), avg_cost: N({ max: 1e9 }), reorder_threshold: N({ max: 1e9 }), active: B() } },
    commissions: { label: 'Sale commissions', table: 'sale_commissions', show: ['id', 'staff_id', 'entry_type', 'sale_date', 'amount', 'commission_pct', 'commission_amount', 'notes'],
        fields: { staff_id: N({ int: true, min: 1 }), amount: N({ max: 1e9 }), commission_pct: N({ max: 100 }), notes: T({ max: 2000 }) },
        onlyWhere: { col: 'entry_type', val: 'sale', msg: 'Only an original sale commission can be edited (returns are corrected by a new return entry).' } },
    staff: { label: 'Staff', table: 'staff', show: ['id', 'name', 'role', 'phone', 'active', 'base_salary', 'commission_pct'],
        fields: { name: T({ req: true }), role: T({ max: 60 }), phone: T({ max: 40 }), active: B() } },
    investor_loans: { label: 'Investor loans', table: 'investor_loans', show: ['id', 'lender_name', 'amount', 'profit_rate', 'date_given', 'due_date', 'status', 'notes'],
        fields: null, note: 'Edit a loan with the existing loan screen (PUT /api/investor-loans/:id). Here you can only void it and read its history.' },
    cheques: { label: 'Cheques', table: 'cheque_register', show: ['id', 'cheque_no', 'bank', 'payee', 'amount', 'due_date', 'status', 'notes'],
        fields: { cheque_no: T({ max: 60 }), bank: T({ max: 100 }), payee: T({ max: 150 }), amount: N({ max: 1e10, gt0: true }), due_date: D(), notes: T({ max: 2000 }) },
        touchUpdated: true },
    discount_rules: { label: 'Discount rules', table: 'discount_rules', show: ['id', 'role', 'max_discount_pct', 'active', 'notes'],
        fields: { role: T({ req: true, max: 20 }), max_discount_pct: N({ max: 100 }), active: B(), notes: T({ max: 2000 }) },
        voidSets: { active: false } },
    daily_sales: { label: 'Daily sales', table: 'daily_summary', order: 'report_date DESC, id DESC', golden: true,
        show: ['id', 'report_date', 'total_sale', 'cash_sale', 'card_sale', 'online_sale', 'credit_sale', 'day_status'],
        fields: null, note: 'Golden-core figures: shown read-only here. Numbers are corrected with the existing Daily Sales field edit. You can only flag the day as VOID with a reason.' },
    expenses: { label: 'Expenses', table: 'expenses_detail', order: 'report_date DESC, id DESC', golden: true,
        show: ['id', 'report_date', 'category', 'description', 'amount'],
        fields: null, note: 'Golden-core figures: shown read-only here. Numbers are corrected with the existing Daily Sales field edit. You can only flag the line as VOID with a reason.' },
};

router.use(adminOnly);

function pickModule(req, res) {
    const m = MODULES[req.params.m];
    if (!m) { res.status(404).json({ error: 'Unknown module.' }); return null; }
    return m;
}
function idOf(req, res) {
    const id = String(req.params.id || '');
    if (!/^\d{1,9}$/.test(id)) { res.status(400).json({ error: 'Bad record id.' }); return null; }
    return id;
}
const clean = v => (typeof v === 'string' ? v.trim() : v);
const reasonOf = v => (typeof v === 'string' ? v.trim() : '');

// returns { values, errors } for the whitelisted keys present in body
function validate(m, body) {
    const values = {}, errors = [];
    for (const [k, spec] of Object.entries(m.fields || {})) {
        if (!(k in body)) continue;
        let v = clean(body[k]);
        if (spec.t === 't') {
            if (v === null || v === undefined) v = '';
            if (typeof v !== 'string') { errors.push(`${k} must be text`); continue; }
            if (spec.req && !v) { errors.push(`${k} cannot be blank`); continue; }
            if (v.length > spec.max) { errors.push(`${k} is too long`); continue; }
            values[k] = v === '' ? null : v;
            if (spec.req) values[k] = v;
        } else if (spec.t === 'n') {
            if (v === '' || v === null || typeof v === 'boolean' || !Number.isFinite(Number(v))) { errors.push(`${k} must be a number`); continue; }
            v = Number(v);
            if (spec.int && !Number.isInteger(v)) { errors.push(`${k} must be a whole number`); continue; }
            if (v < (spec.min ?? 0) || (spec.gt0 && v <= 0)) { errors.push(`${k} is too low`); continue; }
            if (spec.max != null && v > spec.max) { errors.push(`${k} is too high`); continue; }
            values[k] = v;
        } else if (spec.t === 'b') {
            if (typeof v === 'boolean') values[k] = v;
            else if (v === 'true' || v === 'false') values[k] = v === 'true';
            else errors.push(`${k} must be true or false`);
        } else if (spec.t === 'd') {
            if (v === '' || v === null) { values[k] = null; continue; }
            if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(Date.parse(v))) { errors.push(`${k} must be a date (YYYY-MM-DD)`); continue; }
            values[k] = v;
        }
    }
    return { values, errors };
}

const sameVal = (a, b) => {
    if (a == null || b == null) return a == b;
    if (a instanceof Date) return a.toISOString().slice(0, 10) === String(b).slice(0, 10);
    if (typeof a === 'number' || typeof b === 'number' || /^-?\d+(\.\d+)?$/.test(String(a))) {
        if (Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && typeof a !== 'boolean') return Number(a) === Number(b);
    }
    return String(a) === String(b);
};

async function inTx(fn) {
    const c = await pool.connect();
    try {
        await c.query('BEGIN');
        const out = await fn(c);
        await c.query('COMMIT');
        return out;
    } catch (e) {
        try { await c.query('ROLLBACK'); } catch (_) { /* ignore */ }
        throw e;
    } finally { c.release(); }
}
const fail = (status, error) => Object.assign(new Error(error), { status });
function sendErr(res, e) {
    if (e && e.status) return res.status(e.status).json({ error: e.message });
    console.error('[corrections]', e.message);
    res.status(500).json({ error: 'Could not complete that.' });
}

// ---- routes --------------------------------------------------------------------------------------------------------
router.get('/modules', (req, res) => {
    res.json(Object.entries(MODULES).map(([key, m]) => ({
        key, label: m.label, golden: !!m.golden, note: m.note || null,
        editable: m.fields ? Object.entries(m.fields).map(([f, s]) => ({ name: f, type: s.t, required: !!s.req })) : [],
        columns: m.show,
    })));
});

router.get('/:m', async (req, res) => {
    const m = pickModule(req, res); if (!m) return;
    try {
        await ready;
        const cols = m.show.map(c => `t.${c}`).join(', ');
        const r = await pool.query(
            `SELECT ${cols}, (v.id IS NOT NULL) AS voided, v.reason AS void_reason, v.voided_by, v.voided_at
               FROM ${m.table} t LEFT JOIN record_voids v ON v.module = $1 AND v.record_id = CAST(t.id AS TEXT)
              ORDER BY ${m.order ? m.order.replace(/(\w+)/g, (w) => (/^(DESC|ASC)$/.test(w) ? w : 't.' + w)) : 't.id DESC'} LIMIT 200`, [req.params.m]);
        res.json({ module: req.params.m, label: m.label, golden: !!m.golden, note: m.note || null, editable: !!m.fields, rows: r.rows });
    } catch (e) { sendErr(res, e); }
});

router.get('/:m/:id/history', async (req, res) => {
    const m = pickModule(req, res); if (!m) return;
    const id = idOf(req, res); if (!id) return;
    try {
        await ready;
        const r = await pool.query(
            `SELECT id, action, changed_by, changed_at, reason, old_version, new_version FROM record_history
              WHERE module = $1 AND record_id = $2 ORDER BY id DESC LIMIT 200`, [req.params.m, id]);
        res.json(r.rows);
    } catch (e) { sendErr(res, e); }
});

router.put('/:m/:id', async (req, res) => {
    const m = pickModule(req, res); if (!m) return;
    const id = idOf(req, res); if (!id) return;
    if (!m.fields) {
        return res.status(403).json({ error: m.golden ? 'These figures are golden-core and cannot be edited here. Use the existing Daily Sales field edit.' : 'This record cannot be edited here. ' + (m.note || '') });
    }
    const body = req.body || {};
    const { values, errors } = validate(m, body);
    if (errors.length) return res.status(400).json({ error: errors.join('; ') });
    if (!Object.keys(values).length) return res.status(400).json({ error: 'Nothing to change.' });
    const reason = reasonOf(body.reason);
    try {
        await ready;
        const out = await inTx(async c => {
            const cur = await c.query(`SELECT * FROM ${m.table} WHERE id = $1 FOR UPDATE`, [id]);
            if (!cur.rows.length) throw fail(404, 'Record not found.');
            const old = cur.rows[0];
            const v = await c.query(`SELECT reason FROM record_voids WHERE module = $1 AND record_id = $2`, [req.params.m, id]);
            if (v.rows.length) throw fail(409, 'This record is voided and cannot be edited.');
            if (m.onlyWhere && old[m.onlyWhere.col] !== m.onlyWhere.val) throw fail(400, m.onlyWhere.msg);
            const changed = Object.keys(values).filter(k => !sameVal(old[k], values[k]));
            if (!changed.length) throw fail(400, 'Nothing changed.');
            const set = {}; changed.forEach(k => { set[k] = values[k]; });
            if (m.table === 'sale_commissions' && ('amount' in set || 'commission_pct' in set)) {
                // same maths as routes/sale_commissions.js (amount x pct / 100, 2 decimals)
                const a = 'amount' in set ? set.amount : Number(old.amount);
                const p = 'commission_pct' in set ? set.commission_pct : Number(old.commission_pct);
                set.commission_amount = Math.round((a * p / 100) * 100) / 100;
            }
            // snapshot BEFORE the update
            await c.query(
                `INSERT INTO record_history (module, record_id, action, changed_by, reason, old_version, new_version) VALUES ($1,$2,'edit',$3,$4,$5,$6)`,
                [req.params.m, id, (req.session.user.username || 'admin'), reason || null, JSON.stringify(old), JSON.stringify({ ...old, ...set })]);
            const keys = Object.keys(set);
            const sql = `UPDATE ${m.table} SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')}${m.touchUpdated ? ', updated_at = NOW()' : ''} WHERE id = $${keys.length + 1} RETURNING *`;
            const upd = await c.query(sql, [...keys.map(k => set[k]), id]);
            if (m.table === 'products') {
                for (const k of ['selling_price', 'avg_cost']) {
                    if (k in set) {
                        await c.query(`INSERT INTO price_history (item_code, old_price, new_price, changed_by, reason) VALUES ($1,$2,$3,$4,$5)`,
                            [old.item_code != null ? String(old.item_code) : id, old[k], set[k], req.session.user.username || 'admin', `${k}${reason ? ': ' + reason : ''}`]);
                    }
                }
            }
            return { row: upd.rows[0], changed };
        });
        await logAdmin(pool, req, 'correction.edit', req.params.m, id, { changed: out.changed, reason: reason || null });
        res.json({ ok: true, row: out.row, changed: out.changed });
    } catch (e) { sendErr(res, e); }
});

router.post('/:m/:id/void', async (req, res) => {
    const m = pickModule(req, res); if (!m) return;
    const id = idOf(req, res); if (!id) return;
    const reason = reasonOf((req.body || {}).reason);
    if (reason.length < 3) return res.status(400).json({ error: 'A reason of at least 3 characters is required.' });
    if (reason.length > 1000) return res.status(400).json({ error: 'The reason is too long.' });
    try {
        await ready;
        await inTx(async c => {
            const cur = await c.query(`SELECT * FROM ${m.table} WHERE id = $1 FOR UPDATE`, [id]);
            if (!cur.rows.length) throw fail(404, 'Record not found.');
            const v = await c.query(`SELECT id FROM record_voids WHERE module = $1 AND record_id = $2`, [req.params.m, id]);
            if (v.rows.length) throw fail(409, 'This record is already voided.');
            const who = req.session.user.username || 'admin';
            await c.query(`INSERT INTO record_voids (module, record_id, reason, voided_by) VALUES ($1,$2,$3,$4)`, [req.params.m, id, reason, who]);
            await c.query(
                `INSERT INTO record_history (module, record_id, action, changed_by, reason, old_version, new_version) VALUES ($1,$2,'void',$3,$4,$5,$6)`,
                [req.params.m, id, who, reason, JSON.stringify(cur.rows[0]), JSON.stringify({ voided: true, reason })]);
            if (m.voidSets && !m.golden) {            // discount rule: 'void' also switches the rule off
                for (const [k, val] of Object.entries(m.voidSets)) await c.query(`UPDATE ${m.table} SET ${k} = $1 WHERE id = $2`, [val, id]);
            }
        });
        await logAdmin(pool, req, 'correction.void', req.params.m, id, { reason });
        res.json({ ok: true, voided: true, reason });
    } catch (e) { sendErr(res, e); }
});

module.exports = router;
