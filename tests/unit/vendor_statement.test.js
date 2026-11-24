const vv = require('../../routes/vendor_voucher');
const data = { voucher_no: 'VS-T', date: '24 Nov 2026', shop: { name: 'Shop', address: 'A', phone: '1' }, vendor: { name: 'Vend', phone: '' }, received_by: 'Vend',
  bills: [{ grn_no: 'G1', bill_no: 'B1', bill_date: '2026-10-09', total: 1000 }], cheques: [{ no: '111111', bank: 'HNB', date: '2027-01-01', amount: 900 }],
  returns: [{ item: '009 Item', qty: 1, date: '2026-11-24', amount: 50 }], returns_total: 50, net_payable: 950, bills_total: 1000, cheques_total: 900, balance: 50 };
test('vendor statement page carries the title, the returns block and the figures', () => {
  const h = vv.html(data);
  expect(h).toContain('VENDOR STATEMENT');
  expect(h).toContain('LESS: RETURNS');
  expect(h).toContain('"net_payable":950');
  expect(h).toContain('"balance":50');
});
test('statement without returns still renders (block stays hidden by the page script)', () => {
  expect(vv.html({ ...data, returns: [], returns_total: 0, net_payable: 1000, balance: 100 })).toContain('"returns":[]');
});
