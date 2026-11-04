'use strict';
// Papers import on a REAL PostgreSQL (the in-memory test database cannot prove ROLLBACK). Runs only when RBH_TEST_PG_URL is set (empty scratch database).
const url = process.env.RBH_TEST_PG_URL;
const d = url ? describe : describe.skip;
d('papers import on real PostgreSQL', () => {
  const { Pool } = require('pg');
  const P = require('../../utils/paperImport');
  let pool;
  const n = async t => Number((await pool.query('SELECT COUNT(*)::int AS n FROM ' + t)).rows[0].n);
  const all = async () => (await n('cheque_register')) + (await n('acc_bank_transactions')) + (await n('acc_petty_cash_txns'));
  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    await pool.query('DROP TABLE IF EXISTS cheque_register, acc_bank_transactions, acc_petty_cash_txns');
    await pool.query("CREATE TABLE cheque_register (id SERIAL PRIMARY KEY, cheque_no VARCHAR(50), bank VARCHAR(100), payee VARCHAR(150) NOT NULL, amount NUMERIC(12,2) NOT NULL, due_date DATE NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'pending', notes TEXT)");
    await pool.query('CREATE TABLE acc_bank_transactions (id SERIAL PRIMARY KEY, txn_date DATE, description TEXT, amount NUMERIC DEFAULT 0, txn_type TEXT, bank_name TEXT, notes TEXT)');
    await pool.query('CREATE TABLE acc_petty_cash_txns (id SERIAL PRIMARY KEY, txn_date DATE, txn_type TEXT, amount NUMERIC DEFAULT 0, description TEXT, category TEXT)');
  });
  afterAll(async () => { await pool.end(); });
  const good = () => ({ cheques: [{ cheque_no: '1', bank: 'C', payee: 'M', amount: 100, due_date: '2026-11-05' }], bank: [{ txn_date: '2026-10-20', amount: 5, txn_type: 'CREDIT' }], expenses: [{ txn_date: '2026-10-21', amount: 7, description: 'tea' }] });
  test('rehearsal changes nothing; load adds; same file again adds nothing', async () => {
    expect((await P.run(pool, good())).added).toEqual({ cheques: 1, bank: 1, expenses: 1 });
    expect(await all()).toBe(0);
    await P.run(pool, good(), { dryRun: false });
    expect(await all()).toBe(3);
    expect((await P.run(pool, good(), { dryRun: false })).added).toEqual({ cheques: 0, bank: 0, expenses: 0 });
    expect(await all()).toBe(3);
  });
  test('a database failure part-way puts everything back', async () => {
    await pool.query('DELETE FROM cheque_register; DELETE FROM acc_bank_transactions; DELETE FROM acc_petty_cash_txns');
    await pool.query('ALTER TABLE acc_petty_cash_txns ADD CONSTRAINT no_big CHECK (amount < 1000)');
    const f = good(); f.expenses[0].amount = 5000;
    await expect(P.run(pool, f, { dryRun: false })).rejects.toThrow(/rolled back, nothing was changed/);
    expect(await all()).toBe(0);
  });
});
