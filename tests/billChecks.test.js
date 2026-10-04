const B = require('../utils/billChecks');
test('phone numbers normalise to +94', () => {
  expect(B.normalisePhone('0771234567')).toBe('+94771234567');
  expect(B.normalisePhone('+94 77 123 4567')).toBe('+94771234567');
  expect(B.normalisePhone('0331234567')).toBe('+94331234567');
  expect(B.normalisePhone('12345')).toBeNull();
});
const bill = { date: '2025-12-27', phone: '0771234567', total: 158080, items: [
  { qty: 1, rate: 39500, amount: 39500 }, { qty: 1, rate: 61000, amount: 61000 }, { qty: 1, rate: 20500, amount: 20500 },
  { qty: 1, rate: 8200, amount: 8200 }, { qty: 1, rate: 1000, amount: 1000 }, { qty: 1, rate: 4300, amount: 4300 }, { qty: 1, rate: 2440, amount: 2440 },
  { qty: 1, rate: 3190, amount: 3190 }, { qty: 1, rate: 2440, amount: 2440 }, { qty: 3, rate: 1390, amount: 4170 }, { qty: 1, rate: 700, amount: 700 },
  { qty: 1, rate: 1600, amount: 1600 }, { qty: 3, rate: 1163.33, amount: 3490 }, { qty: 1, rate: 5550, amount: 5550 }] };
test('the real 158,080 bill passes', () => {
  const r = B.validateBillDraft(bill, { today: '2026-10-04' });
  expect(r.flags).toEqual([]); expect(r.sumItems).toBe(158080); expect(r.needsReview).toBe(true);
});
test('a wrong total and a bad item are flagged', () => {
  const r = B.validateBillDraft({ ...bill, total: 158580, items: bill.items.map((x, i) => (i === 0 ? { ...x, amount: 39000 } : x)) });
  expect(r.flags).toEqual(expect.arrayContaining(['ITEM_1_MATH', 'TOTAL_MISMATCH']));
});
test('missing pieces are flagged', () => {
  expect(B.validateBillDraft({ items: [] }).flags).toEqual(expect.arrayContaining(['NO_ITEMS', 'MISSING_TOTAL']));
  expect(B.validateBillDraft({ items: [{ qty: 1, rate: 1, amount: 1 }], total: 1, phone: '123', date: '2026-13-01' }).flags).toEqual(expect.arrayContaining(['PHONE_FORMAT', 'DATE_INVALID']));
});
