'use strict';
// FRESH START: clears the opening/test records, keeps the setup. In-memory database; no PC needed.
jest.mock('pg', () => require('../helpers/pgmock')());
const fs = require('fs');
const os = require('os');
const path = require('path');
const pg = require('pg');
const F = require('../../utils/freshStart');

const db = pg.__db.public;
db.none(`CREATE TABLE customers (id SERIAL PRIMARY KEY, name TEXT)`);
db.none(`CREATE TABLE leads (id SERIAL PRIMARY KEY, name TEXT)`);
db.none(`CREATE TABLE pos_bills (id SERIAL PRIMARY KEY, bill_number TEXT, customer_id INT)`);
db.none(`CREATE TABLE pos_bill_items (id SERIAL PRIMARY KEY, bill_id INT, item_name TEXT)`);
db.none(`CREATE TABLE grn_records (id SERIAL PRIMARY KEY, grn_number TEXT)`);
db.none(`CREATE TABLE cheque_register (id SERIAL PRIMARY KEY, cheque_no TEXT)`);
db.none(`CREATE TABLE vendor_bills (id SERIAL PRIMARY KEY, amount NUMERIC)`);
db.none(`CREATE TABLE document_inbox (id SERIAL PRIMARY KEY, file_path TEXT)`);
db.none(`CREATE TABLE notify_queue (id SERIAL PRIMARY KEY, text TEXT)`);
db.none(`CREATE TABLE products (id SERIAL PRIMARY KEY, name TEXT, price NUMERIC, stock_level NUMERIC DEFAULT 0)`);
db.none(`CREATE TABLE stock_items (id SERIAL PRIMARY KEY, item_name TEXT, current_qty NUMERIC DEFAULT 0)`);
db.none(`CREATE TABLE suppliers (id SERIAL PRIMARY KEY, name TEXT)`);
db.none(`CREATE TABLE users (id SERIAL PRIMARY KEY, username TEXT)`);
db.none(`CREATE TABLE daily_summary (id SERIAL PRIMARY KEY, sales NUMERIC)`);
db.none(`CREATE TABLE expenses_detail (id SERIAL PRIMARY KEY, amount NUMERIC)`);

const count = t => Number(db.many(`SELECT COUNT(*)::int AS n FROM ${t}`)[0].n);
function seed() {
  for (const t of ['pos_bill_items', 'pos_bills', 'customers', 'leads', 'grn_records', 'cheque_register', 'vendor_bills', 'document_inbox', 'notify_queue', 'products', 'stock_items', 'suppliers', 'users', 'daily_summary', 'expenses_detail']) db.none(`DELETE FROM ${t}`);
  db.none(`INSERT INTO customers (name) VALUES ('A'), ('B')`);
  db.none(`INSERT INTO leads (name) VALUES ('L1')`);
  db.none(`INSERT INTO pos_bills (bill_number, customer_id) VALUES ('B1', 1), ('B2', 2)`);
  db.none(`INSERT INTO pos_bill_items (bill_id, item_name) VALUES (1, 'Tap'), (1, 'Tile'), (2, 'Tap')`);
  db.none(`INSERT INTO grn_records (grn_number) VALUES ('G1'), ('G2')`);
  db.none(`INSERT INTO cheque_register (cheque_no) VALUES ('000123')`);
  db.none(`INSERT INTO vendor_bills (amount) VALUES (680000)`);
  db.none(`INSERT INTO document_inbox (file_path) VALUES ('a.jpg'), ('b.jpg'), ('c.jpg')`);
  db.none(`INSERT INTO notify_queue (text) VALUES ('old alert')`);
  db.none(`INSERT INTO products (name, price, stock_level) VALUES ('Mixer tap', 8500, 12), ('Tile 60x60', 3200, 40)`);
  db.none(`INSERT INTO stock_items (item_name, current_qty) VALUES ('Adhesive', 7)`);
  db.none(`INSERT INTO suppliers (name) VALUES ('Metro')`);
  db.none(`INSERT INTO users (username) VALUES ('aj')`);
  db.none(`INSERT INTO daily_summary (sales) VALUES (50000)`);
  db.none(`INSERT INTO expenses_detail (amount) VALUES (1200)`);
}

const pool = new pg.Pool();

test('rehearsal counts what would go and changes nothing', async () => {
  seed();
  const p = await F.plan(pool, { scope: 'all' });
  const byName = Object.fromEntries(p.rows.map(r => [r.table, r.rows]));
  expect(byName).toMatchObject({ customers: 2, leads: 1, pos_bills: 2, pos_bill_items: 3, grn_records: 2, cheque_register: 1, vendor_bills: 1, document_inbox: 3, notify_queue: 1 });
  expect(p.total).toBe(2 + 1 + 2 + 3 + 2 + 1 + 1 + 3 + 1);
  expect(p.zero).toEqual(expect.arrayContaining([{ table: 'products', col: 'stock_level', nonzero: 2 }, { table: 'stock_items', col: 'current_qty', nonzero: 1 }]));
  expect(p.skipped).toContain('pos_cheque_registered');          // tables this database does not have are skipped, not an error
  expect(count('customers')).toBe(2); expect(count('pos_bills')).toBe(2);   // nothing changed
});

