const G = require('../utils/cashierGate');
test('cashier can sell but not see money or change history', () => {
  ['GET /api/me', 'POST /api/pos-bills', 'GET /api/items?q=tap', 'GET /api/pos-bills/today', 'GET /api/pos-bills/12/pdf', 'POST /api/invoice-receipts/send', 'GET /api/customers'].forEach(x => { const [m, p] = x.split(' '); expect([x, G.allowed(m, p)]).toEqual([x, true]); });
  ['GET /api/dashboard-pro', 'GET /api/profit', 'POST /api/pos-bills/5/void', 'PUT /api/pos-bills/5', 'POST /api/grn-manual', 'GET /api/vendor-ledger', 'POST /api/staff-logins', 'GET /api/price-helper', 'POST /api/pos-bills/5'].forEach(x => { const [m, p] = x.split(' '); expect([x, G.allowed(m, p)]).toEqual([x, false]); });
});
test('strip removes cost-like fields everywhere', () => { expect(G.strip({ a: 1, avg_cost: 5, rows: [{ name: 'x', cost: 2, unit_cost: 3, price: 9 }] })).toEqual({ a: 1, rows: [{ name: 'x', price: 9 }] }); });
test('weak PINs refused', () => { ['', '12', '1234', '1111', 'abcd', '123456789', '000000'].forEach(p => expect(G.weakPin(p)).toBe(true)); ['4821', '90317'].forEach(p => expect(G.weakPin(p)).toBe(false)); });
