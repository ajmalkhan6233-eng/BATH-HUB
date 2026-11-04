'use strict';
const { aggregateByDate } = require('../../scripts/import_ocr_expenses');

// ── helpers ──────────────────────────────────────────────────────────────────
const photo = (date, overrides = {}) => ({
  _file: `WhatsApp Image ${date} at 10.00.00.jpeg`,
  total_sale: 0,
  total_expenses: 0,
  expense_items: '',
  sheet_type: 'single_receipt',
  confidence: 'high',
  ...overrides,
});

// ── tests ─────────────────────────────────────────────────────────────────────
describe('aggregateByDate', () => {
  test('empty input returns empty object', () => {
    expect(aggregateByDate([])).toEqual({});
  });

  test('single summary sheet — uses its total_expenses', () => {
    const results = [
      photo('2026-05-12', { total_sale: 400000, total_expenses: 76940, sheet_type: 'daily_summary', confidence: 'high' }),
    ];
    const out = aggregateByDate(results);
    expect(out['2026-05-12']).toMatchObject({ total: 76940, method: 'summary_sheet', confidence: 'high' });
  });

  test('photo with total_sale > 0 is treated as summary sheet even without sheet_type', () => {
    const results = [
      photo('2026-05-14', { total_sale: 150000, total_expenses: 36720, sheet_type: 'unclear', confidence: 'high' }),
    ];
    const out = aggregateByDate(results);
    expect(out['2026-05-14']).toMatchObject({ total: 36720, method: 'summary_sheet' });
  });

  test('multiple summary sheets — picks the one with highest total_expenses', () => {
    const results = [
      photo('2026-05-13', { total_sale: 500000, total_expenses: 53820, sheet_type: 'daily_summary', confidence: 'high' }),
      photo('2026-05-13', { total_sale: 500000, total_expenses: 80000, sheet_type: 'daily_summary', confidence: 'high',
             _file: 'WhatsApp Image 2026-05-13 at 11.00.00.jpeg' }),
    ];
    const out = aggregateByDate(results);
    expect(out['2026-05-13'].total).toBe(80000);
  });

  test('no summary sheet — sums unique expense items', () => {
    const results = [
      photo('2026-05-19', { expense_items: 'Lunch:1500, Petrol:2000', confidence: 'high' }),
      photo('2026-05-19', { expense_items: 'Lunch:1500, Water:500', confidence: 'high',
             _file: 'WhatsApp Image 2026-05-19 at 11.00.00.jpeg' }),
    ];
    const out = aggregateByDate(results);
    // Lunch:1500 deduped, Petrol:2000 + Water:500 = 4000
    expect(out['2026-05-19']).toMatchObject({ method: 'sum_of_items', total: 4000 });
  });

  test('sum_of_items deduplicates by desc+amount key (case-insensitive)', () => {
    const results = [
      photo('2026-06-01', { expense_items: 'Salary:10000', confidence: 'high' }),
      photo('2026-06-01', { expense_items: 'salary:10000', confidence: 'high',
             _file: 'WhatsApp Image 2026-06-01 at 11.00.00.jpeg' }),
    ];
    const out = aggregateByDate(results);
    expect(out['2026-06-01'].total).toBe(10000); // not 20000
  });

  test('falls back to sum_of_totals when no items can be parsed', () => {
    const results = [
      photo('2026-06-02', { total_expenses: 5000, expense_items: '', confidence: 'high' }),
      photo('2026-06-02', { total_expenses: 3000, expense_items: '', confidence: 'high',
             _file: 'WhatsApp Image 2026-06-02 at 11.00.00.jpeg' }),
    ];
    const out = aggregateByDate(results);
    expect(out['2026-06-02']).toMatchObject({ method: 'sum_of_totals', total: 8000 });
  });

  test('skips photos with confidence=error', () => {
    const results = [
      photo('2026-06-03', { confidence: 'error', total_expenses: 99999 }),
    ];
    expect(aggregateByDate(results)).toEqual({});
  });

  test('skips photos with confidence=skipped (prior timeouts)', () => {
    const results = [
      photo('2026-06-03', { confidence: 'skipped', total_expenses: 99999 }),
    ];
    expect(aggregateByDate(results)).toEqual({});
  });

  test('groups photos from different dates independently', () => {
    const results = [
      photo('2026-05-12', { total_sale: 400000, total_expenses: 76940, sheet_type: 'daily_summary', confidence: 'high' }),
      photo('2026-05-14', { total_sale: 200000, total_expenses: 36720, sheet_type: 'daily_summary', confidence: 'high',
             _file: 'WhatsApp Image 2026-05-14 at 10.00.00.jpeg' }),
    ];
    const out = aggregateByDate(results);
    expect(Object.keys(out).sort()).toEqual(['2026-05-12', '2026-05-14']);
    expect(out['2026-05-12'].total).toBe(76940);
    expect(out['2026-05-14'].total).toBe(36720);
  });

  test('date with total_expenses=0 on summary sheet is omitted from output', () => {
    const results = [
      photo('2026-06-04', { total_sale: 300000, total_expenses: 0, sheet_type: 'daily_summary' }),
    ];
    // No usable expense figure — should not produce an entry
    expect(aggregateByDate(results)['2026-06-04']).toBeUndefined();
  });

  test('confidence=low photos contribute to sum_of_items but flag low confidence result', () => {
    const results = [
      photo('2026-06-05', { expense_items: 'Lunch:1000', confidence: 'low' }),
    ];
    const out = aggregateByDate(results);
    expect(out['2026-06-05']).toMatchObject({ confidence: 'low', total: 1000 });
  });
});
