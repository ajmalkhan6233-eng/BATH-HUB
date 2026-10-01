'use strict';
// SALARY module, pure maths. The three reference cases are the owner's own.
const M = require('../../utils/salaryMath');

describe('monthSplit (owner reference)', () => {
  test('net 5,000 -> save 500, colleague 675, owner 450, keep 3,375', () => {
    expect(M.monthSplit(5000)).toMatchObject({ save: 500, colleague: 675, owner: 450, keep: 3375 });
  });
  test('net 15,000 -> save 1,500, colleague 2,025, owner 1,350, keep 10,125', () => {
    expect(M.monthSplit(15000)).toMatchObject({ save: 1500, colleague: 2025, owner: 1350, keep: 10125 });
  });
  test('net -2,000 (or 0) -> everything 0, never negative', () => {
    expect(M.monthSplit(-2000)).toEqual({ save: 0, pool: 0, colleague: 0, owner: 0, keep: 0 });
    expect(M.monthSplit(0)).toEqual({ save: 0, pool: 0, colleague: 0, owner: 0, keep: 0 });
  });
  test('the percentages come from the settings, not from the code', () => {
    expect(M.monthSplit(10000, { save_pct: 20, colleague_pct: 10, owner_pct: 5 })).toMatchObject({ save: 2000, colleague: 800, owner: 400, keep: 6800 });
  });
  test('the parts always add back to the net profit', () => {
    for (const net of [1, 777.77, 12345.67, 987654.32]) {
      const r = M.monthSplit(net);
      expect(Math.abs(r.save + r.colleague + r.owner + r.keep - net)).toBeLessThan(0.05);
    }
  });
});

describe('daily cost target', () => {
  test('rent and bills are divided by the working days; the owner and colleague daily pay are added', () => {
    const c = M.dailyCosts({ ...M.DEFAULTS });
    expect(c.rent).toBeCloseTo(70000 / 26, 1);
    expect(c.utilities).toBeCloseTo(30000 / 26, 1);
    expect(c.total).toBeCloseTo(70000 / 26 + 30000 / 26 + 5000 + 3000 + 3000, 1);
    expect(c.status).toBe('ok');                      // about Rs 14,846: under the 15,000 normal
  });
  test('above normal, and over the hard ceiling', () => {
    expect(M.dailyCosts({ ...M.DEFAULTS, small_daily: 5000 }).status).toBe('above_normal');
    expect(M.dailyCosts({ ...M.DEFAULTS, small_daily: 9000 }).status).toBe('over_ceiling');
  });
  test('break-even sales = costs / margin', () => {
    expect(M.breakEven(15000, 25)).toBe(60000);
    expect(M.breakEven(15000, 20)).toBe(75000);
    expect(M.breakEven(15000, 0)).toBe(null);
  });
});

describe('cheque reserve', () => {
  const today = '2026-10-01';
  test('amount / days left, for cheques due tomorrow and within the next 7 days', () => {
    const r = M.chequeReserve([
      { id: 1, amount: 50000, due_date: '2026-10-02' },     // tomorrow: all of it
      { id: 2, amount: 70000, due_date: '2026-10-08' },     // 7 days: 10,000 a day
      { id: 3, amount: 90000, due_date: '2026-10-20' },     // outside the window
    ], today);
    expect(r.reserve).toBe(60000);
    expect(r.lines.map(l => [l.id, l.set_aside_today])).toEqual([[1, 50000], [2, 10000]]);
  });
  test('a cheque due today or already late needs its full amount now, and is marked late', () => {
    const r = M.chequeReserve([{ id: 1, amount: 20000, due_date: '2026-10-01' }, { id: 2, amount: 5000, due_date: '2026-09-28' }], today);
    expect(r.reserve).toBe(25000);
    expect(r.lines.find(l => l.id === 2).late).toBe(true);
  });
  test('covered cheques are skipped', () => {
    expect(M.chequeReserve([{ id: 1, amount: 50000, due_date: '2026-10-02', covered: true }], today).reserve).toBe(0);
  });
});

describe('late-return adjustment', () => {
  test('a return after a month was paid lowers what that month would have paid', () => {
    // closed month net 15,000 (colleague 2,025, owner 1,350); a late return of 2,000 -> net 13,000
    const a = M.lateAdjustment(15000, 2000);
    expect(a.colleague).toBeCloseTo(2025 - 13000 * 0.9 * 0.15, 2);   // 2025 - 1755 = 270
    expect(a.owner).toBeCloseTo(1350 - 13000 * 0.9 * 0.10, 2);       // 1350 - 1170 = 180
    expect(a.colleague).toBe(270);
    expect(a.owner).toBe(180);
  });
  test('a late return on a month that already had no commission changes nothing', () => {
    expect(M.lateAdjustment(-500, 1000)).toEqual({ colleague: 0, owner: 0, savings: 0 });
  });
});

describe("owner's accessories pricing rules", () => {
  test('cost 1,000 lists at about 1,950; discounts 10-25% are the normal range', () => {
    const p = M.priceCheck(1000, null);
    expect(p.list_price).toBe(1950);
    expect(p.discount_range).toEqual([10, 25]);
    expect(p.lowest_normal).toBe(1462.5);
  });
  test('1,050 on a 1,000 item is refused (too close to cost)', () => {
    const p = M.priceCheck(1000, 1050);
    expect(p.too_close_to_cost).toBe(true);
    expect(p.verdict).toMatch(/refused/);
  });
  test('1,700 is fine; 1,300 is above cost but below the normal range, so the owner decides', () => {
    expect(M.priceCheck(1000, 1700).verdict).toBe('ok');
    expect(M.priceCheck(1000, 1300).verdict).toMatch(/needs the owner/);
  });
});
