'use strict';
const { creditView, stateText, oneLine, owedBy } = require('../../utils/vendorCredit');
const TODAY = '2026-10-16';
const bill = (o = {}) => ({ id: 1, vendor_name: 'Metro', bill_no: 'MG-1', bill_date: '2026-10-16', due_date: null, total: 680000, voided: false, ...o });
const ch = (amount, due, status = 'ISSUED', no = 'C1') => ({ cheque_no: no, amount, cheque_date: due, due_date: due, status });

test('new GRN, no cheque written: payment pending, all of it owed', () => {
  const v = creditView([{ bill: bill(), cheques: [], payments: [], credits: [] }], TODAY).vendors[0];
  expect(v.owed).toBe(680000); expect(v.notWritten).toBe(680000); expect(v.writtenNotClear).toBe(0);
  expect(v.bills[0].state).toBe('UNPAID');
  expect(v.bills[0].status_text).toBe('Cheque not written, payment pending');
  expect(v.after[1]).toBe(680000); expect(v.after[3]).toBe(680000);   // nothing written, nothing falls away
});

test('4 equal cheques written, one a month: owed falls month by month', () => {
  const cheques = [ch(170000, '2026-11-16', 'ISSUED', 'A'), ch(170000, '2026-12-16', 'ISSUED', 'B'), ch(170000, '2027-01-16', 'ISSUED', 'C'), ch(170000, '2027-02-16', 'ISSUED', 'D')];
  const r = creditView([{ bill: bill(), cheques, payments: [], credits: [] }], TODAY);
  const v = r.vendors[0];
  expect(v.owed).toBe(680000);            // none cleared yet: still owed
  expect(v.writtenNotClear).toBe(680000); expect(v.notWritten).toBe(0);
  expect(v.bills[0].state).toBe('CHEQUE_ISSUED');
  expect(v.after[1]).toBe(510000); expect(v.after[2]).toBe(340000); expect(v.after[3]).toBe(170000);
  expect(r.totals.after[3]).toBe(170000);
});

test('part written, part cleared: three buckets add up', () => {
  const cheques = [ch(100000, '2026-10-10', 'CLEARED', 'X'), ch(200000, '2026-12-01', 'ISSUED', 'Y')];
  const v = creditView([{ bill: bill(), cheques, payments: [], credits: [] }], TODAY).vendors[0];
  expect(v.owed).toBe(580000); expect(v.writtenNotClear).toBe(200000); expect(v.notWritten).toBe(380000);
  expect(v.notWritten + v.writtenNotClear).toBe(v.owed);
  expect(v.bills[0].state).toBe('PART_COVERED');
});

test('long-dated cheque (over 90 days ahead) is flagged', () => {
  const cheques = [ch(680000, '2027-02-20')];
  const r = creditView([{ bill: bill(), cheques, payments: [], credits: [] }], TODAY);
  expect(r.longDated).toHaveLength(1);
  expect(r.longDated[0].days_ahead).toBeGreaterThan(90);
  expect(r.vendors[0].after[3]).toBe(680000);   // not clear within 3 months, still owed then
});

test('vendor deadline: shows what is not covered when the vendor due date arrives', () => {
  const b = bill({ due_date: '2026-12-16' });
  const cheques = [ch(300000, '2026-12-01')];
  const x = creditView([{ bill: b, cheques, payments: [], credits: [] }], TODAY).vendors[0].bills[0];
  expect(x.notCoveredAtDue).toBe(380000);
  expect(x.daysToDue).toBe(61);
});

test('overdue bill is flagged; paid and voided bills are ignored', () => {
  const rows = [
    { bill: bill({ id: 1, due_date: '2026-10-01' }), cheques: [], payments: [], credits: [] },
    { bill: bill({ id: 2, vendor_name: 'Paid Co', total: 1000 }), cheques: [], payments: [{ amount: 1000 }], credits: [] },
    { bill: bill({ id: 3, vendor_name: 'Void Co', voided: true }), cheques: [], payments: [], credits: [] },
  ];
  const r = creditView(rows, TODAY);
  expect(r.vendors.map((v) => v.vendor)).toEqual(['Metro']);
  expect(r.vendors[0].bills[0].overdue).toBe(true);
  expect(r.totals.pastDue).toBe(680000);
});

test('bounced cheque does not reduce what is owed', () => {
  const v = creditView([{ bill: bill(), cheques: [ch(680000, '2026-11-01', 'BOUNCED')], payments: [], credits: [] }], TODAY).vendors[0];
  expect(v.owed).toBe(680000); expect(v.notWritten).toBe(680000);
});

test('filter by vendor name, text helpers', () => {
  const rows = [{ bill: bill(), cheques: [], payments: [], credits: [] }, { bill: bill({ id: 2, vendor_name: 'Eskema' }), cheques: [], payments: [], credits: [] }];
  expect(creditView(rows, TODAY, { onlyVendor: 'eskema' }).vendors).toHaveLength(1);
  expect(stateText('CHEQUE_ISSUED')).toMatch(/not cleared/);
  expect(oneLine(creditView(rows, TODAY, { onlyVendor: 'Metro' }).vendors[0])).toMatch(/owe Rs 680,000/);
  expect(owedBy(bill(), [], [], [], '2027-01-01')).toBe(680000);
});
