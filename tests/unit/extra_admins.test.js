'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const { run } = require('../../utils/extraAdmins');
test('listed logins become admin; names are lower-cased; nothing else is touched; missing ones are reported', async () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ea-')), 'a.json'); fs.writeFileSync(f, JSON.stringify({ usernames: ['RoyalBathHub1@Gmail.com', 'nobody'] }));
  const calls = [];
  const pool = { query: async (sql, args) => { calls.push([sql, args]); return /UPDATE/.test(sql) ? { rows: [{ username: 'royalbathhub1@gmail.com' }] } : { rows: [{ username: 'royalbathhub1@gmail.com' }] }; } };
  const r = await run(pool, f);
  expect(calls[0][1][0]).toEqual(['royalbathhub1@gmail.com', 'nobody']); expect(/WHERE LOWER\(username\) = ANY/.test(calls[0][0])).toBe(true);
  expect(r.changed).toBe(1); expect(r.missing).toEqual(['nobody']);
});
test('no config file: does nothing and never throws', async () => { expect(await run({ query: () => { throw new Error('no'); } }, '/nonexistent.json')).toEqual({ changed: 0, found: [] }); });
