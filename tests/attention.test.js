const A = require('../utils/attention');
test('attention lists red first and skips empty or missing tables', async () => {
  const pool = { query: async sql => { if (/vendor_bill_watch/.test(sql)) return { rows: [{ n: 1, amt: 400 }] }; if (/oversold_owed/.test(sql)) return { rows: [{ n: 2 }] }; if (/vendor_bill_cheques/.test(sql)) return { rows: [{ n: 0 }] }; throw new Error('does not exist'); } };
  const r = await A.collect(pool);
  expect(r.map(x => x.level)).toEqual(['red', 'amber']); expect(r[0].text).toMatch(/Rs 400/);
});
