'use strict';
// fixDupes() stock clamp (5 Nov 2026). Throwaway database only (RBH_TEST_DB=bhtest). Skipped otherwise, so it can never touch real shop data.
// Scenario = the Metro case: bill ZZD/1 has its own GRN lines; GRNs ZZD-01 + ZZD-02 are the same goods entered twice, but their lines
// point to OLD items whose stock is already 0 (the real stock sits on the bill's own TBD items).
const ON = process.env.RBH_TEST_DB === 'bhtest';
if (ON) Object.assign(process.env, { DB_HOST: '127.0.0.1', DB_PORT: '5432', DB_NAME: 'bhtest', DB_USER: 'bh', DB_PASSWORD: 'bh', PG_BOOT_SERIAL_MS: '0' });
(ON ? describe : describe.skip)('grn_dupes fixDupes stock clamp', () => {
  const V = 'ZZD Test Vendor';
  let pool, G;
  const stock = async code => Number((await pool.query(`SELECT stock_level FROM products WHERE item_code=$1`, [code])).rows[0].stock_level);
  const live = async () => Number((await pool.query(`SELECT COUNT(*) n FROM grn_records WHERE supplier_name=$1 AND grn_number IN ('ZZD-01','ZZD-02')`, [V])).rows[0].n);
  const archived = async () => Number((await pool.query(`SELECT COUNT(*) n FROM grn_records_archive WHERE supplier_name=$1`, [V])).rows[0].n);
  const wipe = async () => {
    await pool.query(`DELETE FROM grn_records WHERE supplier_name=$1`, [V]);
    await pool.query(`DELETE FROM vendor_bills WHERE vendor_name=$1`, [V]);
    await pool.query(`DELETE FROM products WHERE item_code LIKE 'ZZD-%'`);
    if ((await pool.query(`SELECT to_regclass('grn_records_archive') t`)).rows[0].t) await pool.query(`DELETE FROM grn_records_archive WHERE supplier_name=$1`, [V]);
  };
  // olds = stock of OLD1..OLD4; duplicate lines have qty 5, 4, 6, 3 (totals 500, 400, 600, 300 = bill 1800)
  const seed = async olds => {
    await wipe();
    const qty = [5, 4, 6, 3], tot = [500, 400, 600, 300];
    for (let i = 0; i < 4; i++) {
      const n = i + 1;
      await pool.query(`INSERT INTO products (item_code, name, stock_level, active) VALUES ($1,$2,$3,true), ($4,$5,$6,true)`,
        ['ZZD-OLD' + n, 'ZZD old item ' + n, olds[i], 'ZZD-TBD' + n, 'ZZD tbd item ' + n, qty[i]]);
      // the bill's own line (bill number ZZD/1) and the duplicate line (orphan GRN ZZD-01 or ZZD-02)
      await pool.query(`INSERT INTO grn_records (grn_number, supplier_name, item_description, quantity, unit_cost, total_amount) VALUES ('ZZD/1',$1,$2,$3,$4,$5)`,
        [V, 'ZZD-TBD' + n + ' - ZZD tbd item ' + n, qty[i], tot[i] / qty[i], tot[i]]);
      await pool.query(`INSERT INTO grn_records (grn_number, supplier_name, item_description, quantity, unit_cost, total_amount) VALUES ($1,$2,$3,$4,$5,$6)`,
        [i < 2 ? 'ZZD-01' : 'ZZD-02', V, 'ZZD-OLD' + n + ' - ZZD old item ' + n, qty[i], tot[i] / qty[i], tot[i]]);
    }
    await pool.query(`INSERT INTO vendor_bills (vendor_name, bill_no, bill_date, total) VALUES ($1,'ZZD/1',CURRENT_DATE,1800)`, [V]);
  };
  beforeAll(async () => {
    pool = require('../utils/pool');
    await require('../scripts/migrate_vendor_ledger').migrate(pool);
    await pool.query(`CREATE TABLE IF NOT EXISTS grn_records_archive (LIKE grn_records INCLUDING DEFAULTS)`);
    await pool.query(`ALTER TABLE grn_records_archive ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NOW()`);
    await pool.query(`ALTER TABLE grn_records_archive ADD COLUMN IF NOT EXISTS archived_reason TEXT`);
    G = require('../routes/grn_dupes');
  });
  afterAll(async () => { await wipe(); await pool.end(); });

  test('setup is detected as a double-count (plan finds ZZD-01 + ZZD-02)', async () => {
    await seed([0, 0, 0, 0]);
    const found = (await G.plan()).filter(f => f.vendor === V);
    expect(found).toHaveLength(1);
    expect(found[0].duplicate_numbers.sort()).toEqual(['ZZD-01', 'ZZD-02']);
  });

  test('all OLD items at 0 stock: no abort, nothing goes negative, 58-row case archived', async () => {
    await seed([0, 0, 0, 0]);
    const r = await G.fixDupes(['ZZD-01', 'ZZD-02']);
    expect(r).toEqual({ lines: 4, items: 4, clamped: 4 });
    for (let n = 1; n <= 4; n++) expect(await stock('ZZD-OLD' + n)).toBe(0);
    for (const [n, q] of [[1, 5], [2, 4], [3, 6], [4, 3]]) expect(await stock('ZZD-TBD' + n)).toBe(q);   // the real stock is untouched
    expect(await live()).toBe(0);
    expect(await archived()).toBe(4);
    expect((await pool.query(`SELECT archived_reason r FROM grn_records_archive WHERE supplier_name=$1 LIMIT 1`, [V])).rows[0].r).toMatch(/double-counted/);
    expect(Number((await pool.query(`SELECT COUNT(*) n FROM grn_records WHERE grn_number='ZZD/1'`)).rows[0].n)).toBe(4);   // the bill's own lines stay
  });

  test('partial stock: takes back only what is there (min of stock and qty), counts clamped lines', async () => {
    await seed([0, 4, 2, 10]);   // qty 5,4,6,3 -> take 0 (clamped), 4 (exact, not clamped), 2 (clamped), 3 (not clamped)
    const r = await G.fixDupes(['ZZD-01', 'ZZD-02']);
    expect(r).toEqual({ lines: 4, items: 4, clamped: 2 });
    expect([await stock('ZZD-OLD1'), await stock('ZZD-OLD2'), await stock('ZZD-OLD3'), await stock('ZZD-OLD4')]).toEqual([0, 0, 0, 7]);
    expect((await pool.query(`SELECT MIN(stock_level) m FROM products WHERE item_code LIKE 'ZZD-%'`)).rows[0].m >= 0).toBe(true);
    expect(await archived()).toBe(4);
  });

  test('enough stock: normal path unchanged (full quantity taken, clamped 0)', async () => {
    await seed([5, 4, 6, 3]);
    const r = await G.fixDupes(['ZZD-01', 'ZZD-02']);
    expect(r.clamped).toBe(0);
    expect([await stock('ZZD-OLD1'), await stock('ZZD-OLD2'), await stock('ZZD-OLD3'), await stock('ZZD-OLD4')]).toEqual([0, 0, 0, 0]);
    expect(await archived()).toBe(4);
  });

  test('a GRN that is not a double-count is still rejected (400), nothing changes', async () => {
    await seed([0, 4, 2, 10]);
    await pool.query(`INSERT INTO grn_records (grn_number, supplier_name, item_description, quantity, unit_cost, total_amount) VALUES ('ZZD-99',$1,'ZZD-OLD4 - ZZD old item 4',1,1,1)`, [V]);
    await expect(G.fixDupes(['ZZD-99'])).rejects.toMatchObject({ status: 400 });
    await expect(G.fixDupes(['ZZD-01', 'ZZD-99'])).rejects.toMatchObject({ status: 400 });
    expect([await stock('ZZD-OLD1'), await stock('ZZD-OLD2'), await stock('ZZD-OLD3'), await stock('ZZD-OLD4')]).toEqual([0, 4, 2, 10]);
    expect(await archived()).toBe(0);
  });

  test('all-or-nothing: an item whose name changed rejects (409) and rolls everything back', async () => {
    await seed([0, 4, 2, 10]);
    await pool.query(`UPDATE products SET name='ZZD renamed' WHERE item_code='ZZD-OLD4'`);
    await expect(G.fixDupes(['ZZD-01', 'ZZD-02'])).rejects.toMatchObject({ status: 409 });
    expect([await stock('ZZD-OLD1'), await stock('ZZD-OLD2'), await stock('ZZD-OLD3'), await stock('ZZD-OLD4')]).toEqual([0, 4, 2, 10]);
    expect(await live()).toBe(4);
    expect(await archived()).toBe(0);
  });
});