test('clears the records, zeroes stock, keeps products, suppliers, users and the daily figures', async () => {
  seed();
  const done = await F.execute(pool, { scope: 'all' });
  for (const t of ['customers', 'leads', 'pos_bills', 'pos_bill_items', 'grn_records', 'cheque_register', 'vendor_bills', 'document_inbox', 'notify_queue']) expect(count(t)).toBe(0);
  expect(done.zeroed).toMatchObject({ products: 2, stock_items: 1 });
  const prods = db.many(`SELECT name, price, stock_level FROM products ORDER BY id`);
  expect(prods.map(r => [r.name, Number(r.price), Number(r.stock_level)])).toEqual([['Mixer tap', 8500, 0], ['Tile 60x60', 3200, 0]]);   // names and prices kept, stock 0
  expect(Number(db.many(`SELECT current_qty FROM stock_items`)[0].current_qty)).toBe(0);
  expect(count('suppliers')).toBe(1); expect(count('users')).toBe(1);
  expect(count('daily_summary')).toBe(1); expect(count('expenses_detail')).toBe(1);   // not touched unless asked
});

test('--also daily,expenses clears those too, only when asked', async () => {
  seed();
  await F.execute(pool, { also: ['daily', 'expenses'], scope: 'all' });
  expect(count('daily_summary')).toBe(0); expect(count('expenses_detail')).toBe(0);
  expect(count('suppliers')).toBe(1);
});

test('an unknown --also group is refused', () => {
  expect(() => F.tablesFor(['everything'])).toThrow(/unknown --also group/);
});

test('table names come from the fixed lists only', () => {
  for (const t of F.tablesFor(['daily', 'expenses'])) expect(t).toMatch(/^[a-z][a-z0-9_]*$/);
  expect(F.SCOPES.all).not.toEqual(expect.arrayContaining(['products', 'users', 'suppliers', 'app_settings', 'investor_loans', 'staff']));
});

test('scope clean clears only the junk and keeps customers, bills, GRNs and stock', async () => {
  seed();
  await F.execute(pool);   // default scope is clean
  for (const t of ['leads', 'document_inbox', 'notify_queue']) expect(count(t)).toBe(0);
  expect(count('customers')).toBe(2); expect(count('pos_bills')).toBe(2); expect(count('grn_records')).toBe(2); expect(count('vendor_bills')).toBe(1);
  expect(db.many(`SELECT stock_level FROM products ORDER BY id`).map(r => Number(r.stock_level))).not.toEqual([0, 0]);
});

test('an unknown scope is refused', () => {
  expect(() => F.tablesFor([], 'everything')).toThrow(/unknown scope/);
});

describe('backup gate', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wipebk-'));
  const mk = (name, size, ageMin = 0) => { const f = path.join(dir, name); fs.writeFileSync(f, Buffer.alloc(size, 1)); const t = new Date(Date.now() - ageMin * 60000); fs.utimesSync(f, t, t); return f; };
  test('no file, missing file, tiny file and old file are all refused', () => {
    expect(F.backupLooksGood('').ok).toBe(false);
    expect(F.backupLooksGood(path.join(dir, 'nope.sql')).ok).toBe(false);
    expect(F.backupLooksGood(mk('tiny.sql', 10)).ok).toBe(false);
    expect(F.backupLooksGood(mk('old.sql', 5000, 120)).why).toMatch(/older than 60 minutes/);
  });
  test('a real recent file is accepted', () => { expect(F.backupLooksGood(mk('good.sql', 5000, 5)).ok).toBe(true); });
});

describe('inbox photos', () => {
  test('only files inside dated folders are removed; other folders and links are left alone', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inbox-'));
    fs.mkdirSync(path.join(root, '2026-10-20')); fs.writeFileSync(path.join(root, '2026-10-20', 'a.jpg'), 'x'); fs.writeFileSync(path.join(root, '2026-10-20', 'b.jpg'), 'yy');
    fs.mkdirSync(path.join(root, 'keepme')); fs.writeFileSync(path.join(root, 'keepme', 'k.txt'), 'k');
    fs.writeFileSync(path.join(root, 'loose.jpg'), 'z');
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'outside-')); fs.writeFileSync(path.join(outside, 'secret.txt'), 's');
    try { fs.symlinkSync(outside, path.join(root, '2026-10-21'), 'dir'); } catch (e) { /* no symlinks here: fine */ }
    expect(F.inboxFiles(root)).toEqual({ files: 2, bytes: 3 });            // counting changes nothing
    expect(fs.existsSync(path.join(root, '2026-10-20', 'a.jpg'))).toBe(true);
    expect(F.inboxFiles(root, { remove: true })).toEqual({ files: 2, bytes: 3 });
    expect(fs.existsSync(path.join(root, '2026-10-20'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'keepme', 'k.txt'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'loose.jpg'))).toBe(true);
    expect(fs.existsSync(path.join(outside, 'secret.txt'))).toBe(true);
  });
  test('a missing inbox folder is fine', () => { expect(F.inboxFiles('/no/such/folder')).toEqual({ files: 0, bytes: 0 }); });
});
