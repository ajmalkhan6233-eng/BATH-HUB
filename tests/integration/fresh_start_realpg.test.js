'use strict';
// FRESH START against a REAL PostgreSQL (the in-memory test database cannot prove ROLLBACK).
// Runs only when RBH_TEST_PG_URL points at an empty scratch database, e.g.
//   RBH_TEST_PG_URL=postgres://user:pw@127.0.0.1:5432/rbh_wipe_test npx jest tests/integration/fresh_start_realpg.test.js
// Skipped otherwise, so the normal test run never needs a database.
const url = process.env.RBH_TEST_PG_URL;
const d = url ? describe : describe.skip;

d('fresh start on a real PostgreSQL', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { spawnSync } = require('child_process');
  const { Pool } = require('pg');
  const F = require('../../utils/freshStart');
  let pool;
  const n = async t => Number((await pool.query('SELECT COUNT(*)::int AS n FROM ' + t)).rows[0].n);

  async function build() {
    await pool.query(`DROP TABLE IF EXISTS kept_child, pos_bill_items, pos_bills, customers, leads, grn_records, cheque_register, document_inbox, products, stock_items, suppliers, users CASCADE`);
    await pool.query(`CREATE TABLE customers (id SERIAL PRIMARY KEY, name TEXT)`);
    await pool.query(`CREATE TABLE leads (id SERIAL PRIMARY KEY, name TEXT)`);
    await pool.query(`CREATE TABLE pos_bills (id SERIAL PRIMARY KEY, bill_number TEXT, customer_id INT REFERENCES customers(id))`);
    await pool.query(`CREATE TABLE pos_bill_items (id SERIAL PRIMARY KEY, bill_id INT REFERENCES pos_bills(id), item_name TEXT)`);
    await pool.query(`CREATE TABLE grn_records (id SERIAL PRIMARY KEY, grn_number TEXT)`);
    await pool.query(`CREATE TABLE cheque_register (id SERIAL PRIMARY KEY, cheque_no TEXT)`);
    await pool.query(`CREATE TABLE document_inbox (id SERIAL PRIMARY KEY, file_path TEXT)`);
    await pool.query(`CREATE TABLE products (id SERIAL PRIMARY KEY, name TEXT, price NUMERIC, stock_level NUMERIC DEFAULT 0)`);
    await pool.query(`CREATE TABLE stock_items (id SERIAL PRIMARY KEY, item_name TEXT, current_qty NUMERIC DEFAULT 0)`);
    await pool.query(`CREATE TABLE suppliers (id SERIAL PRIMARY KEY, name TEXT)`);
    await pool.query(`CREATE TABLE users (id SERIAL PRIMARY KEY, username TEXT)`);
    await pool.query(`INSERT INTO customers (name) VALUES ('A'), ('B')`);
    await pool.query(`INSERT INTO leads (name) VALUES ('L1')`);
    await pool.query(`INSERT INTO pos_bills (bill_number, customer_id) VALUES ('B1', 1), ('B2', 2)`);
    await pool.query(`INSERT INTO pos_bill_items (bill_id, item_name) VALUES (1, 'Tap'), (2, 'Tile')`);
    await pool.query(`INSERT INTO grn_records (grn_number) VALUES ('G1'), ('G2')`);
    await pool.query(`INSERT INTO cheque_register (cheque_no) VALUES ('000123')`);
    await pool.query(`INSERT INTO document_inbox (file_path) VALUES ('a.jpg'), ('b.jpg')`);
    await pool.query(`INSERT INTO products (name, price, stock_level) VALUES ('Mixer tap', 8500, 12)`);
    await pool.query(`INSERT INTO stock_items (item_name, current_qty) VALUES ('Adhesive', 7)`);
    await pool.query(`INSERT INTO suppliers (name) VALUES ('Metro')`);
    await pool.query(`INSERT INTO users (username) VALUES ('aj')`);
  }

  beforeAll(() => { pool = new Pool({ connectionString: url }); });
  afterAll(() => pool.end());

  test('clears in the right order (real links between bills and customers), keeps the setup, numbering restarts at 1', async () => {
    await build();
    await F.execute(pool, { scope: 'all' });
    for (const t of ['customers', 'leads', 'pos_bills', 'pos_bill_items', 'grn_records', 'cheque_register', 'document_inbox']) expect(await n(t)).toBe(0);
    expect(await n('products')).toBe(1); expect(await n('suppliers')).toBe(1); expect(await n('users')).toBe(1);
    expect(Number((await pool.query('SELECT stock_level FROM products')).rows[0].stock_level)).toBe(0);
    expect(Number((await pool.query('SELECT current_qty FROM stock_items')).rows[0].current_qty)).toBe(0);
    await pool.query(`INSERT INTO customers (name) VALUES ('new')`);
    expect(Number((await pool.query('SELECT id FROM customers')).rows[0].id)).toBe(1);
  });

  test('all or nothing: a failure part-way puts EVERYTHING back', async () => {
    await build();
    await pool.query(`CREATE TABLE kept_child (id SERIAL PRIMARY KEY, customer_id INT REFERENCES customers(id))`);   // a kept table still pointing at a customer
    await pool.query(`INSERT INTO kept_child (customer_id) VALUES (1)`);
    await expect(F.execute(pool, { scope: 'all' })).rejects.toThrow(/rolled back, nothing was changed \(stopped at /);
    expect(await n('customers')).toBe(2); expect(await n('pos_bills')).toBe(2); expect(await n('pos_bill_items')).toBe(2);
    expect(await n('grn_records')).toBe(2); expect(await n('cheque_register')).toBe(1); expect(await n('document_inbox')).toBe(2);
    expect(Number((await pool.query('SELECT stock_level FROM products')).rows[0].stock_level)).toBe(12);   // stock not zeroed either
    await pool.query('DROP TABLE kept_child');
  });

  describe('command line', () => {
    const run = (...args) => spawnSync(process.execPath, [path.join(__dirname, '..', '..', 'scripts', 'wipe_fresh_start.js'), ...args], {
      cwd: fs.mkdtempSync(path.join(os.tmpdir(), 'wipecwd-')),
      env: { ...process.env, DB_HOST: new URL(url).hostname, DB_PORT: new URL(url).port || '5432', DB_NAME: new URL(url).pathname.slice(1), DB_USER: decodeURIComponent(new URL(url).username), DB_PASSWORD: decodeURIComponent(new URL(url).password), DATABASE_URL: '', DROP_ROOT: fs.mkdtempSync(path.join(os.tmpdir(), 'drop-')) },
      encoding: 'utf8',
    });
    test('rehearsal changes nothing; clearing without a backup is refused; with a fresh backup it clears', async () => {
      await build();
      const r1 = run('--scope=all');
      expect(r1.stdout).toMatch(/REHEARSAL/); expect(await n('customers')).toBe(2);
      const r2 = run('--yes', '--scope=all');
      expect(r2.stdout).toMatch(/STOPPED: no backup file given/); expect(r2.status).toBe(3); expect(await n('customers')).toBe(2);
      const bk = path.join(os.tmpdir(), `bk-${Date.now()}.sql`); fs.writeFileSync(bk, 'x'.repeat(5000));
      const r3 = run('--yes', '--scope=all', `--backup=${bk}`);
      expect(r3.stdout).toMatch(/CLEARED\. Rows left in those tables: 0/); expect(r3.status).toBe(0);
      expect(await n('customers')).toBe(0); expect(await n('products')).toBe(1);
    });
  });
});
