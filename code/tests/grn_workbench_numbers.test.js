'use strict';
// Per-vendor GRN number check against grn_records + vendor_bills. READ-ONLY route.
// Runs ONLY when asked for the cloud throwaway database:  RBH_TEST_DB=bhtest  (see scripts/dev/cloud_rig.sh, user bh / db bhtest).
// The connection is hard-set to that throwaway database here, never to the shop's .env, so it cannot touch real shop data. Otherwise skipped.
const ON = process.env.RBH_TEST_DB === 'bhtest';
if (ON) Object.assign(process.env, { DB_HOST: '127.0.0.1', DB_PORT: '5432', DB_NAME: 'bhtest', DB_USER: 'bh', DB_PASSWORD: 'bh' });
const d = ON ? describe : describe.skip;
d('GET /api/grn-workbench/check (vendor + number)', () => {
  const express = require('express'), request = require('supertest');
  const pool = require('../utils/pool');
  const V1 = 'ZZTEST Cool Lanka', V2 = 'ZZTEST Other Vendor', V3 = 'ZZTEST New Vendor';
  let app;
  const count = async () => (await pool.query(`SELECT (SELECT COUNT(*) FROM grn_records) a, (SELECT COUNT(*) FROM vendor_bills) b, (SELECT COUNT(*) FROM products) c`)).rows[0];
  beforeAll(async () => {
    app = express(); app.use('/api', require('../routes/grn_workbench'));
    await pool.query(`DELETE FROM grn_records WHERE supplier_name LIKE 'ZZTEST%'`);
    await pool.query(`DELETE FROM vendor_bills WHERE vendor_name LIKE 'ZZTEST%'`);
    // V2 has number 001 FIRST (older), V1 has 001 and 002 as plain GRN records (no vendor bill)
    await pool.query(`INSERT INTO grn_records (grn_number, supplier_name, grn_date, item_description, quantity, unit_cost, total_amount) VALUES
      ('001',$2,'2026-09-01','x',1,10,10), ('001',$1,'2026-10-28','y',1,527000,527000), ('002',$1,'2026-10-29','z',1,5,5)`, [V1, V2]);
  });
  afterAll(async () => {
    await pool.query(`DELETE FROM grn_records WHERE supplier_name LIKE 'ZZTEST%'`);
    await pool.query(`DELETE FROM vendor_bills WHERE vendor_name LIKE 'ZZTEST%'`);
    await pool.end();
  });
  const chk = (v, n) => request(app).get('/api/grn-workbench/check').query({ vendor: v, bill_no: n });
  test('duplicate for the SAME vendor is found even when another vendor has the same number', async () => {
    const r = await chk(V1, '001');
    expect(r.body.exists).toBe(true); expect(r.body.bill.vendor_name).toBe(V1); expect(String(r.body.bill.bill_date)).toBe('2026-10-28'); expect(Number(r.body.bill.total)).toBe(527000);
  });
  test('001, 01 and 1 are the same number', async () => {
    for (const n of ['1', '01', ' 001 ']) expect((await chk(V1, n)).body.exists).toBe(true);
  });
  test('offers the next free number (003 after 001, 002), keeping three digits', async () => {
    expect((await chk(V1, '001')).body.next_free).toBe('003');
  });
  test('a free number for this vendor is not a duplicate; vendor with no GRNs gets 001', async () => {
    expect((await chk(V1, '009')).body.exists).toBe(false);
    const r = await chk(V3, '');
    expect(r.body.exists).toBe(false); expect(r.body.next_free).toBe('001');
  });
  test('paper style numbers get no suggestion', async () => {
    const r = await chk(V1, 'ME2026/1757'); expect(r.body.exists).toBe(false);
    expect((await pool.query(`SELECT 1`)).rows.length).toBe(1);
  });
  test('checking never changes any data', async () => {
    const before = await count(); await chk(V1, '001'); await chk(V3, ''); await chk(V1, '777');
    expect(await count()).toEqual(before);
  });
});
