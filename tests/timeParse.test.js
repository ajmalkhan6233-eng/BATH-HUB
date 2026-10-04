const T = require('../layla_owner/timeParse');
// Sunday 4 Oct 2026, 10:00 Sri Lanka time = 04:30 UTC
const now = new Date('2026-10-04T04:30:00Z');
const loc = (d) => T.fmtLocal(d);

test('by evening means 5:30 pm today', () => { expect(loc(T.parseWhen('remind me by evening', now).at)).toBe('2026-10-04 05:30 pm'); });
test('tomorrow evening', () => { expect(loc(T.parseWhen('tomorrow evening', now).at)).toBe('2026-10-05 05:30 pm'); });
test('tomorrow with no time is 9 am', () => { expect(loc(T.parseWhen('remind me tomorrow', now).at)).toBe('2026-10-05 09:00 am'); });
test('at 5pm today, and a past bare time rolls to tomorrow', () => {
  expect(loc(T.parseWhen('at 5pm', now).at)).toBe('2026-10-04 05:00 pm');
  expect(loc(T.parseWhen('at 8am', now).at)).toBe('2026-10-05 08:00 am');
});
test('in 2 hours and in 30 minutes', () => {
  expect(T.parseWhen('in 2 hours', now).at.toISOString()).toBe('2026-10-04T06:30:00.000Z');
  expect(T.parseWhen('after 30 mins', now).at.toISOString()).toBe('2026-10-04T05:00:00.000Z');
});
test('weekday names are the next one, never today', () => {
  expect(T.parseDate('on monday', now)).toBe('2026-10-05');
  expect(T.parseDate('sunday', now)).toBe('2026-10-11');
});
test('dd/mm and 12 oct, rolling to next year when past', () => {
  expect(T.parseDate('on 12/10', now)).toBe('2026-10-12');
  expect(T.parseDate('12 oct', now)).toBe('2026-10-12');
  expect(T.parseDate('3/10', now)).toBe('2027-10-03');
});
test('no time words returns null', () => { expect(T.parseWhen('hello there', now)).toBeNull(); });
test('amounts', () => {
  expect(T.parseAmount('a 1 million cheque')).toBe(1000000);
  expect(T.parseAmount('1.5 million')).toBe(1500000);
  expect(T.parseAmount('500k')).toBe(500000);
  expect(T.parseAmount('5 lakhs')).toBe(500000);
  expect(T.parseAmount('Rs. 520,000')).toBe(520000);
  expect(T.parseAmount('cheque 213200 tomorrow')).toBe(213200);
  expect(T.parseAmount('no money here')).toBeNull();
});
