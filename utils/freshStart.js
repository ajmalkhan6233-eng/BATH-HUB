'use strict';
// FRESH START (Aj's order 2026-10-21). TWO SIZES, because the shop is open and real records exist:
//   scope "clean" (the safe one): the junk only. Document inbox rows + photos, queued alerts, WhatsApp chats and drafts, leads and enquiries.
//   scope "all"  (only on Aj's word, "play 78"): everything in "clean" PLUS customers, bills and quotations, cheques, vendor payables,
//             GRNs and purchase orders, stock movements, and stock quantities set to 0. This also removes the real opening stock
//             loaded on 20 Oct (Task 75); it can be loaded again with scripts/import_opening_grn.js.
//   ALWAYS KEPT: users and logins, settings, the database layout, suppliers, products (names and prices), staff and salary setup,
//             loans and accounts, daily figures and expenses (unless asked with --also).
// Safety rules built in:
//   - one transaction: everything is cleared or nothing is (any error rolls the whole thing back);
//   - only tables that exist are touched; table names come ONLY from the fixed lists below (checked as plain names),
//     never from anyone's text; so there is no template-string SQL here;
//   - the command line (scripts/wipe_fresh_start.js) refuses to run without a fresh backup file, without an explicit scope, and never on the live DB.
const fs = require('fs');
const path = require('path');

// children first, so nothing is blocked by a link to a row that is already gone
const BILLS = ['pos_bill_payments', 'pos_bill_items', 'pos_bill_history', 'pos_bill_voids', 'pos_cheque_registered', 'pos_quotation_billed', 'pos_bills',
    'quotation_items', 'quotations', 'bill_drafts', 'bill_receipts', 'invoice_receipts', 'receipt_images', 'receipt_queue'];
const CHEQUES = ['cheque_alerts_sent', 'cheque_deposits', 'cheque_personal', 'cheque_register', 'cheques'];
const PAYABLES = ['vendor_bill_cheques', 'vendor_credit_notes', 'vendor_payments', 'supplier_payments', 'vendor_bills', 'client_payments'];
const GRN = ['grn_records', 'pur_landed_costs', 'pur_shipments', 'pur_purchase_orders', 'paper_drafts'];
const STOCK = ['stock_adjustments'];
const INBOX = ['document_sends', 'document_quarantine', 'document_inbox'];
const QUEUES = ['notify_queue'];
const CHATS = ['whatsapp_notified', 'wa_receipt_log', 'whatsapp_draft_entries', 'reply_drafts', 'layla_messages', 'layla_state', 'conversations', 'layla_contacts', 'layla_customers'];

const JUNK = [...INBOX, ...QUEUES, ...CHATS, 'enquiries', 'leads'];
const MONEY = [...BILLS, ...CHEQUES, ...PAYABLES, ...GRN, ...STOCK];
const PEOPLE = ['customer_credit_limits', 'credit_customers', 'customers'];
// children first inside each list; customers last, because bills point at customers
const SCOPES = { clean: JUNK, all: [...MONEY, ...JUNK, ...PEOPLE] };
// only when Aj asks (node scripts/wipe_fresh_start.js --yes --backup=... --also=daily,expenses)
const EXTRA = {
    daily: ['daily_summary', 'daily_reports', 'daily_entry_live', 'daily_payment_breakdown', 'daily_cash_plan', 'market_purchases', 'money_allocations', 'money_audit_log'],
    expenses: ['expenses_detail', 'acc_petty_cash_txns', 'acc_bank_transactions', 'acc_journal_entries', 'sale_commissions'],
};
const ZERO = [{ table: 'products', col: 'stock_level' }, { table: 'stock_items', col: 'current_qty' }];

const plain = n => { if (!/^[a-z][a-z0-9_]*$/.test(n)) throw new Error(`refusing odd name: ${n}`); return n; };

function tablesFor(also = [], scope = 'clean') {
    if (!SCOPES[scope]) throw new Error(`unknown scope "${scope}" (use clean or all)`);
    const extra = [];
    for (const k of also) { if (!EXTRA[k]) throw new Error(`unknown --also group "${k}" (use daily or expenses)`); extra.push(...EXTRA[k]); }
    return [...extra, ...SCOPES[scope]];   // extras first: they may point at bills/customers
}

