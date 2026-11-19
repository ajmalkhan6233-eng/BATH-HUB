'use strict';
// GRN cancel, alone. Everything runs in ONE transaction that is ROLLED BACK: nothing is saved.
require('dotenv').config({ quiet: true });
const assert = require('assert'); const pool = require('../utils/pool'); const G = require('../routes/grn_invoice');
(async () => {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await assert.rejects(() => G.cancelBill(c, 'Leo Marketing', '0000010887', { reason: 'x' }, 't'), /reason is required/);
    await assert.rejects(() => G.cancelBill(c, 'Leo Marketing', '0000010887', { reason: 'test cancel' }, 't'), /still has cheques or payments/);
    console.log('Leo (has cheques): refused, good');
    const st0 = Number((await c.query("SELECT stock_level s FROM products WHERE item_code='349'")).rows[0].s);
    const r = await G.cancelBill(c, 'Lucky Trading', 'V1017', { reason: 'test cancel (rolled back)' }, 'test');
    const st1 = Number((await c.query("SELECT stock_level s FROM products WHERE item_code='349'")).rows[0].s);
    const b = (await c.query("SELECT voided FROM vendor_bills WHERE bill_no='V1017'")).rows[0];
    const left = (await c.query("SELECT COUNT(*) n FROM grn_records WHERE grn_number='V1017'")).rows[0].n;
    const arch = (await c.query("SELECT COUNT(*) n FROM grn_records_archive WHERE grn_number='V1017'")).rows[0].n;
    const aud = (await c.query("SELECT COUNT(*) n FROM grn_audit WHERE field='bill cancelled'")).rows[0].n;
    assert.strictEqual(b.voided, true); assert.strictEqual(Number(left), 0); assert.ok(Number(arch) >= 4); assert.strictEqual(st1, st0 - 3); assert.ok(Number(aud) >= 1);
    console.log('Lucky V1017 cancelled:', JSON.stringify(r), '| stock 349', st0, '->', st1, '| archived rows', arch, '| audit lines', aud);
    await assert.rejects(() => G.cancelBill(c, 'Lucky Trading', 'V1017', { reason: 'again' }, 't'), /not found or already/);
    console.log('GRN CANCEL TESTS PASSED (rolled back, nothing saved)');
  } catch (e) { console.log('TEST FAILED:', e.message); process.exitCode = 1; } finally { await c.query('ROLLBACK').catch(() => {}); c.release(); process.exit(); }
})();
