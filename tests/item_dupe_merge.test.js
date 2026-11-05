'use strict';
const ON = process.env.RBH_TEST_DB === 'bhtest';
if (ON) Object.assign(process.env, { DB_HOST: '127.0.0.1', DB_PORT: '5432', DB_NAME: 'bhtest', DB_USER: 'bh', DB_PASSWORD: 'bh', PG_BOOT_SERIAL_MS: '0' });
(ON ? describe : describe.skip)('item_dupe_merge', () => {
  let pool, M;
  const one = async (sql, a) => (await pool.query(sql, a || [])).rows[0];
  const wipe = async () => { await pool.query(`DELETE FROM grn_records WHERE grn_number LIKE 'ZZD%'`); await pool.query(`DELETE FROM products WHERE name LIKE 'ZZD%'`); };
  beforeAll(async () => {
    pool = require('../utils/pool'); await require('../scripts/migrate_vendor_ledger').migrate(pool); M = require('../routes/item_dupe_merge'); await wipe();
    await pool.query(`INSERT INTO products (item_code, name, stock_level, active) VALUES ('7701','ZZD FH1 TAP SQ',0,true),('7702','ZZD FH2 TAP SQ',0,true),('7801','ZZD FH1 TAP SQ',5,true),('7802','ZZD K/SINK FH2',3,true)`);
    await pool.query(`INSERT INTO grn_records (grn_number, supplier_name, item_description, quantity, unit_cost, total_amount) VALUES ('ZZD1','Fazaal','7801 - ZZD FH1 TAP SQ',5,1,5),('ZZD1','Fazaal','7802 - ZZD K/SINK FH2',3,1,3)`);
  });
  afterAll(async () => { await wipe(); await pool.end(); });
  const extra = [{ code: '7701', from: 'ZZD FH1 TAP SQ', name: 'ZZD FH1 TAP SQ' }, { code: '7702', from: 'ZZD K/SINK FH2', name: 'ZZD FH2 K/SINK' }];
  test('plan changes nothing; apply gives the real item the typed number', async () => {
    const p = await M.plan(pool, extra); expect(p.pairs.length).toBe(2); expect(p.problems).toEqual([]);
    expect((await one(`SELECT item_code FROM products WHERE name='ZZD K/SINK FH2'`)).item_code).toBe('7802');
    const r = await M.apply(pool, { extra }); expect(r.ok).toBe(true); expect(r.merged).toBe(2);
    const a = await one(`SELECT item_code, stock_level FROM products WHERE name='ZZD FH1 TAP SQ' AND active`); expect(a.item_code).toBe('7701'); expect(Number(a.stock_level)).toBe(5);
    const b = await one(`SELECT item_code, stock_level FROM products WHERE name='ZZD FH2 K/SINK'`); expect(b.item_code).toBe('7702'); expect(Number(b.stock_level)).toBe(3);
    expect((await one(`SELECT item_description d FROM grn_records WHERE grn_number='ZZD1' AND item_description LIKE '7702%'`)).d).toBe('7702 - ZZD K/SINK FH2');
    expect((await one(`SELECT COUNT(*)::int n FROM products WHERE item_code LIKE 'DUP-77%' AND active=false`)).n).toBe(2);
  });
  test('second run changes nothing', async () => { const r = await M.apply(pool, { extra }); expect(r.ok).toBe(true); expect(r.merged).toBe(0); });
});
