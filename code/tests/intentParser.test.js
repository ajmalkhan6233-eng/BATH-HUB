const { parseOwnerMessage: P, extractVendor } = require('../layla_owner/intentParser');
const T = require('../layla_owner/timeParse');
const now = new Date('2026-10-04T04:30:00Z'); // Sun 4 Oct 2026, 10:00 SL
const loc = (d) => T.fmtLocal(d);

test("the owner's own sentence: vendor bill not entered in the GRN, remind by evening", () => {
  const r = P('Layla, Fazal Hardware there is a bill pending I did not enter it into the GRN just remind me by evening', now);
  expect(r.type).toBe('PENDING_BILL'); expect(r.vendor).toBe('Fazal Hardware'); expect(loc(r.remindAt)).toBe('2026-10-04 05:30 pm');
});
test('voice transcripts are lowercase: still finds the vendor', () => {
  const r = P('tell layla fazal hardware has a bill pending not entered in grn remind me this evening', now);
  expect(r.type).toBe('PENDING_BILL'); expect(r.vendor.toLowerCase()).toBe('fazal hardware');
});
test('bill pending defaults to 5:30 pm when no time is said', () => {
  const r = P('Eskema bill not entered in the GRN', now); expect(r.type).toBe('PENDING_BILL'); expect(loc(r.remindAt)).toBe('2026-10-04 05:30 pm');
});
test('cheque note: 1 million cheque, realises tomorrow, remind in the evening', () => {
  const r = P('quick note I wrote a 1 million cheque to Eskema it is going to realize tomorrow just remind me in the evening', now);
  expect(r).toMatchObject({ type: 'CHEQUE_NOTE', amount: 1000000, date: '2026-10-05', vendor: 'Eskema' }); expect(loc(r.remindAt)).toBe('2026-10-04 05:30 pm');
});
test('cheque note without a vendor', () => {
  const r = P('I wrote a 520000 cheque, clears on monday', now); expect(r).toMatchObject({ type: 'CHEQUE_NOTE', amount: 520000, date: '2026-10-05', vendor: null });
});
test('generic reminders', () => {
  const r = P('remind me to call Pioneer Hardware at 4pm', now);
  expect(r.type).toBe('REMIND'); expect(loc(r.remindAt)).toBe('2026-10-04 04:00 pm'); expect(r.subject.toLowerCase()).toContain('call pioneer hardware');
});
test('stock questions', () => {
  expect(P('how many eskema basin taps do we have', now)).toMatchObject({ type: 'STOCK_QUERY', q: expect.stringContaining('basin taps') });
  expect(P('stock of angle valve', now)).toMatchObject({ type: 'STOCK_QUERY', q: 'angle valve' });
});
test('reports and tasks', () => {
  expect(P('what is the cash gap', now).type).toBe('CASH_GAP');
  expect(P('cheques tomorrow', now).type).toBe('CHEQUES_DUE');
  expect(P('how much do we owe Eskema', now)).toMatchObject({ type: 'PAYABLE', vendor: 'eskema' });
  expect(P("today's sales", now)).toMatchObject({ type: 'SALES', day: 'today' });
  expect(P("what's pending", now).type).toBe('TASKS');
  expect(P('done 12', now)).toEqual({ type: 'DONE', id: 12 });
  expect(P('snooze 12 2 hours', now)).toMatchObject({ type: 'SNOOZE', id: 12 });
  expect(P('price of angle valve', now)).toMatchObject({ type: 'PRICE_QUERY', q: 'angle valve' });
});
test('nonsense is UNKNOWN, empty is EMPTY', () => { expect(P('blah blah', now).type).toBe('UNKNOWN'); expect(P('   ', now).type).toBe('EMPTY'); });
test('vendor extraction ignores filler words', () => { expect(extractVendor('Layla please note that Pioneer Hardware invoice is pending')).toBe('Pioneer Hardware'); });
