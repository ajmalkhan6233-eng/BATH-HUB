'use strict';
jest.mock('pg', () => require('../helpers/pgmock')());
// WhatsApp replies to drafts (ok / cancel / edit / force / create customer) + customer_create filing, on the real inbox route (pg-mem).
const path = require('path'); const fs = require('fs'); const os = require('os');
const { parse, createInboxCommands } = require('../../layla_owner/inboxCommands');
const { processInbound } = require('../../layla_owner/inbound');

describe('command words', () => {
  test('the small list', () => {
    expect(parse('ok 5')).toEqual({ cmd: 'ok', id: 5 });
    expect(parse('OK')).toEqual({ cmd: 'ok', id: null });
    expect(parse('ok all')).toEqual({ cmd: 'ok', id: 'all' });
    expect(parse('cancel #6')).toEqual({ cmd: 'cancel', id: 6 });
    expect(parse('edit 5 amount 1,800')).toEqual({ cmd: 'edit', id: 5, field: 'amount', value: '1,800' });
    expect(parse('force 5')).toEqual({ cmd: 'force', id: 5 });
    expect(parse('create customer Saman 8500')).toEqual({ cmd: 'create', name: 'Saman', amount: 8500, phone: '' });
    expect(parse('create customer Nimal Perera Rs 2,500 0771234567')).toEqual({ cmd: 'create', name: 'Nimal Perera', amount: 2500, phone: '0771234567' });
    expect(parse('create customer Kamal')).toMatchObject({ name: 'Kamal', amount: null });
    expect(parse('how much stock of tap')).toBeNull();
  });
});

let pool, inbox, cmd, sent, deps;
beforeAll(async () => {
  const pg = require('pg'); const db = pg.__db.public;
  db.none(`CREATE TABLE customers (id SERIAL PRIMARY KEY, name TEXT, phone TEXT UNIQUE NOT NULL, whatsapp TEXT, notes TEXT)`);
  db.none(`CREATE TABLE credit_customers (id SERIAL PRIMARY KEY, customer_id INT, invoice_date DATE, invoice_no TEXT, amount NUMERIC DEFAULT 0, paid NUMERIC DEFAULT 0, due_date DATE, notes TEXT, quarantined BOOLEAN DEFAULT FALSE)`);
  db.none(`INSERT INTO customers (name, phone) VALUES ('Sam Perera','0771111111')`);
  pool = new pg.Pool();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'di-'));
  inbox = require('../../routes/document_inbox').createRouter(pool, { inboxRoot: root, fileDaySheet: async () => ({ message: 'x' }) });
  cmd = createInboxCommands({ inbox });
});
beforeEach(async () => { await inbox.list('to_check').catch(() => {}); await pool.query(`UPDATE document_inbox SET status='rejected' WHERE status='to_check'`).catch(() => {}); sent = []; deps = { store: { remember: async () => true, create: async () => ({}) }, adapters: {}, send: async (to, t) => sent.push(t), ownerNumber: '94777999219', inboxCmd: cmd, paper: { hasPending: async () => false, handleText: async () => null } }; });
const say = (text, id = 'm' + Math.random()) => processInbound({ id, from: '94777999219', type: 'text', text }, deps);

