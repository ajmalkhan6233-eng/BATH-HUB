'use strict';
// Accounting/purchasing: amounts can't be negative or text, journal accounts must exist,
// and supplier aging ages the oldest UNPAID delivery (payments applied oldest-first).
jest.mock('pg', () => require('../helpers/pgmock')());

const express = require('express');
const request = require('supertest');
const pg = require('pg');

const db = pg.__db.public;
db.none(`CREATE TABLE acc_chart_of_accounts (account_code TEXT PRIMARY KEY, account_name TEXT, account_type TEXT, parent_code TEXT, active BOOLEAN DEFAULT true)`);
db.none(`INSERT INTO acc_chart_of_accounts (account_code, account_name, account_type) VALUES ('1000','Cash','ASSET'), ('4000','Sales','INCOME')`);
db.none(`CREATE TABLE acc_journal_entries (id SERIAL PRIMARY KEY, entry_date DATE, description TEXT, debit_account_code TEXT, credit_account_code TEXT, amount NUMERIC, reference TEXT)`);
db.none(`CREATE TABLE acc_petty_cash_txns (id SERIAL PRIMARY KEY, txn_date DATE, txn_type TEXT, amount NUMERIC, description TEXT, category TEXT)`);
db.none(`CREATE TABLE acc_bank_transactions (id SERIAL PRIMARY KEY, txn_date DATE, description TEXT, amount NUMERIC, txn_type TEXT, bank_name TEXT, notes TEXT, matched BOOLEAN DEFAULT false, matched_ref TEXT)`);
db.none(`CREATE TABLE acc_expense_categories (id SERIAL PRIMARY KEY, category_name TEXT UNIQUE, monthly_budget NUMERIC, notes TEXT)`);
db.none(`CREATE TABLE pur_landed_costs (id SERIAL PRIMARY KEY, po_id INT, po_total NUMERIC, freight NUMERIC, duty NUMERIC, other_costs NUMERIC, total_landed_cost NUMERIC, notes TEXT, created_at TIMESTAMP DEFAULT now())`);
db.none(`CREATE TABLE pur_supplier_prices (id SERIAL PRIMARY KEY, item_description TEXT, supplier_id INT, supplier_name TEXT, unit_cost NUMERIC, quoted_date DATE, notes TEXT)`);
db.none(`CREATE TABLE acc_year_end_closings (id SERIAL PRIMARY KEY, fiscal_year INT, closing_date DATE DEFAULT now(), total_revenue NUMERIC, total_expenses NUMERIC, net_profit NUMERIC, notes TEXT)`);

const router = require('../../routes/purchasing_accounting');
const app = express();
app.use(express.json());
app.use('/', router);

const count = t => Number(db.many(`SELECT COUNT(*) AS n FROM ${t}`)[0].n);

describe('journal entries', () => {
  const je = body => request(app).post('/api/journal-entries').send({ description: 'Day sale', debit_account_code: '1000', credit_account_code: '4000', amount: 5000, ...body });

  test('a valid entry is saved', async () => {
    expect((await je({})).status).toBe(201);
  });
  test('negative / text / zero amounts are refused', async () => {
    expect((await je({ amount: -500 })).status).toBe(400);
    expect((await je({ amount: 'lots' })).status).toBe(400);
    expect((await je({ amount: 0 })).status).toBe(400);
    expect(count('acc_journal_entries')).toBe(1);
  });
  test('an unknown account code is refused, and so is a bad date', async () => {
    const r = await je({ credit_account_code: '9999' });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/9999/);
    expect((await je({ entry_date: 'soon' })).status).toBe(400);
    expect(count('acc_journal_entries')).toBe(1);
  });
});

