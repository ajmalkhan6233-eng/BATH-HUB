'use strict';
jest.mock('../utils/pool', () => ({ connect: jest.fn(), query: jest.fn() }));
jest.mock('../routes/item_catalog', () => ({ createItem: jest.fn() }));
const { validatePackage } = require('../routes/grn_workbench');
const base = () => ({ vendor: { name: 'METRO' }, bill_no: 'ME2026/1797', bill_date: '2026-10-28', received_date: '2026-10-29', credit_days: 90, payment_type: 'BILL',
  lines: [{ vendor_code: 'ME599', name: 'TOWEL BAR', qty: 5, unit_cost: 1400, selling_price: 2500 }, { name: 'SINK TAP', qty: 3, unit_cost: 2800 }] });
test('good package: total, due date = received + 90', () => {
  const r = validatePackage(base());
  expect(r.total).toBe(15400); expect(r.due).toBe('2027-01-27'); expect(r.lines[1].sp).toBeNull();
});
test('total mismatch refused', () => { const p = base(); p.total = 99999; expect(() => validatePackage(p)).toThrow(/does not match/); });
test('duplicate line, zero qty, no bill number refused', () => {
  const a = base(); a.lines[1].name = 'towel bar'; expect(() => validatePackage(a)).toThrow(/twice/);
  const b = base(); b.lines[0].qty = 0; expect(() => validatePackage(b)).toThrow(/quantity/);
  const c = base(); c.bill_no = ''; expect(() => validatePackage(c)).toThrow(/Bill number/);
});
