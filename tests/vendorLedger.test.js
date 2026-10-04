const L = require('../utils/vendorLedger');

describe('billStatus', () => {
  const bill = { total: 100000 };
  test('unpaid bill is fully uncovered', () => {
    expect(L.billStatus(bill)).toMatchObject({ outstanding: 100000, covered: 0, uncovered: 100000, state: 'UNPAID' });
  });
  test('writing a cheque does NOT reduce the payable', () => {
    const s = L.billStatus(bill, [{ amount: 100000, status: 'ISSUED' }]);
    expect(s).toMatchObject({ outstanding: 100000, covered: 100000, uncovered: 0, state: 'CHEQUE_ISSUED' });
  });
  test('clearing reduces the payable once', () => {
    const s = L.billStatus(bill, [{ amount: 100000, status: 'CLEARED' }]);
    expect(s).toMatchObject({ outstanding: 0, state: 'PAID' });
  });
  test('part covered', () => {
    expect(L.billStatus(bill, [{ amount: 40000, status: 'ISSUED' }]).state).toBe('PART_COVERED');
  });
  test('bounced cheque restores the payable and is flagged', () => {
    const s = L.billStatus(bill, [{ amount: 100000, status: 'BOUNCED' }]);
    expect(s).toMatchObject({ outstanding: 100000, covered: 0, hasBounced: true, state: 'UNPAID' });
  });
  test('cash payments and credit notes reduce the payable', () => {
    const s = L.billStatus(bill, [], [{ amount: 20000 }], [{ amount: 243.25 }]);
    expect(s.outstanding).toBe(79756.75);
  });
  test('overpayment is reported, not negative', () => {
    const s = L.billStatus(bill, [{ amount: 110000, status: 'CLEARED' }]);
    expect(s).toMatchObject({ outstanding: 0, overpaid: 10000, state: 'PAID' });
  });
});

describe('summarise', () => {
  test('totals per vendor, voided bills ignored', () => {
    const rows = [
      { bill: { vendor_name: 'A', total: 100 }, cheques: [{ amount: 100, status: 'ISSUED' }] },
      { bill: { vendor_name: 'A', total: 50 }, cheques: [] },
      { bill: { vendor_name: 'B', total: 70, voided: true }, cheques: [] },
    ];
    const r = L.summarise(rows);
    expect(r.totals).toEqual({ outstanding: 150, covered: 100, uncovered: 50 });
    expect(r.vendors).toHaveLength(1);
  });
});

describe('dates and clearing (BATHCO rule)', () => {
  test('same bank: cheque date, rolled forward off weekends', () => {
    expect(L.nextClearingDate('2026-10-09', { sameBank: true })).toBe('2026-10-09'); // Friday
    expect(L.nextClearingDate('2026-10-10', { sameBank: true })).toBe('2026-10-12'); // Saturday -> Monday
  });
  test('other bank: next business day after the rolled date', () => {
    expect(L.nextClearingDate('2026-10-09', { sameBank: false })).toBe('2026-10-12'); // Friday -> Monday
    expect(L.nextClearingDate('2026-10-10', { sameBank: false })).toBe('2026-10-13'); // Saturday -> Tuesday
    expect(L.nextClearingDate('2026-10-11', { sameBank: false })).toBe('2026-10-13'); // Sunday -> Tuesday
  });
  test('Sri Lankan bank holidays are skipped (2026-04-13 and 14 are Avurudu)', () => {
    expect(L.nextClearingDate('2026-04-13', { sameBank: true })).toBe('2026-04-15');
    expect(L.nextClearingDate('2026-04-10', { sameBank: false })).toBe('2026-04-15'); // Fri -> Mon 13th is a holiday, Tue 14th too -> Wed 15th
  });
  test('a year without a holiday list returns a warning, never silence', () => {
    expect(L.nextClearingInfo('2027-03-01', { sameBank: true }).warnedYears).toEqual([2027]);
    expect(L.nextClearingInfo('2026-10-09', { sameBank: true }).warnedYears).toEqual([]);
  });
  test('override holidays and lag', () => {
    expect(L.nextClearingDate('2026-10-12', { sameBank: true, holidays: ['2026-10-12'] })).toBe('2026-10-13');
    expect(L.nextClearingDate('2026-10-09', { sameBank: false, lagWorkingDays: 0 })).toBe('2026-10-09');
  });
});

