const { figures } = require('../../public/vendor-pay-panel.js');
const list = [{ vendor_name: 'METRO ENTERPRISES', outstanding_balance: 144945, cheques_pending: 646000 }];
test('outstanding goes down as the amount is typed', () => {
  expect(figures(list, 'Metro Enterprises', '')).toEqual({ found: true, owed: 144945, pay: 0, after: 144945, cheques: 646000 });
  expect(figures(list, 'metro enterprises', '945').after).toBe(144000);
  expect(figures(list, 'metro enterprises', '200000').after).toBe(-55055);
  expect(figures(list, 'Nobody', '5').found).toBe(false);
});
