const vv = require('../../routes/vendor_voucher');
const bill = { grn_no: 'G1', bill_no: 'B1', bill_date: '2026-10-09', total: 1000, returns: [{ item: 'Item', qty: 1, rate: 50, date: '2026-11-24', amount: 50 }], returns_total: 50, net_payable: 950, cheques: [{ no: '111111', bank: 'HNB', date: '2027-01-01', amount: 900 }], cash: [], paid: 900, balance: 50 };
const data = { voucher_no: 'VS-T', date: '24 Nov 2026', shop: { name: 'Shop', address: 'A', phone: '1' }, vendor: { name: 'Vend', phone: '' }, bills: [bill, { ...bill, bill_no: 'B2', returns: [], returns_total: 0, cheques: [], paid: 0, net_payable: 200, total: 200, balance: 200 }], returns: bill.returns, returns_total: 50, cheques_total: 900, bills_total: 1200, balance: 250 };
test('vendor statement page: title, one block per bill, total due, credit-note line', () => {
  const h = vv.html(data);
  expect(h).toContain('VENDOR STATEMENT');
  expect(h).toContain('Balance on this bill');
  expect(h).toContain('TOTAL DUE TO');
  expect(h).toContain('Please issue a credit note');
  expect(h).toContain('"balance":250');
});
