// ═══════════════════════════════════════════════════════════════════════════
// PURCHASING + ACCOUNTING dormant modules (feature-flagged, OFF by default)
// Own pool, own router — mounted from server.js, does not touch existing routes.
// ═══════════════════════════════════════════════════════════════════════════
const { Pool } = require('pg');
require('dotenv').config();
const express = require('express');
const router = express.Router();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

// Locked formula: net_profit = gross_profit - total_expenses
// cash_out_total = expenses + payments (+ salary + cash_out, matches server.js CASH_OUT_EXPR)
const CASH_OUT_EXPR = `(total_expenses+payments+salary+cash_out-COALESCE(cash_received,0))`;

// Petty cash float rule: a fixed float (PETTY_CASH_FLOAT in .env). TOPUP transactions
// replenish the float and are NEVER treated as an expense. Only EXPENSE rows reduce it.
const PETTY_CASH_FLOAT = parseFloat(process.env.PETTY_CASH_FLOAT || 0);

// ─── Input checks (clear 400s; amounts can't be negative or text, which silently flipped balances) ───
const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v)) && !isNaN(Date.parse(v));
const isPositive = v => v !== '' && v !== null && typeof v !== 'boolean' && Number.isFinite(Number(v)) && Number(v) > 0;
const isNonNegative = v => v !== '' && v !== null && typeof v !== 'boolean' && Number.isFinite(Number(v)) && Number(v) >= 0;

