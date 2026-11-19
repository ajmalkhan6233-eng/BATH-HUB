'use strict';
jest.mock('pg', () => require('../helpers/pgmock')());
const pg = require('pg');
const P = require('../../utils/paperImport');
const db = pg.__db.public;
db.none(`CREATE TABLE cheque_register (id SERIAL PRIMARY KEY, cheque_no VARCHAR(50), bank VARCHAR(100), payee VARCHAR(150) NOT NULL, amount NUMERIC(12,2) NOT NULL, due_date DATE NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'pending', notes TEXT)`);
db.none(`CREATE TABLE acc_bank_transactions (id SERIAL PRIMARY KEY, txn_date DATE, description TEXT, amount NUMERIC DEFAULT 0, txn_type TEXT, bank_name TEXT, notes TEXT)`);
db.none(`CREATE TABLE acc_petty_cash_txns (id SERIAL PRIMARY KEY, txn_date DATE, txn_type TEXT, amount NUMERIC DEFAULT 0, description TEXT, category TEXT)`);
const n = t => Number(db.many(`SELECT COUNT(*)::int AS n FROM ${t}`)[0].n);
const pool = new pg.Pool();
const good = () => ({
  cheques: [{ cheque_no: '000123', bank: 'Commercial', payee: 'Metro Enterprises', amount: 150000, due_date: '2026-11-05' }],
  bank: [{ txn_date: '2026-10-20', description: 'Cash deposit', amount: 50000, txn_type: 'CREDIT', bank_name: 'Commercial' }],
  expenses: [{ txn_date: '2026-10-21', amount: 1200, description: 'Tea and cleaning', category: 'Shop' }],
});

beforeEach(() => { for (const t of ['cheque_register', 'acc_bank_transactions', 'acc_petty_cash_txns']) db.none(`DELETE FROM ${t}`); });

test('rehearsal reports the counts (that it writes nothing is proved on real Postgres: paper_import_realpg.test.js)', async () => {
  const r = await P.run(pool, good());
  expect(r.added).toEqual({ cheques: 1, bank: 1, expenses: 1 });
});

test('load adds the rows; loading the same file again adds nothing', async () => {
  const a = await P.run(pool, good(), { dryRun: false });
  expect(a.added).toEqual({ cheques: 1, bank: 1, expenses: 1 });
  expect(db.many(`SELECT status FROM cheque_register`)[0].status).toBe('pending');
  expect(db.many(`SELECT txn_type FROM acc_petty_cash_txns`)[0].txn_type).toBe('EXPENSE');
  const b = await P.run(pool, good(), { dryRun: false });
  expect(b.added).toEqual({ cheques: 0, bank: 0, expenses: 0 });
  expect(b.skipped).toEqual({ cheques: 1, bank: 1, expenses: 1 });
  expect(n('cheque_register')).toBe(1);
});

test('one bad row stops the whole file and names the row', async () => {
  const f = good(); f.expenses.push({ txn_date: 'yesterday', amount: -5, description: '' });
  await expect(P.run(pool, f, { dryRun: false })).rejects.toThrow(/expenses #2: txn_date[\s\S]*expenses #2: amount[\s\S]*expenses #2: description/);
});

test('rules match the app screens', () => {
  const { errors } = P.check({ bank: [{ txn_date: '2026-10-20', amount: 10, txn_type: 'in' }], cheques: [{ payee: 'x', amount: 5, due_date: '2026-10-20', status: 'paid' }], other: [] });
  expect(errors.join('|')).toMatch(/txn_type must be CREDIT or DEBIT/);
  expect(errors.join('|')).toMatch(/status must be pending, cleared or bounced/);
  expect(errors.join('|')).toMatch(/unknown section "other"/);
});
