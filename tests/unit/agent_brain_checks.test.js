'use strict';
// M9: the four checks every customer reply must pass, tested on their own.
const { checkReply, markPriceIfNeeded, customerText, hasPrice, PRICE_MARKER } = require('../../utils/agentBrain');

const failed = r => r.checks.filter(c => !c.pass).map(c => c.id);

describe('(a) no internal data', () => {
  test.each([
    'Our cost price is lower.', 'The margin on this is good.', 'Supplier price was 2000.', 'We pay commission to staff.',
    'Our loan is due.', 'Net profit was high today.', 'The investor asked.', 'A cheque is pending.', 'wholesale rate',
  ])('"%s" fails', (t) => { expect(failed(checkReply(t))).toContain('no_internal_data'); });

  test('everyday words pass (delivery cost, interested)', () => {
    expect(checkReply('Delivery cost depends on the distance. Are you interested in 60x60 tiles?').passed).toBe(true);
  });

  test('a known internal figure appearing in the text fails, with or without commas', () => {
    expect(failed(checkReply('It is yours for 2999.', { internalValues: [2999] }))).toContain('no_internal_data');
    expect(failed(checkReply('It is yours for 12,500.', { internalValues: ['12500'] }))).toContain('no_internal_data');
    expect(checkReply('We have it in stock.', { internalValues: [2999] }).passed).toBe(true);
  });
});

describe('(b) prices are marked "needs Aj approval"', () => {
  test('an unmarked price fails; markPriceIfNeeded fixes it once', () => {
    const t = 'The tile is Rs 4,500 per box.';
    expect(hasPrice(t)).toBe(true);
    expect(failed(checkReply(t))).toEqual(['price_marked']);
    const marked = markPriceIfNeeded(t);
    expect(marked.startsWith(PRICE_MARKER)).toBe(true);
    expect(checkReply(marked).passed).toBe(true);
    expect(markPriceIfNeeded(marked)).toBe(marked);                       // not added twice
  });
  test('no price means no mark is needed or added', () => {
    expect(markPriceIfNeeded('We open at 9am.')).toBe('We open at 9am.');
    expect(checkReply('We open at 9am.').checks.find(c => c.id === 'price_marked').pass).toBe(true);
  });
  test('the customer text drops the internal mark', () => {
    expect(customerText(markPriceIfNeeded('Rs 4,500 per box.'))).toBe('Rs 4,500 per box.');
  });
});

describe('(c) halal', () => {
  test.each([
    'We charge 5% interest on credit.', 'Pay with interest over 6 months.', 'There is a late fee of 500.', 'A penalty charge applies.',
    'This is riba free? no, riba applies.', 'Join our lottery.', 'Guaranteed returns on stock.', 'compound interest applies',
  ])('"%s" fails', (t) => { expect(failed(checkReply(t))).toContain('halal'); });

  test('normal wording passes', () => {
    expect(checkReply('You can pay in cash or by card. No hidden charges.').passed).toBe(true);
  });
});

describe("(d) says I don't know when data is missing", () => {
  test('missing data + a confident answer fails', () => {
    expect(failed(checkReply('It will arrive on Friday.', { dataMissing: true }))).toEqual(['says_dont_know']);
  });
  test("missing data + 'I don't know' passes", () => {
    expect(checkReply("I don't know the stock yet, Aj will confirm.", { dataMissing: true }).passed).toBe(true);
    expect(checkReply('I do not know that yet.', { dataMissing: true }).passed).toBe(true);
  });
  test("saying I don't know but then guessing a number fails", () => {
    const r = checkReply("I don't know, but probably around 40 boxes.", { dataMissing: true });
    expect(failed(r)).toEqual(['says_dont_know']);
    expect(r.checks.find(c => c.id === 'says_dont_know').detail).toMatch(/guess/);
  });
  test('data found: no "I don\'t know" needed', () => {
    expect(checkReply('The basin is in stock.', { dataMissing: false }).passed).toBe(true);
  });
});

test('all four checks are always reported, in order', () => {
  expect(checkReply('hello').checks.map(c => c.id)).toEqual(['no_internal_data', 'price_marked', 'halal', 'says_dont_know']);
});
