const P = require('../utils/pricingEngine');
test('accessory rule: cost 1000 lists near 1950, red line 1300', () => {
  expect(P.accessoryPrice(1000)).toMatchObject({ list: 1950, floor: 1300 });
});
test('commode 25,000: red line 30,000, list 37,500, safe discount 20%', () => {
  expect(P.ceramicPrice(25000)).toMatchObject({ floor: 30000, list: 37500, maxDiscountPct: 20 });
});
test('a 20% discount from list lands exactly on the red line', () => {
  const c = P.ceramicPrice(25000); expect(c.list * 0.8).toBe(c.floor);
});
test('margin zones are information only', () => {
  expect(P.marginInfo(25000, 24000)).toMatchObject({ zone: 'RED' });
  expect(P.marginInfo(25000, 28000, 30000)).toMatchObject({ zone: 'AMBER' });
  expect(P.marginInfo(25000, 33750, 30000)).toMatchObject({ zone: 'GREEN', profit: 8750 });
});
test('tile percent of cost', () => {
  const t = P.tilePrice(1000, { pctOfCost: 22 }); expect(t.floor).toBe(1220); expect(t.list).toBe(1530);
});
test('package never falls below the sum of red lines', () => {
  const lines = [
    { name: 'Commode', qty: 1, cost: 21000, kind: 'ceramic' },
    { name: 'Basin', qty: 1, cost: 6500, kind: 'ceramic' },
    { name: 'Basin tap', qty: 1, cost: 1200, kind: 'accessory' },
    { name: 'Angle valve', qty: 2, cost: 350, kind: 'accessory' },
  ];
  const q = P.packageQuote(lines, { bundleDiscountPct: 40 });
  expect(q.price).toBeGreaterThanOrEqual(q.floorSum);
  expect(q.zone).not.toBe('RED');
  expect(q.cost).toBe(21000 + 6500 + 1200 + 700);
});
test('bad cost is rejected', () => { expect(() => P.accessoryPrice(0)).toThrow(RangeError); });

test('category markups from the real price list', () => {
  expect(P.categoryPrice(675, 'angle_conceal_valve')).toMatchObject({ list: 1750, floor: 1500 });
  const c = P.categoryPrice(39000, 'commode'); expect(c.list).toBe(48350); expect(c.floor).toBe(48000);
  expect(() => P.categoryPrice(100, 'nope')).toThrow(RangeError);
});
