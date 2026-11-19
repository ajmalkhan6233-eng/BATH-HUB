'use strict';
const { withRunningBalance, totalsOf } = require('../utils/vendor360');
const createRouter = require('../routes/vendor360');

describe('vendor360 statement maths', () => {
  const rows = [
    { id: 'p1', tx_date: '2026-10-05', created_at: '2026-10-05T09:00:00Z', debit: 0, credit: 20000 },
    { id: 'b1', tx_date: '2026-10-01', created_at: '2026-10-01T09:00:00Z', debit: 50000, credit: 0 },
    { id: 'b2', tx_date: '2026-10-05', created_at: '2026-10-05T08:00:00Z', debit: 1000.5, credit: 0 },
  ];
  test('oldest first, balance runs, same-day ties follow created_at', () => {
    const out = withRunningBalance(rows);
    expect(out.map(r => r.id)).toEqual(['b1', 'b2', 'p1']);
    expect(out.map(r => r.running_balance)).toEqual([50000, 51000.5, 31000.5]);
  });
  test('totals match the last balance and do not change the input', () => {
    const out = withRunningBalance(rows);
    expect(totalsOf(out)).toEqual({ debit: 51000.5, credit: 20000, balance: 31000.5 });
    expect(rows[0].running_balance).toBeUndefined();
  });
  test('empty is fine', () => { expect(withRunningBalance([])).toEqual([]); expect(totalsOf([]).balance).toBe(0); });
});

// Fake pool: answers by looking at the SQL text. Proves owner-only, cleared vs issued cheques, overdue and the statement.
function fakePool() {
  const bills = [
    { id: 1, vendor_name: 'ABC Traders', bill_no: 'INV-1', bill_date: '2026-09-01', due_date: '2026-09-10', total: '10000', grn_id: null, notes: null, created_at: '2026-09-01T05:00:00Z' },
    { id: 2, vendor_name: 'ABC Traders', bill_no: 'INV-2', bill_date: '2026-10-01', due_date: '2099-01-01', total: '5000', grn_id: null, notes: null, created_at: '2026-10-01T05:00:00Z' },
    { id: 3, vendor_name: 'Lanka Tiles', bill_no: 'T-1', bill_date: '2026-10-02', due_date: '2099-01-01', total: '3000', grn_id: null, notes: null, created_at: '2026-10-02T05:00:00Z' },
  ];
  const cheques = [
    { id: 1, bill_id: 1, cheque_no: 'C1', bank: 'Commercial', amount: '4000', status: 'CLEARED', cheque_date: '2026-09-05', due_date: '2026-09-06', cleared_at: '2026-09-06', created_at: '2026-09-05T05:00:00Z' },
    { id: 2, bill_id: 2, cheque_no: 'C2', bank: 'Commercial', amount: '5000', status: 'ISSUED', cheque_date: '2026-10-20', due_date: '2026-10-21', cleared_at: null, created_at: '2026-10-20T05:00:00Z' },
  ];
  const payments = [{ id: 1, bill_id: 1, amount: '1000', method: 'cash', paid_at: '2026-09-07', note: null, created_at: '2026-09-07T05:00:00Z' }];
  return { query: async (sql, args) => {
    const ids = (args && args[0]) || [];
    if (/FROM vendor_bills/.test(sql)) return { rows: /vendor_name = \$1/.test(sql) ? bills.filter(b => b.vendor_name === args[0]) : bills };
    if (/FROM vendor_bill_cheques/.test(sql)) return { rows: cheques.filter(c => ids.includes(c.bill_id)) };
    if (/FROM vendor_payments/.test(sql)) return { rows: payments.filter(c => ids.includes(c.bill_id)) };
    if (/FROM vendor_credit_notes/.test(sql)) return { rows: [] };
    if (/FROM grn_records/.test(sql)) return { rows: [{ grn_number: 'G1', grn_date: '2026-10-01', lines: 2, total: '900' }] };
    throw new Error('unexpected sql ' + sql);
  } };
}
function call(router, url, role) {
  return new Promise((resolve) => {
    const req = { method: 'GET', url, originalUrl: url, headers: {}, session: role ? { user: { role } } : undefined, params: {} };
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { resolve({ code: this.statusCode, body: b }); }, setHeader() {}, getHeader() {}, end() { resolve({ code: this.statusCode, body: null }); } };
    router.handle(req, res, () => resolve({ code: 404, body: null }));
  });
}
describe('vendor360 routes', () => {
  const router = createRouter({ pool: fakePool() });
  test('staff is refused', async () => { expect((await call(router, '/list', 'staff')).code).toBe(403); expect((await call(router, '/list')).code).toBe(403); });
  test('list: cleared cheque and cash reduce what we owe, an issued cheque does not', async () => {
    const r = await call(router, '/list', 'owner');
    expect(r.code).toBe(200);
    const abc = r.body.vendors.find(v => v.vendor_name === 'ABC Traders');
    expect(abc.total_billed).toBe(15000);
    expect(abc.total_paid).toBe(5000);
    expect(abc.outstanding_balance).toBe(10000);   // 15000 - 4000 cleared - 1000 cash; the 5000 ISSUED cheque is not counted
    expect(abc.cheques_pending).toBe(5000);
    expect(abc.overdue).toBe(5000);                // INV-1 owes 5000 and was due 2026-09-10
    expect(r.body.vendors[0].vendor_name).toBe('ABC Traders'); // biggest balance first
  });
  test('statement: newest first, ends at what we owe, issued cheque listed apart', async () => {
    const r = await call(router, '/ABC%20Traders/statement'.replace('%20', ' '), 'admin');
    expect(r.code).toBe(200);
    expect(r.body.rows[0].running_balance).toBe(10000);
    expect(r.body.totals).toEqual({ debit: 15000, credit: 5000, balance: 10000 });
    expect(r.body.pending_cheques).toHaveLength(1);
  });
  test('grns', async () => { const r = await call(router, '/ABC/grns', 'owner'); expect(r.body.grns[0].grn_number).toBe('G1'); });
  test('missing table answers empty, not an error', async () => {
    const bad = createRouter({ pool: { query: async () => { const e = new Error('relation "vendor_bills" does not exist'); e.code = '42P01'; throw e; } } });
    const r = await call(bad, '/list', 'owner'); expect(r.code).toBe(200); expect(r.body.vendors).toEqual([]);
  });
});
