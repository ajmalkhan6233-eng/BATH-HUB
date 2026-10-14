const { planSchedule, cashWarnings, outstanding } = require('../../utils/payment_planner');
const base = { total: 100000, count: 3, firstDate: '2026-11-02', everyDays: 30, todayISO: '2026-10-15' };
describe('planSchedule', () => {
  test('cheques add up to exactly the invoice (no surcharge)', () => {
    const p = planSchedule({ ...base, total: 100000.01 });
    expect(p.ok).toBe(true); expect(p.sum).toBe(100000.01); expect(p.installments).toHaveLength(3);
  });
  test('weekend date moves to working day and shows the original', () => {
    const p = planSchedule({ ...base, firstDate: '2026-10-17' }); // Saturday
    expect(p.installments[0].date).toBe('2026-10-19'); expect(p.installments[0].moved).toBe('2026-10-17');
  });
  test('back-dating and bad input refused', () => {
    expect(planSchedule({ ...base, firstDate: '2026-10-01' }).ok).toBe(false);
    expect(planSchedule({ ...base, total: 0 }).ok).toBe(false);
    expect(planSchedule({ ...base, count: 0 }).ok).toBe(false);
  });
});
describe('cashWarnings', () => {
  const ch = [{ clears: '2026-11-03', amount: 50000 }];
  test('warns when short, silent when covered', () => {
    expect(cashWarnings({ openingCash: 10000, cheques: ch })[0].shortBy).toBe(40000);
    expect(cashWarnings({ openingCash: 10000, inflows: [{ date: '2026-11-03', amount: 40000 }], cheques: ch })).toHaveLength(0);
  });
});
describe('outstanding', () => {
  test('only cleared cheques reduce what is owed', () => {
    const rows = [{ amount: 40, status: 'cleared' }, { amount: 30, status: 'pending' }, { amount: 30, status: 'bounced' }];
    expect(outstanding(100, rows)).toEqual({ paid: 40, owed: 60, open: true });
  });
});

const { weeklySetAside, moveCheque, addMonths } = require('../../utils/payment_planner');
describe('terms, custom parts, vendor due date', () => {
  const b = { total: 680000, count: 4, firstDate: '2026-11-16', everyMonths: 1, todayISO: '2026-10-15' };
  test('4 monthly equal cheques add up to 680000', () => {
    const p = planSchedule(b); expect(p.ok).toBe(true);
    expect(p.installments.map(x => x.amount)).toEqual([170000, 170000, 170000, 170000]); expect(p.sum).toBe(680000);
  });
  test('custom parts must add up exactly', () => {
    expect(planSchedule({ ...b, parts: [100000, 200000, 200000, 180000] }).ok).toBe(true);
    expect(planSchedule({ ...b, parts: [100000, 200000, 200000, 181000] }).ok).toBe(false);
  });
  test('weekend moves BACK when a vendor due date is set, never past it', () => {
    const p = planSchedule({ total: 1000, count: 1, firstDate: '2026-11-15', vendorDueDate: '2026-11-15', todayISO: '2026-10-15' }); // Sunday
    expect(p.ok).toBe(true); expect(p.installments[0].date).toBe('2026-11-13');
  });
  test('cheque after the vendor due date is refused', () => {
    expect(planSchedule({ ...b, vendorDueDate: '2026-12-31' }).ok).toBe(false);
  });
  test('addMonths clamps month end', () => { expect(addMonths('2026-01-31', 1)).toBe('2026-02-28'); });
  test('weekly set-aside = total over weeks to the last clearing date', () => {
    const p = planSchedule({ total: 700000, count: 1, firstDate: '2026-11-12', todayISO: '2026-10-15' }); // clears 11-13 = 29 days
    expect(weeklySetAside(p.installments, '2026-10-15')).toBe(Math.ceil(700000 / (29 / 7)));
  });
  test('moveCheque: honest dates only', () => {
    const p = planSchedule(b);
    expect(moveCheque(p.installments, 2, '2026-12-20', '2026-10-15').installments[1].date).toBe('2026-12-21'); // Sunday -> Monday, shown
    expect(moveCheque(p.installments, 2, '2026-10-01', '2026-10-15').ok).toBe(false);
    expect(moveCheque(p.installments, 9, '2026-12-20', '2026-10-15').ok).toBe(false);
  });
});
