const { layoutSheets, expandCopies, formatPrice } = require('../../public/labels_a4_core.js');

describe('A4 Label Core Unit Tests', () => {
  test('layoutSheets splits labels correctly across 40-item pages', () => {
    expect(layoutSheets([], 40)).toEqual([]);
    
    const labels41 = Array.from({ length: 41 }, (_, i) => ({ id: i }));
    const pages41 = layoutSheets(labels41, 40);
    expect(pages41.length).toBe(2);
    expect(pages41[0].length).toBe(40);
    expect(pages41[1].length).toBe(1);
  });

  test('expandCopies calculates correct label count with stock + 2 spare', () => {
    const items = [
      { id: 1, copies: 5 }, // e.g., 3 stock + 2 spare
      { id: 2, copies: 1 }
    ];
    const expanded = expandCopies(items);
    expect(expanded.length).toBe(6);
    expect(expanded.filter(x => x.id === 1).length).toBe(5);
  });

  test('formatPrice handles prices, rounding, and invalid inputs accurately', () => {
    expect(formatPrice(3500)).toBe('Rs. 3,500');
    expect(formatPrice(1234.5)).toBe('Rs. 1,234.50');
    expect(formatPrice(0)).toBe('');
    expect(formatPrice(null)).toBe('');
    expect(formatPrice(NaN)).toBe('');
  });
});
