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
});
