const { clean, parseManifest } = require('../../scripts/pc/shop_sync');

test('hides phones and long account numbers, keeps money and cheque numbers', () => {
  expect(clean('customer_phone', '0771234567')).toBe('***567');
  expect(clean('notes', 'acc 123456789012 chq 767105')).toBe('acc #hidden# chq 767105');
  expect(clean('total', '345170.00')).toBe('345170.00');
});

test('reads only table rows from the manifest', () => {
  const md = '# x\n| table | rows | columns | left out |\n|---|---|---|---|\n| pos_bills | 2 | id, total | - |\n';
  expect(parseManifest(md)).toEqual([{ table: 'pos_bills', columns: ['id', 'total'], left: '-' }]);
});
