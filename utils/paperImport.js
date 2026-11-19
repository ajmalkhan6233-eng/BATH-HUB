'use strict';
// PAPERS IMPORT (Aj 2026-10-21): cheques, bank slips and expense receipts, read from photos in chat, loaded as ONE file.
// File format (JSON, see docs/PAPERS.md):  { "cheques":[...], "bank":[...], "expenses":[...] }
// Writes ONLY to three ordinary tables with plain INSERTs (no schema change, nothing golden-core): cheque_register, acc_bank_transactions, acc_petty_cash_txns.
// Same rules the app's own screens use. Rows already in the app (same key) are skipped, so loading the same file twice adds nothing.
// All or nothing: one transaction; any bad row stops the whole file and says which row.
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(Date.parse(s));
const pos = n => n !== '' && n != null && isFinite(Number(n)) && Number(n) > 0;
const txt = v => (v == null || v === '' ? null : String(v).trim());

function check(file) {
    const errors = [], rows = { cheques: [], bank: [], expenses: [] };
    const f = file || {};
    for (const k of Object.keys(f)) if (!rows[k]) errors.push(`unknown section "${k}" (use cheques, bank, expenses)`);
    (f.cheques || []).forEach((r, i) => {
        const w = `cheques #${i + 1}`;
        if (!txt(r.payee)) errors.push(`${w}: payee missing`);
        if (!pos(r.amount)) errors.push(`${w}: amount must be more than 0`);
        if (!isDate(r.due_date)) errors.push(`${w}: due_date must be YYYY-MM-DD`);
        const status = txt(r.status) || 'pending';
        if (!['pending', 'cleared', 'bounced'].includes(status)) errors.push(`${w}: status must be pending, cleared or bounced`);
        rows.cheques.push({ cheque_no: txt(r.cheque_no), bank: txt(r.bank), payee: txt(r.payee), amount: Number(r.amount), due_date: r.due_date, status, notes: txt(r.notes) });
    });
    (f.bank || []).forEach((r, i) => {
        const w = `bank #${i + 1}`;
        if (!isDate(r.txn_date)) errors.push(`${w}: txn_date must be YYYY-MM-DD`);
        if (!pos(r.amount)) errors.push(`${w}: amount must be more than 0 (direction goes in txn_type)`);
        if (!['CREDIT', 'DEBIT'].includes(r.txn_type)) errors.push(`${w}: txn_type must be CREDIT or DEBIT`);
        rows.bank.push({ txn_date: r.txn_date, description: txt(r.description), amount: Number(r.amount), txn_type: r.txn_type, bank_name: txt(r.bank_name), notes: txt(r.notes) });
    });
    (f.expenses || []).forEach((r, i) => {
        const w = `expenses #${i + 1}`;
        if (!isDate(r.txn_date)) errors.push(`${w}: txn_date must be YYYY-MM-DD`);
        if (!pos(r.amount)) errors.push(`${w}: amount must be more than 0`);
        if (!txt(r.description)) errors.push(`${w}: description missing`);
        const t = txt(r.txn_type) || 'EXPENSE';
        if (!['TOPUP', 'EXPENSE'].includes(t)) errors.push(`${w}: txn_type must be TOPUP or EXPENSE`);
        rows.expenses.push({ txn_date: r.txn_date, txn_type: t, amount: Number(r.amount), description: txt(r.description), category: txt(r.category) });
    });
    return { errors, rows };
}

// Fixed statements only; values always go in as parameters.
const SQL = {
    cheques: {
        dup: `SELECT 1 FROM cheque_register WHERE COALESCE(cheque_no,'') = COALESCE($1,'') AND COALESCE(bank,'') = COALESCE($2,'') AND amount = $3 AND due_date = $4 LIMIT 1`,
        ins: `INSERT INTO cheque_register (cheque_no, bank, payee, amount, due_date, status, notes) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        key: r => [r.cheque_no, r.bank, r.amount, r.due_date], val: r => [r.cheque_no, r.bank, r.payee, r.amount, r.due_date, r.status, r.notes],
    },
    bank: {
        dup: `SELECT 1 FROM acc_bank_transactions WHERE txn_date = $1 AND amount = $2 AND txn_type = $3 AND COALESCE(description,'') = COALESCE($4,'') AND COALESCE(bank_name,'') = COALESCE($5,'') LIMIT 1`,
        ins: `INSERT INTO acc_bank_transactions (txn_date, description, amount, txn_type, bank_name, notes) VALUES ($1,$2,$3,$4,$5,$6)`,
        key: r => [r.txn_date, r.amount, r.txn_type, r.description, r.bank_name], val: r => [r.txn_date, r.description, r.amount, r.txn_type, r.bank_name, r.notes],
    },
    expenses: {
        dup: `SELECT 1 FROM acc_petty_cash_txns WHERE txn_date = $1 AND amount = $2 AND txn_type = $3 AND description = $4 LIMIT 1`,
        ins: `INSERT INTO acc_petty_cash_txns (txn_date, txn_type, amount, description, category) VALUES ($1,$2,$3,$4,$5)`,
        key: r => [r.txn_date, r.amount, r.txn_type, r.description], val: r => [r.txn_date, r.txn_type, r.amount, r.description, r.category],
    },
};

// dryRun=true: counts only, nothing written (still inside a transaction that is rolled back).
async function run(pool, file, { dryRun = true } = {}) {
    const { errors, rows } = check(file);
    if (errors.length) { const e = new Error('file not loaded, nothing was changed:\n  ' + errors.join('\n  ')); e.invalid = true; throw e; }
    const client = pool.connect ? await pool.connect() : pool;
    const q = (s, p) => client.query(s, p);
    const out = { added: { cheques: 0, bank: 0, expenses: 0 }, skipped: { cheques: 0, bank: 0, expenses: 0 } };
    let where = 'start';
    try {
        await q('BEGIN');
        const seen = new Set();   // the same row twice inside one file counts once
        for (const k of ['cheques', 'bank', 'expenses']) {
            for (const r of rows[k]) {
                where = `${k} (${SQL[k].key(r).join(' | ')})`;
                const sig = k + JSON.stringify(SQL[k].key(r));
                const have = seen.has(sig) || (await q(SQL[k].dup, SQL[k].key(r))).rows.length > 0;
                if (have) { out.skipped[k]++; continue; }
                seen.add(sig);
                await q(SQL[k].ins, SQL[k].val(r));
                out.added[k]++;
            }
        }
        await q(dryRun ? 'ROLLBACK' : 'COMMIT');
    } catch (e) {
        try { await q('ROLLBACK'); } catch (e2) { /* already rolled back */ }
        const err = new Error(`rolled back, nothing was changed (stopped at ${where}): ${e.message}`); err.rolledBack = true; throw err;
    } finally { if (client !== pool && client.release) client.release(); }
    return out;
}

module.exports = { check, run };