async function existing(q) {
    const t = await q(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
    return new Set(t.rows.map(r => r.table_name));
}
async function hasColumn(q, table, col) {
    const r = await q(`SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`, [table, col]);
    return r.rows.length > 0;
}

// What WOULD be cleared (nothing is changed).
async function plan(pool, { also = [], scope = 'clean' } = {}) {
    const q = (s, p) => pool.query(s, p);
    const have = await existing(q);
    const rows = [], skipped = [];
    for (const t of tablesFor(also, scope)) {
        if (!have.has(t)) { skipped.push(t); continue; }
        const n = (await q('SELECT COUNT(*)::int AS n FROM ' + plain(t))).rows[0].n;
        rows.push({ table: t, rows: n });
    }
    const zero = [];
    for (const z of (scope === 'all' ? ZERO : [])) {   // stock quantities are set to 0 only in the "all" scope
        if (!have.has(z.table) || !(await hasColumn(q, z.table, z.col))) continue;
        const n = (await q('SELECT COUNT(*)::int AS n FROM ' + plain(z.table) + ' WHERE ' + plain(z.col) + ' <> 0')).rows[0].n;
        zero.push({ table: z.table, col: z.col, nonzero: n });
    }
    return { rows, zero, skipped, total: rows.reduce((a, r) => a + r.rows, 0) };
}

// The real thing: ONE transaction. Any error rolls everything back and is thrown with the table name.
async function execute(pool, { also = [], scope = 'clean' } = {}) {
    const client = pool.connect ? await pool.connect() : pool;
    const q = (s, p) => client.query(s, p);
    const done = { deleted: {}, zeroed: {} };
    let where = 'start';
    try {
        const have = await existing(q);
        await q('BEGIN');
        for (const t of tablesFor(also, scope)) {
            if (!have.has(t)) continue;
            where = t;
            const r = await q('DELETE FROM ' + plain(t));
            done.deleted[t] = r.rowCount || 0;
        }
        for (const z of (scope === 'all' ? ZERO : [])) {
            if (!have.has(z.table) || !(await hasColumn(q, z.table, z.col))) continue;
            where = `${z.table}.${z.col}`;
            const r = await q('UPDATE ' + plain(z.table) + ' SET ' + plain(z.col) + ' = 0 WHERE ' + plain(z.col) + ' <> 0');
            done.zeroed[z.table] = r.rowCount || 0;
        }
        await q('COMMIT');
    } catch (e) {
        try { await q('ROLLBACK'); } catch (e2) { /* already rolled back */ }
        const err = new Error(`fresh start rolled back, nothing was changed (stopped at ${where}): ${e.message}`);
        err.rolledBack = true; throw err;
    } finally { if (client !== pool && client.release) client.release(); }
    // numbering starts again at 1 for the cleared tables (best effort, after the commit; a failure here is harmless)
    for (const t of Object.keys(done.deleted)) {
        try { await pool.query('SELECT setval(pg_get_serial_sequence(\'' + plain(t) + '\', \'id\'), 1, false)'); } catch (e) { /* table has no serial id */ }
    }
    return done;
}

// Inbox photos: only files inside the dated folders (YYYY-MM-DD) under the inbox root. Nothing else, nothing outside, no links followed.
function inboxFiles(root, { remove = false } = {}) {
    const out = { files: 0, bytes: 0 };
    if (!root || !fs.existsSync(root)) return out;
    const base = path.resolve(root);
    for (const d of fs.readdirSync(base)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
        const dir = path.join(base, d);
        const st = fs.lstatSync(dir);
        if (!st.isDirectory() || st.isSymbolicLink()) continue;
        for (const f of fs.readdirSync(dir)) {
            const p = path.join(dir, f), s = fs.lstatSync(p);
            if (!s.isFile() || s.isSymbolicLink()) continue;
            out.files++; out.bytes += s.size;
            if (remove) fs.unlinkSync(p);
        }
        if (remove) { try { fs.rmdirSync(dir); } catch (e) { /* not empty: leave it */ } }
    }
    return out;
}

// A backup counts only if it is a real, recent, non-trivial file.
function backupLooksGood(file, { maxAgeMin = 60, now = Date.now() } = {}) {
    if (!file) return { ok: false, why: 'no backup file given (--backup=...)' };
    let st; try { st = fs.statSync(file); } catch (e) { return { ok: false, why: `backup file not found: ${file}` }; }
    if (!st.isFile() || st.size < 1000) return { ok: false, why: 'backup file is empty or too small' };
    if (now - st.mtimeMs > maxAgeMin * 60000) return { ok: false, why: `backup is older than ${maxAgeMin} minutes: make a fresh one` };
    return { ok: true, bytes: st.size };
}

module.exports = { SCOPES, EXTRA, ZERO, tablesFor, plan, execute, inboxFiles, backupLooksGood };
