const { priceChange, buildMessage } = require('../../utils/supplierPriceAlerts');
describe('priceChange', () => {
  test('over 3 percent either way is reported with old, new and percent', () => {
    expect(priceChange(100, 105)).toEqual({ old: 100, new: 105, percent: 5 });
    expect(priceChange(200, 190)).toEqual({ old: 200, new: 190, percent: -5 });
  });
  test('3 percent or less, no history or unusable numbers: nothing', () => {
    expect(priceChange(100, 103)).toBeNull(); expect(priceChange(100, 100)).toBeNull();
    expect(priceChange(undefined, 105)).toBeNull(); expect(priceChange(0, 105)).toBeNull(); expect(priceChange('x', 5)).toBeNull();
  });
  test('message lists the item, both prices and the percent', () => {
    expect(buildMessage('Acme', 'MG-1', [{ name: 'Tap', old: 1000, new: 1100, percent: 10 }])).toBe('SUPPLIER PRICE CHANGE\nAcme, MG-1\nTap: 1,000.00 -> 1,100.00 (+10%)');
  });
});
