const { newDb } = require('pg-mem');
const { migrate } = require('../scripts/migrate_layla_owner');
const { migrate: migrateLedger } = require('../scripts/migrate_vendor_ledger');
const createStore = require('../layla_owner/taskStore');
const createAdapters = require('../layla_owner/adapters');
const { handleOwnerMessage } = require('../layla_owner/brain');
let pool, store, adapters; const now = () => new Date('2026-10-04T04:30:00Z');
const ask = (t) => handleOwnerMessage({ id: 'w' + Math.random(), text: t }, { store, adapters, now });
beforeAll(async () => { const { Pool } = newDb().adapters.createPg(); pool = new Pool(); await migrate(pool); await migrateLedger(pool); store = createStore(pool); adapters = createAdapters({ pool });
  await pool.query(`INSERT INTO vendor_bills (vendor_name, bill_date, total) VALUES ('Eskema Ceramic','2026-01-13',213200)`);
  await pool.query(`INSERT INTO vendor_bill_cheques (bill_id, amount, cheque_date, due_date, status) VALUES (1, 213200, '2026-10-04', '2026-10-05', 'ISSUED')`); });

test("owner's sentence creates a GRN reminder for 5:30 pm and answers like a person", async () => {
  const r = await ask('Layla, Fazal Hardware there is a bill pending I did not enter it into the GRN just remind me by evening');
  expect(r.reply).toContain('Fazal Hardware'); expect(r.reply).toContain('2026-10-04 05:30 pm'); expect(r.taskId).toBeGreaterThan(0);
  const open = await store.listOpen(); expect(open[0].title).toBe('Enter Fazal Hardware bill into the GRN');
});
test('cheque note makes a reminder and does NOT touch the ledger', async () => {
  const before = (await pool.query('SELECT COUNT(*) AS n FROM vendor_bill_cheques')).rows[0].n;
  const r = await ask('quick note I wrote a 1 million cheque, it will realize tomorrow, just remind me in the evening');
  expect(r.reply).toContain('Rs. 1,000,000'); expect(r.reply).toContain('I have not added it to the ledger');
  expect((await pool.query('SELECT COUNT(*) AS n FROM vendor_bill_cheques')).rows[0].n).toBe(before);
});
test('questions read the vendor ledger', async () => {
  expect((await ask('how much do we owe Eskema')).reply).toContain('Rs. 213,200');
  expect((await ask('cheques tomorrow')).reply).toContain('tomorrow Rs. 213,200');
});
test('stock lookup says so honestly when not wired', async () => { expect((await ask('stock of angle valve')).reply).toContain('cannot see the stock list yet'); });
test('stock lookup works once wired', async () => {
  const a2 = { ...adapters, stock: async (q) => [{ name: 'Angle valve square', code: '1291', qty: 40, price: 1390 }] };
  const r = await handleOwnerMessage('stock of angle valve', { store, adapters: a2, now }); expect(r.reply).toBe('Angle valve square (1291): 40 in stock, Rs. 1,390');
});
test('done and tasks', async () => {
  const list = await ask("what's pending"); expect(list.reply).toContain('Fazal Hardware');
  const id = (await store.listOpen())[0].id; expect((await ask('done ' + id)).reply).toContain('Done');
  expect((await ask('done 9999')).reply).toContain('could not find');
});
test('unknown and help', async () => { expect((await ask('banana')).reply).toContain('did not get that'); expect((await ask('help')).reply).toContain('Examples'); });
