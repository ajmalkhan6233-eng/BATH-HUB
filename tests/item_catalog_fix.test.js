'use strict';
// item_catalog_fix on the throwaway database only (RBH_TEST_DB=bhtest). Names lose "?", vendor code moves behind the name, Leo's typed codes are applied, GRN lines stop showing OLD-.
const ON = process.env.RBH_TEST_DB === 'bhtest';
if (ON) Object.assign(process.env, { DB_HOST: '127.0.0.1', DB_PORT: '5432', DB_NAME: 'bhtest', DB_USER: 'bh', DB_PASSWORD: 'bh', PG_BOOT_SERIAL_MS: '0' });
(ON ? describe : describe.skip)('item_catalog_fix', () => {
  let pool, F;
  const one = async (sql, a) => (await pool.query(sql, a || [])).rows[0];
  const wipe = async () => {
    await pool.query(`DELETE FROM grn_records WHERE grn_number LIKE 'ZZC%'`);
    await pool.query(`DELETE FROM grn_bill_extra WHERE bill_id=987654`);
    await pool.query(`DELETE FROM products WHERE item_code IN ('OLD-901','901','OLD-959','959','951','0065','0066','159','160','999') OR name LIKE 'ZZC%'`);
  };
  beforeAll(async () => {
    pool = require('../utils/pool'); await require('../scripts/migrate_vendor_ledger').migrate(pool);
    await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS vendor_code TEXT`);
    await pool.query(`CREATE TABLE IF NOT EXISTS grn_bill_extra (bill_id INT PRIMARY KEY, paper_total NUMERIC, lines JSONB, updated_at TIMESTAMPTZ DEFAULT NOW())`);
    F = require('../routes/item_catalog_fix'); await wipe();
    const P = (code, name, st, vc) => pool.query(`INSERT INTO products (item_code, name, stock_level, active, vendor_code) VALUES ($1,$2,$3,true,$4)`, [code, name, st, vc || null]);
    await P('OLD-901', 'ZZC ORVEL SHELF', 0); await P('901', 'ZZC ORVEL SHELF', 10);
    await P('OLD-959', 'FH 1208 ZZC Flexible Tap?', 0); await P('959', 'FH 1208 ZZC Flexible Tap?', 0);
    await P('951', 'M4-16 ZZC SINK TAP CHROME', 8);
    await P('159', 'ZZC HAND SHOWER 305', 4); await P('160', 'ZZC HAND SHOWER AUSCO', 4);
    await P('999', 'ZZC BIB TAP T101', 2, 'WT00052');
    await pool.query(`INSERT INTO grn_records (grn_number, supplier_name, item_description, quantity, unit_cost, total_amount) VALUES ('ZZC1','Metro Enterprises','OLD-901 - ZZC ORVEL SHELF',10,1,10), ('ZZC2','Leo Marketing','159 - ZZC HAND SHOWER 305',4,1,4)`);
    await pool.query(`INSERT INTO grn_bill_extra (bill_id, lines) VALUES (987654, $1::jsonb)`, [JSON.stringify([{ name: 'ZZC HAND SHOWER 305', vendor_code: '0065' }, { name: 'ZZC HAND SHOWER AUSCO', vendor_code: '0066' }, { name: 'ZZC NOT AN ITEM', vendor_code: '0067' }, { name: 'ZZC BIB TAP T101', vendor_code: '0318001057' }])]);
  });
  afterAll(async () => { await wipe(); await pool.end(); });
  test('plan changes nothing and finds the work', async () => {
    const p = await F.plan(pool);
    expect(p.renames.filter(r => /ZZC/.test(r.old)).map(r => r.new).sort()).toEqual(['ZZC BIB TAP T101 WT00052', 'ZZC Flexible Tap FH1208', 'ZZC SINK TAP CHROME M4-16'].sort());
    expect(p.codes.filter(c => /ZZC/.test(c.name)).map(c => c.old + '>' + c.new).sort()).toEqual(['159>0065', '160>0066']);
    expect((await one(`SELECT name FROM products WHERE item_code='959'`)).name).toBe('FH 1208 ZZC Flexible Tap?');
  });
  test('apply: names, Leo codes, GRN lines; stock and OLD twins untouched; second run does nothing', async () => {
    const r = await F.apply(pool, { noFile: true });
    expect(r.ok).toBe(true);
    expect((await one(`SELECT name, vendor_code FROM products WHERE item_code='999'`))).toEqual({ name: 'ZZC BIB TAP T101 WT00052', vendor_code: null });
    expect((await one(`SELECT name FROM products WHERE item_code='959'`)).name).toBe('ZZC Flexible Tap FH1208');
    expect((await one(`SELECT name FROM products WHERE item_code='951'`)).name).toBe('ZZC SINK TAP CHROME M4-16');
    expect((await one(`SELECT name, stock_level::int s FROM products WHERE item_code='0065'`))).toEqual({ name: 'ZZC HAND SHOWER 305', s: 4 });
    expect((await one(`SELECT count(*)::int n FROM products WHERE item_code IN ('159','160')`)).n).toBe(0);
    expect((await one(`SELECT item_description d FROM grn_records WHERE grn_number='ZZC1'`)).d).toBe('901 - ZZC ORVEL SHELF');
    expect((await one(`SELECT item_description d FROM grn_records WHERE grn_number='ZZC2'`)).d).toBe('0065 - ZZC HAND SHOWER 305');
    expect((await one(`SELECT name FROM products WHERE item_code='OLD-959'`)).name).toBe('FH 1208 ZZC Flexible Tap?');   // the old twin is left alone
    const again = await F.apply(pool, { noFile: true });
    expect(again.ok && again.renamed === 0 && again.codes_changed === 0).toBe(true);
  });
});
