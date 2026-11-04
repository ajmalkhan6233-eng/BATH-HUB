'use strict';
// The reports the owner can turn into a PDF / CSV. READ-ONLY: every report is plain SELECTs against the existing tables,
// nothing here writes to or alters any shop table. Totals are added up here in code from the stored rows.
// Golden-core note: these reports do NOT call or edit server.js / purchasing_accounting / staff_reports; where a figure
// lives in golden-core code (daily summary cash in / cash out) the same SQL expression is repeated here, read-only.
//
// A report = { key, title, period, summary: [{label, value, type}], columns: [{key, label, type}], rows: [...], total: {...}|null, notes: [..] }
//   column / summary types: text | date | money | int | qty
const { notVoided } = require('../voids');
const { num, ymd, hm } = require('./format');

const periodText = (from, to) => (from === to ? from : `${from} to ${to}`);
const sum = (rows, k) => rows.reduce((s, r) => s + num(r[k]), 0);
const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const rsPlain = n => 'Rs ' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// the same expressions server.js uses for the daily summary cash lines (copied, read-only)
const CASH_IN_EXPR = `CASE WHEN (cash_sale+card_sale+online_sale+credit_sale)>0 THEN (cash_sale+card_sale+online_sale+credit_sale) ELSE total_sale END`;
const CASH_OUT_EXPR = `(total_expenses+payments+salary+cash_out-COALESCE(cash_received,0))`;

async function dailyRows(pool, from, to) {
    const r = await pool.query(
        `SELECT TO_CHAR(report_date,'YYYY-MM-DD') AS date, total_sale, cash_sale, card_sale, online_sale, credit_sale, total_expenses, payments, salary,
                gross_profit, net_profit, gp_status
           FROM daily_summary WHERE report_date BETWEEN $1 AND $2 ORDER BY report_date`, [from, to]);
    return r.rows;
}

