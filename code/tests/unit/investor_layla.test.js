const { summarize, reply, answerInvestor } = require('../../utils/investorLayla');
const { paperItem } = require('../../utils/paperNotifications');
test('investor figures: amount, agreed profit, paid, outstanding', () => {
  const s = summarize([{ amount: 100000, profit_rate: 10, due_date: '2026-12-01', status: 'active', paid: 30000 }]);
  expect(s).toMatchObject({ invested: 100000, agreedProfit: 10000, totalDue: 110000, paid: 30000, outstanding: 80000, nextDue: '2026-12-01' });
  expect(reply('Nimal', s)).toContain('LKR 100,000');
});
test('an unregistered number gets null (falls through to normal Layla)', async () => {
  const pool = { query: async (q) => (/SELECT \* FROM investor_contacts/.test(q) ? { rows: [] } : { rows: [] }) };
  expect(await answerInvestor(pool, '94771234567')).toBeNull();
});
test('a registered investor only sees their own loans', async () => {
  const pool = { query: async (q, p) => /SELECT \* FROM investor_contacts/.test(q) ? { rows: [{ name: 'Nimal', lender_name: 'Nimal P' }] }
    : /investor_loans/.test(q) ? (p[0] === 'Nimal P' ? { rows: [{ amount: 50000, profit_rate: 8, due_date: null, status: 'active', paid: 0 }] } : { rows: [] }) : { rows: [] } };
  const t = await answerInvestor(pool, '94771234567');
  expect(t).toContain('LKR 50,000'); expect(t).toContain('LKR 4,000');
});
test('paper notification shows type, name and total', () => {
  const i = paperItem({ id: 7, doc_type: 'grn', extracted: JSON.stringify({ supplier_name: 'Lanka Tiles', total: 15000 }), reader_note: '' });
  expect(i).toMatchObject({ category: 'paper', ref_id: 7, title: 'GRN waiting for you to check' });
  expect(i.detail).toContain('Lanka Tiles');
});
