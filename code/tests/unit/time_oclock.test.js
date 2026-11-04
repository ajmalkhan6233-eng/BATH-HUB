const T = require('../../layla_owner/timeParse');
const now = new Date('2026-10-15T03:00:00Z'); // 08:30 Sri Lanka
const clock = (s) => T.parseClock(s);
test('12 o\'clock and "at 12" are noon', () => { expect(clock("remind me at 12 to call mum")).toEqual({ h: 12, min: 0 }); expect(clock("12 o'clock remind me")).toEqual({ h: 12, min: 0 }); expect(clock('at 12 oclock')).toEqual({ h: 12, min: 0 }); });
test('small hours with no am/pm: 1-6 afternoon, 7-11 morning; words win', () => {
  expect(clock('remind me at 5')).toEqual({ h: 17, min: 0 }); expect(clock('at 9 to call')).toEqual({ h: 9, min: 0 });
  expect(clock('at 9 tonight')).toEqual({ h: 21, min: 0 }); expect(clock('at 5 in the morning')).toEqual({ h: 5, min: 0 }); expect(clock('at 8 this evening')).toEqual({ h: 20, min: 0 });
});
test('explicit am/pm and 24h still work, and dates are not mistaken for hours', () => {
  expect(clock('at 5pm')).toEqual({ h: 17, min: 0 }); expect(clock('at 17:30')).toEqual({ h: 17, min: 30 });
  expect(clock('at 20 oct')).toBeNull(); expect(clock('on 12th')).toBeNull(); expect(clock('in 2 hours')).toBeNull();
});
test('"remind me at 12" fires at 12:00 today when it is still ahead', () => { expect(T.fmtLocal(T.parseWhen('remind me at 12 to call mum', now).at)).toBe('2026-10-15 12:00 pm'); });
test('"remind me at 8" at 08:30 means tomorrow 8 am (already passed today)', () => { expect(T.fmtLocal(T.parseWhen('remind me at 8', now).at)).toBe('2026-10-16 08:00 am'); });
