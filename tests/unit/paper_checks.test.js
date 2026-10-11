const { checkGrn, checkCheque, wordsToNumber } = require('../../utils/paper_checks');

describe('GRN draft checks', () => {
  test('clean GRN passes', () => {
    const r = checkGrn({ invoice_no: 'A1', total: 350, lines: [{ code: 'T1', qty: 2, unit_cost: 100, line_total: 200 }, { code: 'T2', qty: 3, unit_cost: 50, line_total: 150 }] });
    expect(r.ok).toBe(true); expect(r.kind).toBe('grn'); expect(r.computed_total).toBe(350);
  });
  test('flags wrong line math, wrong total, zero price, repeated code', () => {
    const r = checkGrn({ total: 999, lines: [{ code: 'T1', qty: 2, unit_cost: 100, line_total: 250 }, { code: 'T1', qty: 1, unit_cost: 0, line_total: 0 }] });
    const t = r.warnings.join('|');
    expect(t).toMatch(/line 1: qty x price = 200.00 but the paper says 250.00/);
    expect(t).toMatch(/line 2: zero or missing price/);
    expect(t).toMatch(/code T1 repeats on lines 1, 2/);
    expect(t).toMatch(/lines add up to 250.00 but the net total says 999.00/);
  });
  test('all-negative quantities = purchase return', () => {
    const r = checkGrn({ lines: [{ code: 'T1', qty: -2, unit_cost: 100, line_total: -200 }] });
    expect(r.kind).toBe('purchase_return'); expect(r.warnings.join()).toMatch(/RETURN/);
  });
  test('multi-page invoice: the same numbered line on page 2 is counted once', () => {
    const l = { line_no: 1, code: 'T1', qty: 1, unit_cost: 100, line_total: 100 };
    const r = checkGrn({ invoice_no: 'A1', total: 100, pages: [{ page: 1, lines: [l] }, { page: 2, lines: [l] }] });
    expect(r.lines).toBe(1); expect(r.ok).toBe(true);
  });
});

describe('cheque draft checks', () => {
  test('words to number', () => {
    expect(wordsToNumber('Two lakhs fifty thousand rupees only')).toBe(250000);
    expect(wordsToNumber('Twelve thousand five hundred and forty')).toBe(12540);
  });
  test('digits must match words', () => {
    expect(checkCheque({ amount_digits: 250000, amount_words: 'Two lakhs fifty thousand only', date: '2026-10-20', payee: 'X' }).ok).toBe(true);
    const bad = checkCheque({ amount_digits: 205000, amount_words: 'Two lakhs fifty thousand only', date: '2026-10-20', payee: 'X' });
    expect(bad.ok).toBe(false); expect(bad.warnings[0]).toMatch(/digits say 205,000 but words say 250,000/);
  });
});
