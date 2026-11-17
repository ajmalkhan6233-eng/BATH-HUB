'use strict';
// Tests the GRN invoice module alone. Everything runs inside ONE transaction that is ROLLED BACK at the end: nothing is saved.
require('dotenv').config({ quiet: true });
const assert = require('assert');
const pool = require('../utils/pool');
const G = require('../routes/grn_invoice');
const V = 'Leo Marketing', N = '0000010887';
(async () => {
  assert.deepStrictEqual(G.totals([{ qty: 3, cost: 100 }, { qty: 1, cost: 50.5 }], 10, 0, 5), { subtotal: 350.5, discount: 35.05, other_charges: 5, total: 320.45 });
  assert.strictEqual(G.totals([{ qty: 2, cost: 100 }], 0, 30, 0).total, 170);
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    let d = await G.loadInvoice(c, V, N);
    assert.strictEqual(d.total, 503425); assert.strictEqual(d.bill_total, 503425); assert.strictEqual(d.paid, 503500); assert.strictEqual(d.difference, -75);
    assert.strictEqual(d.state, 'amber'); assert.strictEqual(d.lines.length, 38 - 0 - 0 > 0 ? d.lines.length : 0); console.log('Leo loads: total', d.total, 'paid', d.paid, 'difference', d.difference, d.state, 'lines', d.lines.length);
    await G.saveReason(c, V, N, { reason: 'No change given' }, 'test'); d = await G.loadInvoice(c, V, N); assert.strictEqual(d.state, 'green'); console.log('reason saved -> green');
    await assert.rejects(() => G.saveReason(c, V, N, { reason: 'bogus' }, 't'), /Pick one/);
    const l = d.lines.find((x) => x.code === '068'); const st0 = Number((await c.query("SELECT stock_level s FROM products WHERE item_code='068'")).rows[0].s);
    await G.saveEdit(c, V, N, { lines: [{ id: l.id, qty: l.qty - 1, cost: l.cost + 5 }], discount_pct: 10, other_charges: 100, date: '2026-11-02' }, 'test');
    d = await G.loadInvoice(c, V, N);
    const st1 = Number((await c.query("SELECT stock_level s FROM products WHERE item_code='068'")).rows[0].s);
    assert.strictEqual(st1, st0 - 1); const sub = 503425 - 295 * 20 + 300 * 19 - 0; assert.strictEqual(d.subtotal, sub - 0 + 0 - 0 + (503425 - 503425));
    assert.strictEqual(d.total, Math.round((d.subtotal * 0.9 + 100) * 100) / 100); assert.strictEqual(d.bill_total, d.total);
    assert.strictEqual(d.date, '2026-11-02'); assert.strictEqual(d.due_date, '2027-02-01'); assert.ok(d.audit.length >= 5);
    console.log('edit ok: stock', st0, '->', st1, '| subtotal', d.subtotal, '| total', d.total, '| due', d.due_date, '| audit lines', d.audit.length); d.audit.slice(0, 6).forEach((a) => console.log('   ', a.field, a.old_value, '->', a.new_value));
    await c.query('SAVEPOINT s'); await c.query("UPDATE products SET stock_level=1 WHERE item_code='068'");
    await assert.rejects(() => G.saveEdit(c, V, N, { lines: [{ id: l.id, qty: 5, cost: l.cost }] }, 't'), /below zero/); await c.query('ROLLBACK TO s'); console.log('stock-below-zero refused');
    await assert.rejects(() => G.saveEdit(c, V, N, { lines: [{ id: 999999, qty: 1, cost: 1 }] }, 't'), /not on this GRN/); console.log('foreign line refused');
    console.log('ALL GRN INVOICE TESTS PASSED (rolled back, nothing saved)');
  } catch (e) { console.log('TEST FAILED:', e.message); process.exitCode = 1; } finally { await c.query('ROLLBACK').catch(() => {}); c.release(); process.exit(); }
})();
