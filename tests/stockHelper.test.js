const PH = require('../utils/priceHelper'); const RO = require('../utils/reorder');
test('price suggestion follows AJ bands, ends in 50/00, never under +30%', () => {
  expect(PH.suggest(205).price).toBe(550); expect(PH.suggest(1000).price).toBe(3300); expect(PH.suggest(5285).price).toBe(11100);
  expect(PH.suggest(0)).toBeNull(); expect(PH.suggest(-5)).toBeNull();
  [205, 545, 1035, 2090, 6163].forEach(c => { const s = PH.suggest(c).price; expect(s % 50).toBe(0); expect(s).toBeGreaterThanOrEqual(c * 1.3); });
});
test('apply refuses a bad price', async () => { expect((await PH.apply({ query: async () => ({ rows: [] }) }, 'A', 0)).code).toBe(400); expect((await PH.apply({ query: async () => ({ rows: [] }) }, 'A', 100)).code).toBe(404); });
test('reorder groups by vendor and makes a text', () => {
  const g = RO.group([{ item_code: '1', name: 'Valve', stock_level: 2, reorder_threshold: 5, vendor: 'Metro' }, { item_code: '2', name: 'Hose', stock_level: 0, reorder_threshold: 3, vendor: null }]);
  expect(g.map(x => x.vendor)).toEqual(['Metro', 'Unknown vendor']); expect(g[0].items[0].order_qty).toBe(8); expect(g[0].text).toMatch(/Valve x 8/);
});