describe('petty cash, bank transactions, budgets, landed cost, prices', () => {
  test('petty cash: a negative expense (which would add to the float) is refused', async () => {
    const post = b => request(app).post('/api/petty-cash').send({ txn_type: 'EXPENSE', description: 'Tea', amount: 300, ...b });
    expect((await post({})).status).toBe(201);
    expect((await post({ amount: -300 })).status).toBe(400);
    expect((await post({ amount: 'x' })).status).toBe(400);
    expect((await post({ txn_date: '31/12' })).status).toBe(400);
    expect(count('acc_petty_cash_txns')).toBe(1);
  });

  test('bank transactions need a positive amount and a real date', async () => {
    const post = b => request(app).post('/api/bank-transactions').send({ txn_date: '2026-10-01', amount: 1000, txn_type: 'CREDIT', ...b });
    expect((await post({})).status).toBe(201);
    expect((await post({ amount: -1000 })).status).toBe(400);
    expect((await post({ txn_date: 'x' })).status).toBe(400);
  });

  test('budgets and supplier prices must be non-negative numbers', async () => {
    expect((await request(app).post('/api/expense-budgets').send({ category_name: 'Power', monthly_budget: -1 })).status).toBe(400);
    expect((await request(app).post('/api/expense-budgets').send({ category_name: 'Power', monthly_budget: 'x' })).status).toBe(400);
    expect((await request(app).post('/api/expense-budgets').send({ category_name: 'Power', monthly_budget: 0 })).status).toBe(201);
    expect((await request(app).post('/api/supplier-prices').send({ item_description: 'Basin', supplier_name: 'S', unit_cost: -4 })).status).toBe(400);
    expect((await request(app).post('/api/supplier-prices').send({ item_description: 'Basin', supplier_name: 'S', unit_cost: 4500 })).status).toBe(201);
  });

  test('landed cost: a typo is an error, not a silent 0', async () => {
    const post = b => request(app).post('/api/landed-costs').send({ po_total: 100000, freight: 5000, duty: 12000, ...b });
    const ok = await post({});
    expect(ok.status).toBe(201);
    expect(Number(ok.body.total_landed_cost)).toBe(117000);
    const bad = await post({ duty: '12O00' });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/duty/);
    expect((await post({ freight: -5 })).status).toBe(400);
  });

  test('reports and year-end closing validate their inputs', async () => {
    expect((await request(app).get('/api/pnl?from=x&to=y')).status).toBe(400);
    expect((await request(app).get('/api/vat-report?from=2026-01-01&to=nope')).status).toBe(400);
    expect((await request(app).post('/api/year-end-closings').send({ fiscal_year: 'abc' })).status).toBe(400);
    expect((await request(app).post('/api/year-end-closings').send({ fiscal_year: 2999 })).status).toBe(400);
    expect((await request(app).post('/api/year-end-closings').send({ fiscal_year: 1850 })).status).toBe(400);
  });
});

describe('supplier aging', () => {
  const { buildSupplierAging } = router;
  const today = new Date(2026, 9, 31);     // 31 Oct 2026 (local)
  const sup = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }];

  test('payments go to the OLDEST delivery first; age is that of the oldest unpaid one', () => {
    const grns = [
      { id: 1, supplier_id: 1, total_amount: '100000', grn_date: '2026-06-01' },   // very old, fully paid below
      { id: 2, supplier_id: 1, total_amount: '50000',  grn_date: '2026-10-20' },   // the only unpaid one
    ];
    const out = buildSupplierAging(sup, grns, [{ supplier_id: 1, total_paid: '100000' }], today);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ supplier_name: 'A', balance_due: 50000, oldest_grn: '2026-10-20', age_days: 11, aging_bucket: '0-30' });
    // the old behaviour would have said 152 days / '90+' because GRN #1 is the oldest one ever received
  });

  test('a partly paid delivery is still the oldest unpaid', () => {
    const grns = [{ id: 1, supplier_id: 2, total_amount: '80000', grn_date: '2026-08-01' }, { id: 2, supplier_id: 2, total_amount: '20000', grn_date: '2026-10-01' }];
    const out = buildSupplierAging(sup, grns, [{ supplier_id: 2, total_paid: '30000' }], today);
    expect(out[0]).toMatchObject({ balance_due: 70000, oldest_grn: '2026-08-01', age_days: 91, aging_bucket: '90+' });
  });

  test('fully paid suppliers are left out; overpaid ones show a negative balance with no age; sorted by balance', () => {
    const grns = [
      { id: 1, supplier_id: 1, total_amount: '1000', grn_date: '2026-10-01' },
      { id: 2, supplier_id: 2, total_amount: '500', grn_date: '2026-10-01' },
      { id: 3, supplier_id: 3, total_amount: '9000', grn_date: '2026-09-01' },
    ];
    const out = buildSupplierAging(sup, grns, [{ supplier_id: 1, total_paid: '1000' }, { supplier_id: 2, total_paid: '700' }], today);
    expect(out.map(x => x.supplier_name)).toEqual(['C', 'B']);          // A is settled
    expect(out[1]).toMatchObject({ balance_due: -200, age_days: null, aging_bucket: 'N/A' });
    expect(out[0]).toMatchObject({ balance_due: 9000, age_days: 60, aging_bucket: '31-60' });
  });

  test('the endpoint returns the same thing from the database', async () => {
    db.none(`CREATE TABLE suppliers (id SERIAL PRIMARY KEY, name TEXT)`);
    db.none(`CREATE TABLE grn_records (id SERIAL PRIMARY KEY, supplier_id INT, total_amount NUMERIC, grn_date DATE)`);
    db.none(`CREATE TABLE supplier_payments (id SERIAL PRIMARY KEY, supplier_id INT, amount NUMERIC)`);
    db.none(`INSERT INTO suppliers (name) VALUES ('Lanka Tiles')`);
    db.none(`INSERT INTO grn_records (supplier_id, total_amount, grn_date) VALUES (1, 100000, '2026-01-05'), (1, 40000, '2026-10-25')`);
    db.none(`INSERT INTO supplier_payments (supplier_id, amount) VALUES (1, 100000)`);
    const res = await request(app).get('/api/supplier-aging');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ supplier_name: 'Lanka Tiles', balance_due: 40000, oldest_grn: '2026-10-25', aging_bucket: '0-30' });
  });
});
