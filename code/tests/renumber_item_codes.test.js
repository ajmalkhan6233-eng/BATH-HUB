'use strict';
// Throwaway database only (RBH_TEST_DB=bhtest). Skipped otherwise, so it can never touch real shop data.
const ON = process.env.RBH_TEST_DB === 'bhtest';
if (ON) Object.assign(process.env, { DB_HOST: '127.0.0.1', DB_PORT: '5432', DB_NAME: 'bhtest', DB_USER: 'bh', DB_PASSWORD: 'bh' });
(ON ? describe : describe.skip)('renumber_item_codes', () => {
  const { Client } = require('pg'); const R = require('../scripts/renumber_item_codes');
  let db;
  const codes = async () => (await db.query(`SELECT item_code, name FROM products WHERE name LIKE 'ZZR%' ORDER BY name`)).rows.map(r => r.name + '=' + r.item_code).join(',');
  beforeAll(async () => {
    db = new Client({ host: '127.0.0.1', port: 5432, database: 'bhtest', user: 'bh', password: 'bh' }); await db.connect();
    await db.query(`DELETE FROM products WHERE name LIKE 'ZZR%'; DELETE FROM grn_records WHERE supplier_name LIKE 'ZZR%'`);
    await db.query(`CREATE TABLE IF NOT EXISTS zzr_sale_items (id SERIAL, item_code TEXT, qty INT)`); await db.query(`DELETE FROM zzr_sale_items`);
    // arrival order in time: Leo first by accident (code 900), then Metro (950), Fazal (960), Afam (970), Imran (980)
    const rows = [['ZZR leo item', '900', 'ZZR Leo Traders'], ['ZZR metro item', '950', 'ZZR Metro (Pvt)'], ['ZZR fazal item', '960', 'ZZR Fazal Hardware'], ['ZZR afam item', '970', 'ZZR Afam'], ['ZZR imran item', '980', 'ZZR Imran Uncle']];
    for (const [n, c, v] of rows) {
      await db.query(`INSERT INTO products (item_code, name, active) VALUES ($1,$2,true)`, [c, n]);
      await db.query(`INSERT INTO grn_records (grn_number, supplier_name, item_description, quantity, unit_cost, total_amount) VALUES ('1',$1,$2,1,1,1)`, [v, c + ' - ' + n]);
      await db.query(`INSERT INTO zzr_sale_items (item_code, qty) VALUES ($1, 1)`, [c]);
    }
  });
  afterAll(async () => { await db.query(`DELETE FROM products WHERE name LIKE 'ZZR%'; DELETE FROM grn_records WHERE supplier_name LIKE 'ZZR%'; DROP TABLE IF EXISTS zzr_sale_items`); await db.end(); });
  test('dry run: plan keeps Metro, orders the rest Fazal, Afam, Imran, Leo; changes nothing', async () => {
    const before = await codes(); const p = await R.plan(db);
    const mine = p.map.filter(m => /^ZZR/.test(m.name)).map(m => m.name.replace('ZZR ', '') + ':' + m.old + '>' + m.new);
    const metro = mine.find(x => x.startsWith('metro')); expect(metro).toBe('metro item:950>950');
    const order = p.map.filter(m => /^ZZR/.test(m.name) && m.rank > 0).map(m => m.name);
    expect(order).toEqual(['ZZR fazal item', 'ZZR afam item', 'ZZR imran item', 'ZZR leo item']);
    expect(await codes()).toBe(before);
  });
  test('apply updates products, sale lines, GRN text; undo restores everything', async () => {
    const before = await codes(); const p = await R.plan(db);
    const r = await R.apply(db, p.map); expect(r.changed).toBeGreaterThan(0);
    const after = await codes(); expect(after).not.toBe(before);
    const fz = (await db.query(`SELECT item_code FROM products WHERE name='ZZR fazal item'`)).rows[0].item_code;
    expect((await db.query(`SELECT qty FROM zzr_sale_items WHERE item_code=$1`, [fz])).rows.length).toBe(1);
    expect((await db.query(`SELECT item_description FROM grn_records WHERE supplier_name='ZZR Fazal Hardware'`)).rows[0].item_description).toBe(fz + ' - ZZR fazal item');
    expect((await db.query(`SELECT COUNT(*)::int n FROM products WHERE item_code LIKE 'TMP-%'`)).rows[0].n).toBe(0);
    await R.undo(db); expect(await codes()).toBe(before);
    expect((await db.query(`SELECT item_description FROM grn_records WHERE supplier_name='ZZR Fazal Hardware'`)).rows[0].item_description).toBe('960 - ZZR fazal item');
  });
});
