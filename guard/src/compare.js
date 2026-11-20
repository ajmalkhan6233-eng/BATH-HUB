'use strict';
// NUMBERS GUARD, part 2: compare the change that really happened with the change the task said to expect.
// expected.json lists only what should move; anything not listed must stay exactly the same.
const KEYS = ['item_count', 'stock_pieces', 'stock_value_cost', 'cheque_total', 'pos_bill_count', 'pos_bill_total', 'cash_in_ledger'];
const TOL = 0.01;
function compare(before, after, expected) {
  const exp = expected || {}; const fails = []; const lines = [];
  for (const k of KEYS) {
    if (before[k] === undefined || after[k] === undefined) continue;
    const got = Math.round((after[k] - before[k]) * 100) / 100; const want = Number(exp[k] || 0);
    const ok = Math.abs(got - want) <= TOL; lines.push(`${ok ? 'ok ' : 'BAD'} ${k}: changed ${got}, expected ${want}`);
    if (!ok) fails.push(`${k}: changed ${got}, expected ${want}`);
  }
  const names = new Set([...Object.keys(before.vendor_owed || {}), ...Object.keys(after.vendor_owed || {}), ...Object.keys(exp.vendor_owed || {})]);
  for (const n of names) {
    const got = Math.round(((after.vendor_owed || {})[n] || 0) * 100 - ((before.vendor_owed || {})[n] || 0) * 100) / 100; const want = Number((exp.vendor_owed || {})[n] || 0);
    if (got === 0 && want === 0) continue;
    const ok = Math.abs(got - want) <= TOL; lines.push(`${ok ? 'ok ' : 'BAD'} owed ${n}: changed ${got}, expected ${want}`);
    if (!ok) fails.push(`owed ${n}: changed ${got}, expected ${want}`);
  }
  return { ok: fails.length === 0, fails, lines };
}
module.exports = { compare };
