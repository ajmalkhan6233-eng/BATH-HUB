const B = require('../utils/bankDays'); const P = require('../utils/chequePlan');
test('AJ rule: Fri -> Mon, Sat/Sun -> Tue (other bank); same bank = day it counts', () => {
  expect(B.clearingDate('2026-10-23')).toBe('2026-10-26');   // Fri -> Mon
  expect(B.clearingDate('2026-10-24')).toBe('2026-10-27');   // Sat -> Tue
  expect(B.clearingDate('2026-10-25')).toBe('2026-10-27');   // Sun (also Poya) -> Tue
  expect(B.clearingDate('2026-10-26', true)).toBe('2026-10-26');
});
test('holidays are skipped', () => { expect(B.isBankDay('2026-11-24')).toBe(false); expect(B.clearingDate('2026-11-23')).toBe('2026-11-25'); expect(B.clearingDate('2026-12-24')).toBe('2026-12-28'); });
test('plan groups by clearing day and warns on Saturday for next week', () => {
  const p = P.plan([{ amount: 50000, due_date: '2026-10-30' }, { amount: 20000, due_date: '2026-10-31' }, { amount: 5000, due_date: '2026-10-26', same_bank: true }]);
  expect(p.days.map(d => d.day)).toEqual(['2026-10-26', '2026-11-02', '2026-11-03']);
  const L = P.lines(p, '2026-10-24'); expect(L.join('|')).toMatch(/CHEQUES CLEAR Mon 10-26: Rs 5,000/); expect(L.join('|')).toMatch(/NEXT WEEK cheques: Rs 5,000/);
});