// ═══════════════════════ PURCHASING: PURCHASE ORDERS ═══════════════════════
router.get('/api/purchase-orders', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT po.*, TO_CHAR(po.po_date,'YYYY-MM-DD') as po_date_str,
                   TO_CHAR(po.expected_date,'YYYY-MM-DD') as expected_date_str,
                   g.grn_number as linked_grn_number, g.total_amount as linked_grn_amount
            FROM pur_purchase_orders po
            LEFT JOIN grn_records g ON g.id = po.linked_grn_id
            ORDER BY po.po_date DESC, po.id DESC`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/api/purchase-orders', async (req, res) => {
    const { supplier_id, supplier_name, po_date, expected_date, total_amount, notes } = req.body || {};
    if (!supplier_name) return res.status(400).json({ error: 'supplier_name required' });
    if (total_amount !== undefined && total_amount !== null && !isNonNegative(total_amount)) return res.status(400).json({ error: 'total_amount must be a number, 0 or more' });
    if (po_date && !isDate(po_date)) return res.status(400).json({ error: 'po_date must be a date (YYYY-MM-DD)' });
    if (expected_date && !isDate(expected_date)) return res.status(400).json({ error: 'expected_date must be a date (YYYY-MM-DD)' });
    try {
        const seq = await pool.query(`SELECT COUNT(*)+1 as n FROM pur_purchase_orders`);
        const po_number = 'PO-' + String(seq.rows[0].n).padStart(4, '0');
        const r = await pool.query(`
            INSERT INTO pur_purchase_orders (po_number, supplier_id, supplier_name, po_date, expected_date, total_amount, notes)
            VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [po_number, supplier_id || null, supplier_name, po_date || new Date().toISOString().slice(0,10),
             expected_date || null, total_amount || 0, notes || null]);
        res.status(201).json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/api/purchase-orders/:id', async (req, res) => {
    const { status, linked_grn_id, total_amount, expected_date, notes } = req.body || {};
    if (total_amount !== undefined && total_amount !== null && !isNonNegative(total_amount)) return res.status(400).json({ error: 'total_amount must be a number, 0 or more' });
    if (expected_date && !isDate(expected_date)) return res.status(400).json({ error: 'expected_date must be a date (YYYY-MM-DD)' });
    const sets = [], vals = [];
    if (status !== undefined) { vals.push(status); sets.push(`status=$${vals.length}`); }
    if (linked_grn_id !== undefined) { vals.push(linked_grn_id); sets.push(`linked_grn_id=$${vals.length}`); }
    if (total_amount !== undefined) { vals.push(total_amount); sets.push(`total_amount=$${vals.length}`); }
    if (expected_date !== undefined) { vals.push(expected_date); sets.push(`expected_date=$${vals.length}`); }
    if (notes !== undefined) { vals.push(notes); sets.push(`notes=$${vals.length}`); }
    if (!sets.length) return res.status(400).json({ error: 'nothing to update' });
    sets.push(`updated_at=NOW()`);
    vals.push(req.params.id);
    try {
        const r = await pool.query(`UPDATE pur_purchase_orders SET ${sets.join(', ')} WHERE id=$${vals.length} RETURNING *`, vals);
        if (!r.rows.length) return res.status(404).json({ error: 'PO not found' });
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ PURCHASING: PO ↔ GRN MATCHING ═══════════════════════
// GET-only computed view: for each un-linked PO, suggest GRNs from the same
// supplier within +/- 7 days of the PO date. Manual link is done via PATCH above.
router.get('/api/po-grn-matches', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT po.id as po_id, po.po_number, po.supplier_name, po.po_date, po.total_amount as po_total,
                   po.linked_grn_id,
                   g.id as suggested_grn_id, g.grn_number as suggested_grn_number,
                   g.grn_date as suggested_grn_date, g.total_amount as suggested_grn_amount,
                   ABS(g.grn_date - po.po_date) as day_diff
            FROM pur_purchase_orders po
            LEFT JOIN grn_records g
              ON (g.supplier_name ILIKE po.supplier_name OR g.supplier_id = po.supplier_id)
             AND ABS(g.grn_date - po.po_date) <= 7
            WHERE po.linked_grn_id IS NULL
            ORDER BY po.po_date DESC, day_diff ASC NULLS LAST`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ PURCHASING: SUPPLIER PRICE COMPARISON ═══════════════════════
router.get('/api/supplier-prices', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT *, TO_CHAR(quoted_date,'YYYY-MM-DD') as quoted_date_str
            FROM pur_supplier_prices ORDER BY item_description, unit_cost ASC`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/api/supplier-prices', async (req, res) => {
    const { item_description, supplier_id, supplier_name, unit_cost, quoted_date, notes } = req.body || {};
    if (!item_description || !supplier_name || unit_cost == null)
        return res.status(400).json({ error: 'item_description, supplier_name, unit_cost required' });
    if (!isNonNegative(unit_cost)) return res.status(400).json({ error: 'unit_cost must be a number, 0 or more' });
    if (quoted_date && !isDate(quoted_date)) return res.status(400).json({ error: 'quoted_date must be a date (YYYY-MM-DD)' });
    try {
        const r = await pool.query(`
            INSERT INTO pur_supplier_prices (item_description, supplier_id, supplier_name, unit_cost, quoted_date, notes)
            VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [item_description, supplier_id || null, supplier_name, unit_cost, quoted_date || new Date().toISOString().slice(0,10), notes || null]);
        res.status(201).json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Cheapest supplier per item — computed view
router.get('/api/supplier-prices/best', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT DISTINCT ON (item_description) item_description, supplier_name, unit_cost, quoted_date
            FROM pur_supplier_prices
            ORDER BY item_description, unit_cost ASC, quoted_date DESC`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ PURCHASING: SUPPLIER AGING / PAYABLES ═══════════════════════
// GET-only computed: total owed (GRN receipts) minus total paid (supplier_payments), per supplier,
// aged by the GRN date of the oldest unpaid balance.
router.get('/api/supplier-aging', async (req, res) => {
    try {
        const r = await pool.query(`
            WITH received AS (
                SELECT supplier_id, supplier_name, SUM(total_amount) as total_received, MIN(grn_date) as oldest_grn
                FROM grn_records WHERE supplier_id IS NOT NULL GROUP BY supplier_id, supplier_name
            ), paid AS (
                SELECT supplier_id, SUM(amount) as total_paid FROM supplier_payments GROUP BY supplier_id
            )
            SELECT s.id as supplier_id, s.name as supplier_name,
                   COALESCE(rc.total_received,0) as total_received,
                   COALESCE(p.total_paid,0) as total_paid,
                   COALESCE(rc.total_received,0) - COALESCE(p.total_paid,0) as balance_due,
                   rc.oldest_grn,
                   CASE WHEN rc.oldest_grn IS NULL THEN NULL
                        ELSE (CURRENT_DATE - rc.oldest_grn) END as age_days,
                   CASE
                     WHEN rc.oldest_grn IS NULL THEN 'N/A'
                     WHEN (CURRENT_DATE - rc.oldest_grn) <= 30 THEN '0-30'
                     WHEN (CURRENT_DATE - rc.oldest_grn) <= 60 THEN '31-60'
                     WHEN (CURRENT_DATE - rc.oldest_grn) <= 90 THEN '61-90'
                     ELSE '90+'
                   END as aging_bucket
            FROM suppliers s
            LEFT JOIN received rc ON rc.supplier_id = s.id
            LEFT JOIN paid p ON p.supplier_id = s.id
            WHERE COALESCE(rc.total_received,0) - COALESCE(p.total_paid,0) <> 0
            ORDER BY balance_due DESC`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ PURCHASING: LANDED COST ═══════════════════════
router.get('/api/landed-costs', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT lc.*, po.po_number, po.supplier_name
            FROM pur_landed_costs lc
            LEFT JOIN pur_purchase_orders po ON po.id = lc.po_id
            ORDER BY lc.created_at DESC`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/api/landed-costs', async (req, res) => {
    const { po_id, po_total, freight, duty, other_costs, notes } = req.body || {};
    // A typo like "12O0" used to count as 0 and quietly understate the landed cost.
    for (const [k, v] of [['po_total', po_total], ['freight', freight], ['duty', duty], ['other_costs', other_costs]]) {
        if (v !== undefined && v !== null && v !== '' && !isNonNegative(v)) return res.status(400).json({ error: `${k} must be a number, 0 or more` });
    }
    const f = Number(freight) || 0, d = Number(duty) || 0, o = Number(other_costs) || 0, base = Number(po_total) || 0;
    const total_landed_cost = base + f + d + o;
    try {
        const r = await pool.query(`
            INSERT INTO pur_landed_costs (po_id, po_total, freight, duty, other_costs, total_landed_cost, notes)
            VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [po_id || null, base, f, d, o, total_landed_cost, notes || null]);
        res.status(201).json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ PURCHASING: IMPORT SHIPMENT TRACKER ═══════════════════════
router.get('/api/shipments', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT sh.*, TO_CHAR(sh.eta_date,'YYYY-MM-DD') as eta_date_str, po.po_number
            FROM pur_shipments sh
            LEFT JOIN pur_purchase_orders po ON po.id = sh.po_id
            ORDER BY sh.eta_date ASC NULLS LAST, sh.id DESC`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/api/shipments', async (req, res) => {
    const { shipment_ref, supplier_id, supplier_name, po_id, origin_port, eta_date, notes } = req.body || {};
    if (!supplier_name) return res.status(400).json({ error: 'supplier_name required' });
    try {
        const r = await pool.query(`
            INSERT INTO pur_shipments (shipment_ref, supplier_id, supplier_name, po_id, origin_port, eta_date, notes)
            VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [shipment_ref || null, supplier_id || null, supplier_name, po_id || null, origin_port || null, eta_date || null, notes || null]);
        res.status(201).json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/api/shipments/:id', async (req, res) => {
    const { status, eta_date, notes } = req.body || {};
    const sets = [], vals = [];
    if (status !== undefined) { vals.push(status); sets.push(`status=$${vals.length}`); }
    if (eta_date !== undefined) { vals.push(eta_date); sets.push(`eta_date=$${vals.length}`); }
    if (notes !== undefined) { vals.push(notes); sets.push(`notes=$${vals.length}`); }
    if (!sets.length) return res.status(400).json({ error: 'nothing to update' });
    sets.push('updated_at=NOW()');
    vals.push(req.params.id);
    try {
        const r = await pool.query(`UPDATE pur_shipments SET ${sets.join(', ')} WHERE id=$${vals.length} RETURNING *`, vals);
        if (!r.rows.length) return res.status(404).json({ error: 'Shipment not found' });
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ ACCOUNTING: CHART OF ACCOUNTS ═══════════════════════
router.get('/api/chart-of-accounts', async (req, res) => {
    try {
        const r = await pool.query(`SELECT * FROM acc_chart_of_accounts ORDER BY account_code`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/api/chart-of-accounts', async (req, res) => {
    const { account_code, account_name, account_type, parent_code } = req.body || {};
    if (!account_code || !account_name || !account_type)
        return res.status(400).json({ error: 'account_code, account_name, account_type required' });
    if (!['ASSET','LIABILITY','EQUITY','INCOME','EXPENSE'].includes(account_type))
        return res.status(400).json({ error: 'account_type must be ASSET, LIABILITY, EQUITY, INCOME or EXPENSE' });
    try {
        const r = await pool.query(`
            INSERT INTO acc_chart_of_accounts (account_code, account_name, account_type, parent_code)
            VALUES ($1,$2,$3,$4) RETURNING *`,
            [account_code, account_name, account_type, parent_code || null]);
        res.status(201).json(r.rows[0]);
    } catch (e) {
        if (e.code === '23505') return res.status(409).json({ error: 'account_code already exists' });
        res.status(500).json({ error: e.message });
    }
});

router.patch('/api/chart-of-accounts/:code', async (req, res) => {
    const { account_name, active } = req.body || {};
    const sets = [], vals = [];
    if (account_name !== undefined) { vals.push(account_name); sets.push(`account_name=$${vals.length}`); }
    if (active !== undefined) { vals.push(active); sets.push(`active=$${vals.length}`); }
    if (!sets.length) return res.status(400).json({ error: 'nothing to update' });
    vals.push(req.params.code);
    try {
        const r = await pool.query(`UPDATE acc_chart_of_accounts SET ${sets.join(', ')} WHERE account_code=$${vals.length} RETURNING *`, vals);
        if (!r.rows.length) return res.status(404).json({ error: 'Account not found' });
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ ACCOUNTING: JOURNAL ENTRIES ═══════════════════════
router.get('/api/journal-entries', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT je.*, TO_CHAR(je.entry_date,'YYYY-MM-DD') as entry_date_str,
                   da.account_name as debit_account_name, ca.account_name as credit_account_name
            FROM acc_journal_entries je
            JOIN acc_chart_of_accounts da ON da.account_code = je.debit_account_code
            JOIN acc_chart_of_accounts ca ON ca.account_code = je.credit_account_code
            ORDER BY je.entry_date DESC, je.id DESC LIMIT 500`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/api/journal-entries', async (req, res) => {
    const { entry_date, description, debit_account_code, credit_account_code, amount, reference } = req.body || {};
    if (!description || !debit_account_code || !credit_account_code || !amount)
        return res.status(400).json({ error: 'description, debit_account_code, credit_account_code, amount required' });
    if (debit_account_code === credit_account_code)
        return res.status(400).json({ error: 'debit and credit accounts must differ' });
    if (!isPositive(amount)) return res.status(400).json({ error: 'amount must be a number greater than 0' });
    if (entry_date && !isDate(entry_date)) return res.status(400).json({ error: 'entry_date must be a date (YYYY-MM-DD)' });
    try {
        // Both accounts must exist: an entry on an unknown code vanished from the journal list (inner join)
        // while still counting in other totals.
        const accts = await pool.query(`SELECT account_code FROM acc_chart_of_accounts WHERE account_code IN ($1, $2)`, [debit_account_code, credit_account_code]);
        const known = new Set(accts.rows.map(a => a.account_code));
        for (const code of [debit_account_code, credit_account_code]) {
            if (!known.has(code)) return res.status(400).json({ error: `account ${code} does not exist in the chart of accounts` });
        }
        const r = await pool.query(`
            INSERT INTO acc_journal_entries (entry_date, description, debit_account_code, credit_account_code, amount, reference)
            VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [entry_date || new Date().toISOString().slice(0,10), description, debit_account_code, credit_account_code, amount, reference || null]);
        res.status(201).json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ ACCOUNTING: LEDGER VIEW ═══════════════════════
// GET-only computed: all journal lines touching one account, with a running balance.
router.get('/api/ledger/:account_code', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT entry_date, description, reference,
                   CASE WHEN debit_account_code=$1 THEN amount ELSE 0 END as debit,
                   CASE WHEN credit_account_code=$1 THEN amount ELSE 0 END as credit,
                   TO_CHAR(entry_date,'YYYY-MM-DD') as entry_date_str
            FROM acc_journal_entries
            WHERE debit_account_code=$1 OR credit_account_code=$1
            ORDER BY entry_date ASC, id ASC`, [req.params.account_code]);
        let balance = 0;
        const rows = r.rows.map(row => {
            balance += Number(row.debit) - Number(row.credit);
            return { ...row, running_balance: balance };
        });
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ ACCOUNTING: TRIAL BALANCE ═══════════════════════
// GET-only computed: per account, sum of debits and credits from journal entries.
router.get('/api/trial-balance', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT coa.account_code, coa.account_name, coa.account_type,
                   COALESCE(d.total_debit,0) as total_debit,
                   COALESCE(c.total_credit,0) as total_credit,
                   COALESCE(d.total_debit,0) - COALESCE(c.total_credit,0) as balance
            FROM acc_chart_of_accounts coa
            LEFT JOIN (SELECT debit_account_code as code, SUM(amount) as total_debit FROM acc_journal_entries GROUP BY debit_account_code) d
                   ON d.code = coa.account_code
            LEFT JOIN (SELECT credit_account_code as code, SUM(amount) as total_credit FROM acc_journal_entries GROUP BY credit_account_code) c
                   ON c.code = coa.account_code
            WHERE COALESCE(d.total_debit,0) <> 0 OR COALESCE(c.total_credit,0) <> 0
            ORDER BY coa.account_code`);
        const total_debit = r.rows.reduce((a,x)=>a+Number(x.total_debit),0);
        const total_credit = r.rows.reduce((a,x)=>a+Number(x.total_credit),0);
        res.json({ rows: r.rows, total_debit, total_credit, balanced: Math.abs(total_debit-total_credit) < 0.01 });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ ACCOUNTING: P&L STATEMENT ═══════════════════════
// GET-only computed, built directly from daily_summary — same locked formula:
// net_profit = gross_profit - total_expenses; cash_out_total = expenses+payments(+salary+cash_out).
router.get('/api/pnl', async (req, res) => {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to (YYYY-MM-DD) are required' });
    if (!isDate(from) || !isDate(to)) return res.status(400).json({ error: 'from and to must be dates (YYYY-MM-DD)' });
    try {
        const r = await pool.query(`
            SELECT
                COALESCE(SUM(total_sale),0) as total_sale,
                COALESCE(SUM(gross_profit),0) as gross_profit,
                COALESCE(SUM(total_expenses),0) as total_expenses,
                COALESCE(SUM(gross_profit),0) - COALESCE(SUM(total_expenses),0) as net_profit,
                COALESCE(SUM(${CASH_OUT_EXPR}),0) as cash_out_total,
                COUNT(*) as days_included
            FROM daily_summary
            WHERE report_date BETWEEN $1 AND $2`, [from, to]);
        res.json({ from, to, ...r.rows[0] });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ ACCOUNTING: BALANCE SHEET ═══════════════════════
// GET-only computed, as-of a date: sums journal-entry balances per account, grouped by type.
// Assets/Expenses shown as debit-positive; Liabilities/Equity/Income shown as credit-positive.
router.get('/api/balance-sheet', async (req, res) => {
    const asOf = req.query.as_of || new Date().toISOString().slice(0,10);
    try {
        const r = await pool.query(`
            SELECT coa.account_code, coa.account_name, coa.account_type,
                   COALESCE(d.total_debit,0) - COALESCE(c.total_credit,0) as debit_balance,
                   COALESCE(c.total_credit,0) - COALESCE(d.total_debit,0) as credit_balance
            FROM acc_chart_of_accounts coa
            LEFT JOIN (SELECT debit_account_code as code, SUM(amount) as total_debit FROM acc_journal_entries WHERE entry_date <= $1 GROUP BY debit_account_code) d
                   ON d.code = coa.account_code
            LEFT JOIN (SELECT credit_account_code as code, SUM(amount) as total_credit FROM acc_journal_entries WHERE entry_date <= $1 GROUP BY credit_account_code) c
                   ON c.code = coa.account_code
            WHERE coa.account_type IN ('ASSET','LIABILITY','EQUITY')
            ORDER BY coa.account_code`, [asOf]);
        const assets = r.rows.filter(x=>x.account_type==='ASSET').map(x=>({...x, balance:Number(x.debit_balance)}));
        const liabilities = r.rows.filter(x=>x.account_type==='LIABILITY').map(x=>({...x, balance:Number(x.credit_balance)}));
        const equity = r.rows.filter(x=>x.account_type==='EQUITY').map(x=>({...x, balance:Number(x.credit_balance)}));
        const total_assets = assets.reduce((a,x)=>a+x.balance,0);
        const total_liabilities = liabilities.reduce((a,x)=>a+x.balance,0);
        const total_equity = equity.reduce((a,x)=>a+x.balance,0);
        res.json({ as_of: asOf, assets, liabilities, equity, total_assets, total_liabilities, total_equity,
                   balanced: Math.abs(total_assets - (total_liabilities+total_equity)) < 0.01 });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ ACCOUNTING: VAT/TAX REPORT (Sri Lanka) ═══════════════════════
// Flat placeholder rate (Sri Lanka standard VAT), computed — not fabricated numbers.
// Output VAT from real total_sale (daily_summary); input VAT from real GRN purchase totals.
const VAT_RATE = 0.18; // 18% placeholder — adjust to the rate the business is actually registered for
router.get('/api/vat-report', async (req, res) => {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to (YYYY-MM-DD) are required' });
    if (!isDate(from) || !isDate(to)) return res.status(400).json({ error: 'from and to must be dates (YYYY-MM-DD)' });
    try {
        const [sales, purchases] = await Promise.all([
            pool.query(`SELECT COALESCE(SUM(total_sale),0) as total_sale FROM daily_summary WHERE report_date BETWEEN $1 AND $2`, [from, to]),
            pool.query(`SELECT COALESCE(SUM(total_amount),0) as total_purchases FROM grn_records WHERE grn_date BETWEEN $1 AND $2`, [from, to]),
        ]);
        const totalSale = Number(sales.rows[0].total_sale);
        const totalPurchases = Number(purchases.rows[0].total_purchases);
        // Sale/purchase totals are VAT-inclusive in source data -> back out the VAT component.
        const output_vat = Math.round((totalSale - totalSale/(1+VAT_RATE)) * 100) / 100;
        const input_vat = Math.round((totalPurchases - totalPurchases/(1+VAT_RATE)) * 100) / 100;
        res.json({ from, to, vat_rate: VAT_RATE, total_sale: totalSale, total_purchases: totalPurchases,
                   output_vat, input_vat, net_vat_payable: Math.round((output_vat - input_vat) * 100) / 100 });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ ACCOUNTING: BANK RECONCILIATION ═══════════════════════
router.get('/api/bank-transactions', async (req, res) => {
    try {
        const r = await pool.query(`SELECT *, TO_CHAR(txn_date,'YYYY-MM-DD') as txn_date_str FROM acc_bank_transactions ORDER BY txn_date DESC, id DESC`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/api/bank-transactions', async (req, res) => {
    const { txn_date, description, amount, txn_type, bank_name, notes } = req.body || {};
    if (!txn_date || amount == null || !txn_type) return res.status(400).json({ error: 'txn_date, amount, txn_type required' });
    if (!['CREDIT','DEBIT'].includes(txn_type)) return res.status(400).json({ error: 'txn_type must be CREDIT or DEBIT' });
    if (!isPositive(amount)) return res.status(400).json({ error: 'amount must be a number greater than 0 (use txn_type for the direction)' });
    if (!isDate(txn_date)) return res.status(400).json({ error: 'txn_date must be a date (YYYY-MM-DD)' });
    try {
        const r = await pool.query(`
            INSERT INTO acc_bank_transactions (txn_date, description, amount, txn_type, bank_name, notes)
            VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [txn_date, description || null, amount, txn_type, bank_name || null, notes || null]);
        res.status(201).json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/api/bank-transactions/:id/match', async (req, res) => {
    const { matched, matched_ref } = req.body || {};
    try {
        const r = await pool.query(`UPDATE acc_bank_transactions SET matched=$1, matched_ref=$2 WHERE id=$3 RETURNING *`,
            [!!matched, matched_ref || null, req.params.id]);
        if (!r.rows.length) return res.status(404).json({ error: 'Transaction not found' });
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ ACCOUNTING: POST-DATED CHEQUE CALENDAR ═══════════════════════
// GET-only, queries the real existing `cheques` table by due_date. Alerts = due within N days.
router.get('/api/cheque-calendar', async (req, res) => {
    const withinDays = parseInt(req.query.within_days) || 14;
    try {
        const r = await pool.query(`
            SELECT ch.*, TO_CHAR(ch.due_date,'YYYY-MM-DD') as due_date_str, c.name as customer_name,
                   (ch.due_date - CURRENT_DATE) as days_until_due
            FROM cheques ch
            LEFT JOIN customers c ON c.id = ch.customer_id
            WHERE ch.status = 'pending'
            ORDER BY ch.due_date ASC`);
        const due_soon = r.rows.filter(x => x.days_until_due <= withinDays);
        const overdue = r.rows.filter(x => x.days_until_due < 0);
        res.json({ within_days: withinDays, all: r.rows, due_soon, overdue });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ ACCOUNTING: PETTY CASH (fixed float rule) ═══════════════════════
// The float itself is never an expense. TOPUP replenishes it; only EXPENSE rows reduce balance.
router.get('/api/petty-cash', async (req, res) => {
    try {
        const r = await pool.query(`SELECT *, TO_CHAR(txn_date,'YYYY-MM-DD') as txn_date_str FROM acc_petty_cash_txns ORDER BY txn_date DESC, id DESC`);
        const totals = await pool.query(`
            SELECT
              COALESCE(SUM(amount) FILTER (WHERE txn_type='TOPUP'),0) as total_topups,
              COALESCE(SUM(amount) FILTER (WHERE txn_type='EXPENSE'),0) as total_expenses
            FROM acc_petty_cash_txns`);
        const t = totals.rows[0];
        const current_balance = PETTY_CASH_FLOAT + Number(t.total_topups) - Number(t.total_expenses);
        res.json({ float: PETTY_CASH_FLOAT, total_topups: Number(t.total_topups), total_expenses: Number(t.total_expenses),
                   current_balance, transactions: r.rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/api/petty-cash', async (req, res) => {
    const { txn_date, txn_type, amount, description, category } = req.body || {};
    if (!txn_type || !amount || !description) return res.status(400).json({ error: 'txn_type, amount, description required' });
    if (!['TOPUP','EXPENSE'].includes(txn_type)) return res.status(400).json({ error: 'txn_type must be TOPUP or EXPENSE' });
    if (!isPositive(amount)) return res.status(400).json({ error: 'amount must be a number greater than 0 (a negative expense would add to the float)' });
    if (txn_date && !isDate(txn_date)) return res.status(400).json({ error: 'txn_date must be a date (YYYY-MM-DD)' });
    try {
        const r = await pool.query(`
            INSERT INTO acc_petty_cash_txns (txn_date, txn_type, amount, description, category)
            VALUES ($1,$2,$3,$4,$5) RETURNING *`,
            [txn_date || new Date().toISOString().slice(0,10), txn_type, amount, description, category || null]);
        res.status(201).json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ ACCOUNTING: EXPENSE CATEGORIES WITH BUDGETS ═══════════════════════
router.get('/api/expense-budgets', async (req, res) => {
    const month = req.query.month || new Date().toISOString().slice(0,7); // YYYY-MM
    try {
        const cats = await pool.query(`SELECT * FROM acc_expense_categories ORDER BY category_name`);
        const actuals = await pool.query(`
            SELECT category, COALESCE(SUM(amount),0) as actual
            FROM expenses_detail WHERE TO_CHAR(report_date,'YYYY-MM')=$1 GROUP BY category`, [month]);
        const actualMap = Object.fromEntries(actuals.rows.map(x => [x.category, Number(x.actual)]));
        const rows = cats.rows.map(c => ({ ...c, month, actual: actualMap[c.category_name] || 0,
            variance: Number(c.monthly_budget) - (actualMap[c.category_name] || 0) }));
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/api/expense-budgets', async (req, res) => {
    const { category_name, monthly_budget, notes } = req.body || {};
    if (!category_name || monthly_budget == null) return res.status(400).json({ error: 'category_name, monthly_budget required' });
    if (!isNonNegative(monthly_budget)) return res.status(400).json({ error: 'monthly_budget must be a number, 0 or more' });
    try {
        const r = await pool.query(`
            INSERT INTO acc_expense_categories (category_name, monthly_budget, notes)
            VALUES ($1,$2,$3)
            ON CONFLICT (category_name) DO UPDATE SET monthly_budget=EXCLUDED.monthly_budget, notes=EXCLUDED.notes
            RETURNING *`, [category_name, monthly_budget, notes || null]);
        res.status(201).json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ ACCOUNTING: YEAR-END CLOSING ═══════════════════════
router.get('/api/year-end-closings', async (req, res) => {
    try {
        const r = await pool.query(`SELECT *, TO_CHAR(closing_date,'YYYY-MM-DD') as closing_date_str FROM acc_year_end_closings ORDER BY fiscal_year DESC`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Close a fiscal year: computes real totals from daily_summary for that calendar year and locks them in.
router.post('/api/year-end-closings', async (req, res) => {
    const { fiscal_year, notes } = req.body || {};
    if (!fiscal_year) return res.status(400).json({ error: 'fiscal_year required' });
    if (!/^\d{4}$/.test(String(fiscal_year)) || Number(fiscal_year) < 2000 || Number(fiscal_year) > new Date().getFullYear()) {
        return res.status(400).json({ error: 'fiscal_year must be a 4-digit year, not in the future' });
    }
    try {
        const existing = await pool.query(`SELECT id FROM acc_year_end_closings WHERE fiscal_year=$1`, [fiscal_year]);
        if (existing.rows.length) return res.status(409).json({ error: `Fiscal year ${fiscal_year} is already closed` });
        const agg = await pool.query(`
            SELECT COALESCE(SUM(total_sale),0) as total_revenue, COALESCE(SUM(total_expenses),0) as total_expenses,
                   COALESCE(SUM(gross_profit),0) - COALESCE(SUM(total_expenses),0) as net_profit
            FROM daily_summary WHERE EXTRACT(YEAR FROM report_date) = $1`, [fiscal_year]);
        const a = agg.rows[0];
        const r = await pool.query(`
            INSERT INTO acc_year_end_closings (fiscal_year, total_revenue, total_expenses, net_profit, notes)
            VALUES ($1,$2,$3,$4,$5) RETURNING *`,
            [fiscal_year, a.total_revenue, a.total_expenses, a.net_profit, notes || null]);
        res.status(201).json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