describe('create customer by message', () => {
  test('draft first, nothing made; then ok makes the customer and the opening credit', async () => {
    await say('create customer Saman 8500');
    expect(sent[0]).toMatch(/Draft #\d+: New customer Saman, opening credit Rs 8,500/); expect(sent[0]).toMatch(/NOTHING is made yet/);
    expect((await pool.query(`SELECT * FROM customers WHERE name='Saman'`)).rows).toHaveLength(0);
    const id = Number(sent[0].match(/Draft #(\d+)/)[1]);
    await say('ok ' + id);
    expect(sent[1]).toMatch(/FILED #\d+: Customer Saman made .*opening credit Rs 8500/);
    const c = (await pool.query(`SELECT * FROM customers WHERE name='Saman'`)).rows[0];
    expect(c.phone).toMatch(/^NOPHONE-/);
    const cc = (await pool.query(`SELECT * FROM credit_customers WHERE customer_id=$1`, [c.id])).rows;
    expect(cc).toHaveLength(1); expect(Number(cc[0].amount)).toBe(8500); expect(cc[0].invoice_no).toMatch(/^OPENING-/);
  });
  test('duplicate name is refused at draft time, similar name warns', async () => {
    await say('create customer Sam Perera 100');
    expect(sent[0]).toMatch(/already a customer/); 
    await say('create customer Perera 300');
    expect(sent[1]).toMatch(/Similar already there: Sam Perera/);
  });
  test('a similar name needs force to file', async () => {
    await say('create customer Perera 300');
    const id = Number(sent[0].match(/Draft #(\d+)/)[1]);
    await say('ok ' + id); expect(sent[1]).toMatch(/needs your OK.*force/);
    await say('force ' + id); expect(sent[2]).toMatch(/FILED/);
  });
});

describe('edit / cancel / ok from WhatsApp', () => {
  test('edit changes one box, cancel files nothing', async () => {
    const d = await inbox.recordVoice({ entry: { kind: 'credit_given', party: 'Sam Perera', amount: 1500, date: '2026-10-18' }, buffer: Buffer.from('x'), from: '94777999219' });
    await say(`edit ${d.id} amount 1800`);
    expect(sent[0]).toMatch(/Edited #\d+: Credit to Sam Perera Rs 1,800/);
    await say(`edit ${d.id} colour red`); expect(sent[1]).toMatch(/you can edit: amount, name/);
    await say(`cancel ${d.id}`); expect(sent[2]).toMatch(/Cancelled/);
    expect((await pool.query(`SELECT * FROM credit_customers WHERE invoice_no LIKE 'VOICE-%'`)).rows).toHaveLength(0);
    await say(`ok ${d.id}`); expect(sent[3]).toMatch(/NOT filed.*already rejected/);
  });
  test('ok files the credit through the same code as the Confirm button', async () => {
    const d = await inbox.recordVoice({ entry: { kind: 'credit_given', party: 'Sam Perera', amount: 1500, date: '2026-10-18' }, buffer: Buffer.from('x'), from: '94777999219' });
    await say('ok');   // the only waiting draft
    expect(sent[0]).toMatch(new RegExp(`FILED #${d.id}: Credit of 1500 to Sam Perera`));
  });
  test('a bare ok is left to the paper flow when a paper draft is waiting, and ignored when nothing waits', async () => {
    await inbox.recordVoice({ entry: { kind: 'credit_given', party: 'Sam Perera', amount: 10, date: '2026-10-18' }, buffer: Buffer.from('x') });
    deps.paper = { hasPending: async () => true, handleText: async () => ({ reply: 'paper saved' }) };
    await say('ok'); expect(sent[0]).toBe('paper saved');
    await pool.query(`UPDATE document_inbox SET status='rejected'`);
    deps.paper = { hasPending: async () => false, handleText: async () => null };
    expect(cmd.parse('ok')).toBeTruthy();
    expect(await cmd.handle('ok', {})).toBeNull();
  });
  test('two waiting drafts: a bare ok asks which', async () => {
    await inbox.recordVoice({ entry: { kind: 'credit_given', party: 'Sam Perera', amount: 10, date: '2026-10-18' }, buffer: Buffer.from('x') });
    await inbox.recordVoice({ entry: { kind: 'credit_given', party: 'Sam Perera', amount: 20, date: '2026-10-18' }, buffer: Buffer.from('x') });
    await say('ok'); expect(sent[0]).toMatch(/2 drafts are waiting. Which one\?/);
    await say('ok all'); expect(sent[1].split('\n').filter(l => /^FILED/.test(l))).toHaveLength(2);
  });
  test('a stranger cannot use the words (customers and others never reach them)', async () => {
    const r = await processInbound({ id: 'x1', from: '94770000000', type: 'text', text: 'ok all' }, deps);
    expect(r.status).toBe('ignored'); expect(sent).toHaveLength(0);
  });
});

describe('voice: "create customer" is understood', () => {
  const { cleanVoice } = require('../../utils/geminiVoice');
  test('customer_create needs a name; amount optional', () => {
    expect(cleanVoice({ text: 'x', entries: [{ kind: 'customer_create', party: 'Saman', amount: 8500 }] }).entries[0]).toMatchObject({ kind: 'customer_create', party: 'Saman', amount: 8500 });
    expect(cleanVoice({ text: 'x', entries: [{ kind: 'customer_create', party: 'Nimal' }] }).entries[0].kind).toBe('customer_create');
    expect(cleanVoice({ text: 'x', entries: [{ kind: 'customer_create', amount: 5 }] }).entries).toHaveLength(0);
  });
});
