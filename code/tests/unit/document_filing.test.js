'use strict';
const F = require('../../utils/documentFiling');
const { PROMPT } = require('../../scripts/ocr_photo');

describe('documentFiling', () => {
  test('the reader prompt knows the five headings and the new types', () => {
    for (const w of ['BILL', 'GRN', 'CHEQUE', 'EXPENSES', 'DAILY SALES', 'manual_bill', 'grn']) expect(PROMPT).toContain(w);
  });

  test('type from what the reader said', () => {
    expect(F.typeFromOcr({ document_type: 'cheque_note' })).toBe('cheque');
    expect(F.typeFromOcr({ document_type: 'manual_bill' })).toBe('manual_bill');
    expect(F.typeFromOcr({ document_type: 'grn' })).toBe('grn');
    expect(F.typeFromOcr({})).toBe('unknown');
    expect(F.typeFromOcr({ document_type: 'something_else' })).toBe('unknown');
  });

  test('normalize cleans numbers, dates and strings, and caps the items', () => {
    const ex = F.normalize('manual_bill', { date: '2026-9-5', customer_name: '  Nimal  ', total: 'Rs 1,200.50', items: Array.from({ length: 100 }, () => ({ name: 'x', qty: '2', unit_price: '10' })) });
    expect(ex.customer_name).toBe('Nimal');
    expect(ex.items.length).toBeLessThanOrEqual(60);
    expect(ex.items[0]).toMatchObject({ qty: 2, unit_price: 10 });
    expect(F.normalize('manual_bill', { date: 'next week' }).date).toBeFalsy();
  });

  test('bill totals: items add up, discount comes off', () => {
    const t = F.billTotals(F.normalize('manual_bill', { date: '2026-09-01', discount: 500, items: [{ name: 'a', qty: 2, unit_price: 1000 }, { name: 'b', qty: 1, unit_price: 250.5 }] }));
    expect(t.subtotal).toBe(2250.5);
    expect(t.total).toBe(1750.5);
  });

  test('validation: errors block, a wrong paper total is only a warning', () => {
    const ok = F.normalize('manual_bill', { date: '2026-09-01', total: 999, items: [{ name: 'a', qty: 1, unit_price: 100 }] });
    const v = F.validateForFiling('manual_bill', ok);
    expect(v.ok).toBe(true);
    expect(v.warnings).toHaveLength(1);
    expect(F.validateForFiling('manual_bill', F.normalize('manual_bill', { items: [] })).ok).toBe(false);
    expect(F.validateForFiling('cheque', F.normalize('cheque', { payee: 'X', amount: 0, due_date: '2026-09-01' })).ok).toBe(false);
    expect(F.validateForFiling('invoice', F.normalize('invoice', {})).ok).toBe(false);
  });

  test("the shop's own daily sheet (09/07/2026): the reader is told day/month/year, and the sheet's arithmetic is checked", () => {
    expect(PROMPT).toMatch(/day\/month\/year/);
    expect(PROMPT).toContain('2026-07-09');
    // figures as written on the 09/07/2026 sheet: cash + card + online does not equal the total sale written
    const ex = F.normalize('day_sheet', { date: '2026-07-09', total_sale: 1636640, cash_sale: 1286440, card_sale: 280825, online_sale: 87875, total_expenses: 25090, cash_in: 1286440, cash_out: 36490, cash_in_hand: 1249950, cash_banked: 1150000, petty_cash: 25000 });
    const v = F.validateForFiling('day_sheet', ex);
    expect(v.ok).toBe(true);
    expect(v.warnings).toHaveLength(1);
    expect(v.warnings[0]).toMatch(/1655140.*1636640/);
    expect(ex.cash_banked).toBe(1150000);
    // a sheet that adds up gives no warning
    const good = F.validateForFiling('day_sheet', F.normalize('day_sheet', { date: '2026-07-05', total_sale: 1000, cash_sale: 600, card_sale: 300, online_sale: 100, cash_in: 600, cash_out: 100, cash_in_hand: 500 }));
    expect(good.warnings).toEqual([]);
    // cash in - cash out must equal cash in hand
    expect(F.validateForFiling('day_sheet', F.normalize('day_sheet', { date: '2026-07-05', cash_sale: 600, cash_in: 600, cash_out: 100, cash_in_hand: 450 })).warnings[0]).toMatch(/cash in hand/);
  });

  test('a salary list is recognised (it is not filed yet) and a GRN line keeps its item code', () => {
    expect(F.typeFromOcr({ document_type: 'salary_note' })).toBe('salary_note');
    expect(F.DOC_TYPES.salary_note.files_to).toBe(null);
    const n = F.normalize('salary_note', { lines: [{ name: 'Imran', amount: '5500' }, { name: 'Jazeel', amount: 2600, note: '400 advance' }], total: 20100 });
    expect(n.lines[0]).toMatchObject({ name: 'Imran', amount: 5500 });
    expect(F.normalize('grn', { items: [{ item_code: ' 1001 ', description: 'x', qty: 1 }] }).items[0].item_code).toBe('1001');
  });
});