describe('chequeCalendar and cashGap', () => {
  const today = '2026-10-05'; // Monday
  const cheques = [
    { id: 1, status: 'ISSUED', amount: 120000, due_date: '2026-10-05' },
    { id: 2, status: 'ISSUED', amount: 250000, due_date: '2026-10-06' },
    { id: 3, status: 'ISSUED', amount: 500000, due_date: '2026-10-12' },
    { id: 4, status: 'ISSUED', amount: 10000, due_date: '2026-10-01' },
    { id: 5, status: 'CLEARED', amount: 999999, due_date: '2026-10-05' },
  ];
  test('today, tomorrow, monday, windows, overdue, bulk', () => {
    const c = L.chequeCalendar(cheques, today, { bulkThreshold: 300000 });
    expect(c.today).toBe(120000);
    expect(c.tomorrow).toBe(250000);
    expect(c.monday).toEqual({ date: '2026-10-12', amount: 500000 });
    expect(c.overdue).toEqual({ amount: 10000, count: 1 });
    expect(c.windows[7]).toBe(370000);
    expect(c.windows[14]).toBe(870000);
    expect(c.bulkDays.map((d) => d.date)).toEqual(['2026-10-12']);
  });
  test('cash gap over two days includes overdue', () => {
    const g = L.cashGap(cheques, { cashOnHand: 100000, expectedReceipts: 50000 }, today, 2);
    expect(g).toMatchObject({ due: 380000, gap: 230000, count: 3 });
  });
  test('no gap when cash is enough', () => {
    expect(L.cashGap(cheques, { cashOnHand: 400000 }, today, 2).gap).toBe(0);
  });
});

describe('cheque writing helpers', () => {
  test('amount in words', () => {
    expect(L.amountInWords(500000)).toBe('Five Hundred Thousand Only');
    expect(L.amountInWords(520000)).toBe('Five Hundred Twenty Thousand Only');
    expect(L.amountInWords(1250.5)).toBe('One Thousand Two Hundred Fifty and Fifty Cents Only');
    expect(L.amountInWords(2244000)).toBe('Two Million Two Hundred Forty Four Thousand Only');
    expect(() => L.amountInWords(0)).toThrow(RangeError);
  });
  test('validateCheque flags the problems seen in the photos', () => {
    const w = L.validateCheque({ payee: 'CASH', amount: 520000, amountWords: 'Five Hundred Two Twenty Thousand Only', date: '2026-03-07' }, { today: '2026-10-04' });
    expect(w).toEqual(expect.arrayContaining(['PAYEE_IS_CASH', 'WORDS_MISMATCH', 'DATE_STALE_OVER_6_MONTHS']));
    expect(L.validateCheque({ payee: 'Eskema Ceramic', amount: '', date: '2026-04-17' })).toContain('MISSING_AMOUNT');
    expect(L.validateCheque({ payee: 'Eskema Ceramic', amount: 500000, amountWords: 'five hundred thousand only', date: '2026-04-17' })).toEqual([]);
  });
  test('duplicates: same number and one-digit typo', () => {
    const list = [
      { id: 1, cheque_no: '499904', amount: 146000, due_date: '2026-02-15' },
      { id: 2, cheque_no: '499904', amount: 146000, due_date: '2026-02-15' },
      { id: 3, cheque_no: '641103', amount: 576300, due_date: '2026-01-15' },
      { id: 4, cheque_no: '6411103', amount: 576300, due_date: '2026-01-15' },
      { id: 5, cheque_no: '641104', amount: 121600, due_date: '2026-01-15' },
    ];
    const d = L.findDuplicates(list);
    expect(d.sameNumber).toEqual([[1, 2]]);
    expect(d.likely).toEqual([[3, 4]]);
  });
});
