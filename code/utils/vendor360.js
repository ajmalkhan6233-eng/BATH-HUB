'use strict';
// Vendor 360: pure helpers (no database). Used by routes/vendor360.js and tests/vendor360.test.js.
const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// rows: [{tx_date, created_at, id, debit, credit, ...}] in ANY order -> oldest first, each with a running balance.
// Ties on the same day are broken by created_at then id, so the balance is always the same for the same data.
function withRunningBalance(rows) {
  const key = r => [String(r.tx_date).slice(0, 10), String(r.created_at || ''), String(r.id || '').padStart(12, '0')].join('|');
  const sorted = rows.slice().sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
  let bal = 0;
  return sorted.map(r => {
    bal = round2(bal + Number(r.debit || 0) - Number(r.credit || 0));
    return Object.assign({}, r, { debit: round2(r.debit || 0), credit: round2(r.credit || 0), running_balance: bal });
  });
}

// Does the statement end where the list says it should? (A bill can never go below zero, so an overpaid bill makes them differ.)
function totalsOf(rows) {
  const debit = round2(rows.reduce((a, r) => a + Number(r.debit || 0), 0));
  const credit = round2(rows.reduce((a, r) => a + Number(r.credit || 0), 0));
  return { debit, credit, balance: round2(debit - credit) };
}

module.exports = { round2, withRunningBalance, totalsOf };
