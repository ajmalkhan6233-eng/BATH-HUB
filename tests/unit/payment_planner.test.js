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