const REPORTS = {
    daily_summary: {
        label: 'Daily summary', description: 'Sales by day: cash, card, online, credit, and expenses.',
        async build(pool, { from, to }) {
            const rows = (await dailyRows(pool, from, to)).map(r => ({
                date: r.date, total_sale: num(r.total_sale), cash_sale: num(r.cash_sale), card_sale: num(r.card_sale), online_sale: num(r.online_sale),
                credit_sale: num(r.credit_sale), total_expenses: num(r.total_expenses),
            }));
            const total = { date: 'Total', total_sale: sum(rows, 'total_sale'), cash_sale: sum(rows, 'cash_sale'), card_sale: sum(rows, 'card_sale'),
                online_sale: sum(rows, 'online_sale'), credit_sale: sum(rows, 'credit_sale'), total_expenses: sum(rows, 'total_expenses') };
            const best = rows.reduce((b, r) => (!b || r.total_sale > b.total_sale ? r : b), null);
            return {
                summary: [
                    { label: 'Days with figures', value: rows.length, type: 'int' },
                    { label: 'Total sales', value: total.total_sale, type: 'money' },
                    { label: 'Total expenses', value: total.total_expenses, type: 'money' },
                    { label: 'Average sale per day', value: rows.length ? round2(total.total_sale / rows.length) : 0, type: 'money' },
                    { label: 'Best day', value: best ? `${best.date} (${rsPlain(best.total_sale)})` : '-', type: 'text' },
                ],
                columns: [
                    { key: 'date', label: 'Date', type: 'date' }, { key: 'total_sale', label: 'Total sale', type: 'money' }, { key: 'cash_sale', label: 'Cash', type: 'money' },
                    { key: 'card_sale', label: 'Card', type: 'money' }, { key: 'online_sale', label: 'Online', type: 'money' }, { key: 'credit_sale', label: 'Credit', type: 'money' },
                    { key: 'total_expenses', label: 'Expenses', type: 'money' },
                ],
                rows, total, notes: ['Figures are as saved in the daily summary. A day without a payment split shows only its total sale.'],
            };
        },
    },

    pnl: {
        label: 'Profit and loss', description: 'Sales, profit and expenses added up by month.',
        async build(pool, { from, to }) {
            const days = await dailyRows(pool, from, to);
            const byMonth = new Map();
            for (const d of days) {
                const m = d.date.slice(0, 7);
                const o = byMonth.get(m) || { month: m, days: 0, sales: 0, gross_profit: 0, expenses: 0, payments: 0, salary: 0, net_profit: 0, days_profit: 0 };
                o.days += 1; o.sales += num(d.total_sale); o.gross_profit += num(d.gross_profit); o.expenses += num(d.total_expenses);
                o.payments += num(d.payments); o.salary += num(d.salary); o.net_profit += num(d.net_profit);
                if (['ACTUAL', 'BLENDED', 'ESTIMATE'].includes(String(d.gp_status))) o.days_profit += 1;
                byMonth.set(m, o);
            }
            const rows = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
            const total = { month: 'Total', days: sum(rows, 'days'), sales: sum(rows, 'sales'), gross_profit: sum(rows, 'gross_profit'), expenses: sum(rows, 'expenses'),
                payments: sum(rows, 'payments'), salary: sum(rows, 'salary'), net_profit: sum(rows, 'net_profit'), days_profit: sum(rows, 'days_profit') };
            return {
                summary: [
                    { label: 'Sales', value: total.sales, type: 'money' }, { label: 'Gross profit', value: total.gross_profit, type: 'money' },
                    { label: 'Expenses', value: total.expenses, type: 'money' }, { label: 'Net profit', value: total.net_profit, type: 'money' },
                    { label: 'Days counted / days with a profit figure', value: `${total.days} / ${total.days_profit}`, type: 'text' },
                ],
                columns: [
                    { key: 'month', label: 'Month', type: 'text' }, { key: 'days', label: 'Days', type: 'int' }, { key: 'sales', label: 'Sales', type: 'money' },
                    { key: 'gross_profit', label: 'Gross profit', type: 'money' }, { key: 'expenses', label: 'Expenses', type: 'money' },
                    { key: 'payments', label: 'Payments', type: 'money' }, { key: 'salary', label: 'Salary', type: 'money' }, { key: 'net_profit', label: 'Net profit', type: 'money' },
                ],
                rows, total,
                notes: ['Profit figures are the ones saved on each day in the daily summary. A day with no real profit figure counts as 0 profit, so check the "days with a profit figure" count above.'],
            };
        },
    },

    cheques: {
        label: 'Cheques', description: 'Cheques falling due in the period, with their status.',
        async build(pool, { from, to }) {
            const r = await pool.query(
                `SELECT cheque_no, bank, payee, amount, TO_CHAR(due_date,'YYYY-MM-DD') AS due_date, status FROM cheque_register
                  WHERE due_date BETWEEN $1 AND $2 ORDER BY due_date, id`, [from, to]);
            const rows = r.rows.map(x => ({ cheque_no: x.cheque_no || '', bank: x.bank || '', payee: x.payee || '', amount: num(x.amount), due_date: x.due_date, status: x.status || '' }));
            const by = s => rows.filter(x => x.status === s);
            const open = rows.filter(x => ['pending', 'held'].includes(x.status));
            return {
                summary: [
                    { label: 'Cheques due in the period', value: rows.length, type: 'int' }, { label: 'Total value', value: sum(rows, 'amount'), type: 'money' },
                    { label: 'Still to be paid (pending or held)', value: sum(open, 'amount'), type: 'money' }, { label: 'Cleared', value: sum(by('cleared'), 'amount'), type: 'money' },
                    { label: 'Bounced', value: sum(by('bounced'), 'amount'), type: 'money' },
                ],
                columns: [
                    { key: 'due_date', label: 'Due', type: 'date' }, { key: 'cheque_no', label: 'Cheque no', type: 'text' }, { key: 'bank', label: 'Bank', type: 'text' },
                    { key: 'payee', label: 'Payee', type: 'text' }, { key: 'amount', label: 'Amount', type: 'money' }, { key: 'status', label: 'Status', type: 'text' },
                ],
                rows, total: { due_date: 'Total', amount: sum(rows, 'amount') }, notes: [],
            };
        },
    },

    loans: {
        label: 'Friend and investor loans', description: 'Loans that are unpaid or fall due in the period, with repayments and what is still owed.',
        async build(pool, { from, to }) {
            const l = await pool.query(
                `SELECT id, lender_name, amount, profit_rate, TO_CHAR(date_given,'YYYY-MM-DD') AS date_given, TO_CHAR(due_date,'YYYY-MM-DD') AS due_date, status
                   FROM investor_loans WHERE date_given <= $2 AND (status <> 'repaid' OR due_date BETWEEN $1 AND $2) ORDER BY due_date, id`, [from, to]);
            const p = await pool.query(`SELECT loan_id, SUM(amount) AS paid FROM investor_loan_payments GROUP BY loan_id`);
            const paid = new Map(p.rows.map(x => [Number(x.loan_id), num(x.paid)]));
            const rows = l.rows.map(x => {
                const due = round2(num(x.amount) + num(x.amount) * num(x.profit_rate) / 100), rep = paid.get(Number(x.id)) || 0;
                return { lender_name: x.lender_name || '', date_given: x.date_given, due_date: x.due_date, amount: num(x.amount), profit_rate: num(x.profit_rate), total_due: due, repaid: rep, outstanding: round2(due - rep), status: x.status || '' };
            });
            return {
                summary: [
                    { label: 'Loans listed', value: rows.length, type: 'int' }, { label: 'Amount borrowed', value: sum(rows, 'amount'), type: 'money' },
                    { label: 'Total due with profit', value: sum(rows, 'total_due'), type: 'money' }, { label: 'Repaid so far', value: sum(rows, 'repaid'), type: 'money' },
                    { label: 'Still owed', value: sum(rows, 'outstanding'), type: 'money' },
                ],
                columns: [
                    { key: 'lender_name', label: 'Lender', type: 'text' }, { key: 'date_given', label: 'Given', type: 'date' }, { key: 'due_date', label: 'Due', type: 'date' },
                    { key: 'amount', label: 'Amount', type: 'money' }, { key: 'profit_rate', label: 'Profit %', type: 'qty' }, { key: 'total_due', label: 'Total due', type: 'money' },
                    { key: 'repaid', label: 'Repaid', type: 'money' }, { key: 'outstanding', label: 'Owed', type: 'money' }, { key: 'status', label: 'Status', type: 'text' },
                ],
                rows, total: { lender_name: 'Total', amount: sum(rows, 'amount'), total_due: sum(rows, 'total_due'), repaid: sum(rows, 'repaid'), outstanding: sum(rows, 'outstanding') },
                notes: ['Total due = amount + profit. Repayments are all repayments recorded so far (not only those inside the period).'],
            };
        },
    },

    commissions: {
        label: 'Sale commissions', description: 'Commission earned by each staff member in the period (returns are shown as minus).',
        async build(pool, { from, to }) {
            const r = await pool.query(
                `SELECT TO_CHAR(c.sale_date,'YYYY-MM-DD') AS sale_date, s.name AS staff_name, c.entry_type, c.amount, c.commission_pct, c.commission_amount
                   FROM sale_commissions c JOIN staff s ON s.id = c.staff_id
                  WHERE c.sale_date BETWEEN $1 AND $2 AND ${notVoided('commissions', 'c.id')} ORDER BY c.sale_date, c.id`, [from, to]);
            const rows = r.rows.map(x => ({ sale_date: x.sale_date, staff_name: x.staff_name || '', entry_type: x.entry_type || '', amount: num(x.amount), commission_pct: num(x.commission_pct), commission_amount: num(x.commission_amount) }));
            const per = new Map();
            for (const x of rows) per.set(x.staff_name, (per.get(x.staff_name) || 0) + x.commission_amount);
            return {
                summary: [
                    { label: 'Entries', value: rows.length, type: 'int' }, { label: 'Sales covered', value: sum(rows, 'amount'), type: 'money' },
                    { label: 'Net commission', value: sum(rows, 'commission_amount'), type: 'money' },
                    ...[...per.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, v]) => ({ label: `Commission: ${n}`, value: round2(v), type: 'money' })),
                ],
                columns: [
                    { key: 'sale_date', label: 'Date', type: 'date' }, { key: 'staff_name', label: 'Staff', type: 'text' }, { key: 'entry_type', label: 'Type', type: 'text' },
                    { key: 'amount', label: 'Sale amount', type: 'money' }, { key: 'commission_pct', label: 'Rate %', type: 'qty' }, { key: 'commission_amount', label: 'Commission', type: 'money' },
                ],
                rows, total: { sale_date: 'Total', amount: sum(rows, 'amount'), commission_amount: sum(rows, 'commission_amount') }, notes: ['Voided entries are left out.'],
            };
        },
    },

    stock: {
        label: 'Stock list', description: 'Every stock item with its quantity now (a snapshot of today, not of the chosen dates).',
        async build(pool) {
            const r = await pool.query(`SELECT item_name, unit, current_qty, reorder_level FROM stock_items ORDER BY item_name`);
            const rows = r.rows.map(x => ({ item_name: x.item_name || '', unit: x.unit || '', current_qty: num(x.current_qty), reorder_level: num(x.reorder_level), low: num(x.current_qty) <= num(x.reorder_level) ? 'Low' : '' }));
            return {
                summary: [{ label: 'Items', value: rows.length, type: 'int' }, { label: 'Items at or below reorder level', value: rows.filter(x => x.low).length, type: 'int' }, { label: 'Items out of stock', value: rows.filter(x => x.current_qty <= 0).length, type: 'int' }],
                columns: [{ key: 'item_name', label: 'Item', type: 'text' }, { key: 'unit', label: 'Unit', type: 'text' }, { key: 'current_qty', label: 'In stock', type: 'qty' }, { key: 'reorder_level', label: 'Reorder at', type: 'qty' }, { key: 'low', label: 'Flag', type: 'text' }],
                rows, total: null, notes: ['Stock quantities are as of the moment this document was made.'],
            };
        },
    },

    low_stock: {
        label: 'Low stock', description: 'Items at or below their reorder level (a snapshot of today).',
        async build(pool) {
            const r = await pool.query(`SELECT item_name, unit, current_qty, reorder_level FROM stock_items WHERE current_qty <= reorder_level ORDER BY item_name`);
            const rows = r.rows.map(x => ({ item_name: x.item_name || '', unit: x.unit || '', current_qty: num(x.current_qty), reorder_level: num(x.reorder_level), short_by: Math.max(0, num(x.reorder_level) - num(x.current_qty)) }));
            return {
                summary: [{ label: 'Items to reorder', value: rows.length, type: 'int' }, { label: 'Out of stock', value: rows.filter(x => x.current_qty <= 0).length, type: 'int' }],
                columns: [{ key: 'item_name', label: 'Item', type: 'text' }, { key: 'unit', label: 'Unit', type: 'text' }, { key: 'current_qty', label: 'In stock', type: 'qty' }, { key: 'reorder_level', label: 'Reorder at', type: 'qty' }, { key: 'short_by', label: 'Short by', type: 'qty' }],
                rows, total: null, notes: ['Stock quantities are as of the moment this document was made.'],
            };
        },
    },

    grn: {
        label: 'Goods received (GRN)', description: 'Goods received notes dated in the period.',
        async build(pool, { from, to }) {
            const r = await pool.query(
                `SELECT grn_number, supplier_name, TO_CHAR(grn_date,'YYYY-MM-DD') AS grn_date, item_description, quantity, unit_cost, total_amount, status
                   FROM grn_records WHERE grn_date BETWEEN $1 AND $2 ORDER BY grn_date, id`, [from, to]);
            const rows = r.rows.map(x => ({ grn_date: x.grn_date, grn_number: x.grn_number || '', supplier_name: x.supplier_name || '', item_description: x.item_description || '', quantity: num(x.quantity), unit_cost: num(x.unit_cost), total_amount: num(x.total_amount), status: x.status || '' }));
            return {
                summary: [
                    { label: 'GRN lines', value: rows.length, type: 'int' }, { label: 'GRN numbers', value: new Set(rows.map(x => x.grn_number)).size, type: 'int' },
                    { label: 'Total value received', value: sum(rows, 'total_amount'), type: 'money' }, { label: 'Suppliers', value: new Set(rows.map(x => x.supplier_name)).size, type: 'int' },
                ],
                columns: [
                    { key: 'grn_date', label: 'Date', type: 'date' }, { key: 'grn_number', label: 'GRN no', type: 'text' }, { key: 'supplier_name', label: 'Supplier', type: 'text' },
                    { key: 'item_description', label: 'Item', type: 'text' }, { key: 'quantity', label: 'Qty', type: 'qty' }, { key: 'unit_cost', label: 'Unit cost', type: 'money' },
                    { key: 'total_amount', label: 'Total', type: 'money' }, { key: 'status', label: 'Status', type: 'text' },
                ],
                rows, total: { grn_date: 'Total', total_amount: sum(rows, 'total_amount') }, notes: [],
            };
        },
    },

    receipts: {
        label: 'Sales receipts (POS bills)', description: 'Every POS bill in the period (voided bills left out).',
        async build(pool, { from, to }) {
            const cols = `b.bill_number, b.customer_name, b.total, b.discount_amount, b.payment_method, b.created_at`;
            const range = `b.created_at::date BETWEEN $1::date AND $2::date`;
            let r;
            try {
                r = await pool.query(`SELECT ${cols} FROM pos_bills b LEFT JOIN pos_bill_voids v ON v.bill_id = b.id WHERE v.bill_id IS NULL AND ${range} ORDER BY b.created_at, b.id`, [from, to]);
            } catch (e) {
                if (e && e.code === '42P01') r = await pool.query(`SELECT ${cols} FROM pos_bills b WHERE ${range} ORDER BY b.created_at, b.id`, [from, to]);   // no void table yet: nothing is void
                else throw e;
            }
            const rows = r.rows.map(x => ({ date: ymd(x.created_at), time: hm(x.created_at), bill_number: x.bill_number || '', customer_name: x.customer_name || '', payment_method: x.payment_method || '', discount_amount: num(x.discount_amount), total: num(x.total) }));
            const pay = new Map();
            for (const x of rows) pay.set(x.payment_method || 'other', (pay.get(x.payment_method || 'other') || 0) + x.total);
            return {
                summary: [
                    { label: 'Bills', value: rows.length, type: 'int' }, { label: 'Total of bills', value: sum(rows, 'total'), type: 'money' }, { label: 'Discounts given', value: sum(rows, 'discount_amount'), type: 'money' },
                    ...[...pay.entries()].map(([k, v]) => ({ label: `Paid by ${k}`, value: round2(v), type: 'money' })),
                ],
                columns: [
                    { key: 'date', label: 'Date', type: 'date' }, { key: 'time', label: 'Time', type: 'text' }, { key: 'bill_number', label: 'Bill no', type: 'text' }, { key: 'customer_name', label: 'Customer', type: 'text' },
                    { key: 'payment_method', label: 'Paid by', type: 'text' }, { key: 'discount_amount', label: 'Discount', type: 'money' }, { key: 'total', label: 'Total', type: 'money' },
                ],
                rows, total: { date: 'Total', discount_amount: sum(rows, 'discount_amount'), total: sum(rows, 'total') }, notes: [],
            };
        },
    },

    quotations: {
        label: 'Quotations', description: 'Quotations dated in the period, with their status.',
        async build(pool, { from, to }) {
            const r = await pool.query(
                `SELECT q.quote_no, q.id, TO_CHAR(q.quote_date,'YYYY-MM-DD') AS quote_date, TO_CHAR(q.valid_until,'YYYY-MM-DD') AS valid_until, q.status, q.total, c.name AS customer_name
                   FROM quotations q LEFT JOIN customers c ON c.id = q.customer_id WHERE q.quote_date BETWEEN $1 AND $2 ORDER BY q.quote_date, q.id`, [from, to]);
            const rows = r.rows.map(x => ({ quote_date: x.quote_date, quote_no: x.quote_no || `#${x.id}`, customer_name: x.customer_name || '', valid_until: x.valid_until || '', status: x.status || '', total: num(x.total) }));
            const st = s => rows.filter(x => x.status === s);
            return {
                summary: [
                    { label: 'Quotations', value: rows.length, type: 'int' }, { label: 'Total quoted', value: sum(rows, 'total'), type: 'money' },
                    { label: 'Accepted', value: sum(st('accepted'), 'total'), type: 'money' }, { label: 'Still open (draft or sent)', value: sum(rows.filter(x => ['draft', 'sent'].includes(x.status)), 'total'), type: 'money' },
                ],
                columns: [
                    { key: 'quote_date', label: 'Date', type: 'date' }, { key: 'quote_no', label: 'Quote no', type: 'text' }, { key: 'customer_name', label: 'Customer', type: 'text' },
                    { key: 'valid_until', label: 'Valid until', type: 'date' }, { key: 'status', label: 'Status', type: 'text' }, { key: 'total', label: 'Total', type: 'money' },
                ],
                rows, total: { quote_date: 'Total', total: sum(rows, 'total') }, notes: [],
            };
        },
    },

    cash_flow: {
        label: 'Cash flow', description: 'Cash in and cash out by day, plus cheques and loan repayments still due in the period.',
        async build(pool, { from, to }) {
            const r = await pool.query(
                `SELECT TO_CHAR(report_date,'YYYY-MM-DD') AS date, ${CASH_IN_EXPR} AS cash_in, ${CASH_OUT_EXPR} AS cash_out FROM daily_summary WHERE report_date BETWEEN $1 AND $2 ORDER BY report_date`, [from, to]);
            let run = 0;
            const rows = r.rows.map(x => { const net = num(x.cash_in) - num(x.cash_out); run += net; return { date: x.date, cash_in: num(x.cash_in), cash_out: num(x.cash_out), net: round2(net), running: round2(run) }; });
            const ch = await pool.query(`SELECT COALESCE(SUM(amount),0) AS t, COUNT(*) AS n FROM cheque_register WHERE status IN ('pending','held') AND due_date BETWEEN $1 AND $2`, [from, to]);
            const ln = await pool.query(`SELECT id, amount, profit_rate FROM investor_loans WHERE status <> 'repaid' AND due_date BETWEEN $1 AND $2`, [from, to]);
            const pp = await pool.query(`SELECT loan_id, SUM(amount) AS paid FROM investor_loan_payments GROUP BY loan_id`);
            const paid = new Map(pp.rows.map(x => [Number(x.loan_id), num(x.paid)]));
            const loansDue = ln.rows.reduce((s, x) => s + Math.max(0, num(x.amount) + num(x.amount) * num(x.profit_rate) / 100 - (paid.get(Number(x.id)) || 0)), 0);
            const cin = sum(rows, 'cash_in'), cout = sum(rows, 'cash_out'), chq = num(ch.rows[0] && ch.rows[0].t), after = cin - cout - chq - loansDue;
            return {
                summary: [
                    { label: 'Cash in', value: cin, type: 'money' }, { label: 'Cash out', value: cout, type: 'money' }, { label: 'Net cash movement', value: round2(cin - cout), type: 'money' },
                    { label: `Cheques still to pay in the period (${num(ch.rows[0] && ch.rows[0].n)})`, value: chq, type: 'money' },
                    { label: 'Loan repayments still due in the period', value: round2(loansDue), type: 'money' },
                    { label: 'Net after cheques and loans', value: round2(after), type: 'money' },
                ],
                columns: [{ key: 'date', label: 'Date', type: 'date' }, { key: 'cash_in', label: 'Cash in', type: 'money' }, { key: 'cash_out', label: 'Cash out', type: 'money' }, { key: 'net', label: 'Net', type: 'money' }, { key: 'running', label: 'Running net', type: 'money' }],
                rows, total: { date: 'Total', cash_in: cin, cash_out: cout, net: round2(cin - cout) },
                notes: ['Cash in and cash out use the same rules as the daily summary screen. Cheques and loans are listed only when still unpaid and due inside the period.'],
            };
        },
    },

    non_moving: {
        label: 'Non-moving stock', description: 'Items in stock that had no sale in the period.',
        async build(pool, { from, to }) {
            const it = await pool.query(`SELECT id, item_name, unit, current_qty FROM stock_items WHERE current_qty > 0 ORDER BY item_name`);
            const lastQ = await pool.query(`SELECT stock_item_id, MAX(created_at) AS last_sale_at FROM stock_adjustments WHERE reason = 'sale' GROUP BY stock_item_id`);
            const inQ = await pool.query(`SELECT DISTINCT stock_item_id FROM stock_adjustments WHERE reason = 'sale' AND created_at::date BETWEEN $1::date AND $2::date`, [from, to]);
            const last = new Map(lastQ.rows.map(x => [Number(x.stock_item_id), x.last_sale_at]));
            const moved = new Set(inQ.rows.map(x => Number(x.stock_item_id)));
            const rows = it.rows.filter(x => !moved.has(Number(x.id)))
                .map(x => ({ item_name: x.item_name || '', unit: x.unit || '', current_qty: num(x.current_qty), last_sale: last.get(Number(x.id)) ? ymd(last.get(Number(x.id))) : 'never' }))
                .sort((a, b) => (a.last_sale === 'never' ? '' : a.last_sale).localeCompare(b.last_sale === 'never' ? '' : b.last_sale));
            return {
                summary: [{ label: 'Items with no sale in the period', value: rows.length, type: 'int' }, { label: 'Items never sold', value: rows.filter(x => x.last_sale === 'never').length, type: 'int' }],
                columns: [{ key: 'item_name', label: 'Item', type: 'text' }, { key: 'unit', label: 'Unit', type: 'text' }, { key: 'current_qty', label: 'In stock', type: 'qty' }, { key: 'last_sale', label: 'Last sale', type: 'text' }],
                rows, total: null, notes: ['Only items with stock on hand are listed. "Last sale" is the most recent sale ever recorded for the item.'],
            };
        },
    },
};

const list = () => Object.entries(REPORTS).map(([key, d]) => ({ key, label: d.label, description: d.description }));
async function build(pool, key, range) {
    const def = Object.prototype.hasOwnProperty.call(REPORTS, key) ? REPORTS[key] : null;
    if (!def) { const e = new Error('Unknown report.'); e.status = 400; throw e; }
    const out = await def.build(pool, range);
    return { key, title: def.label, period: periodText(range.from, range.to), from: range.from, to: range.to, ...out };
}
module.exports = { REPORTS, list, build, periodText };
