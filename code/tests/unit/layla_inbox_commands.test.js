'use strict';
jest.mock('pg', () => require('../helpers/pgmock')());
// WhatsApp replies to drafts (ok / cancel / edit / force / create customer) + customer_create filing, on the real inbox route (pg-mem).
const path = require('path'); const fs = require('fs'); const os = require('os');
const { parse, label, createInboxCommands } = require('../../layla_owner/inboxCommands');
const { processInbound } = require('../../layla_owner/inbound');

describe('command words', () => {
  test('the small list, no numbers needed', () => {
    expect(parse('ok')).toMatchObject({ cmd: 'ok', all: false, id: null, sel: '' });
    expect(parse('yes')).toMatchObject({ cmd: 'ok' });
    expect(parse('ok all')).toMatchObject({ cmd: 'ok', all: true });
    expect(parse('ok saman')).toMatchObject({ cmd: 'ok', sel: 'saman' });
    expect(parse('ok 5')).toMatchObject({ cmd: 'ok', id: 5 });
    expect(parse('cancel tea')).toMatchObject({ cmd: 'cancel', sel: 'tea' });
    expect(parse('cancel')).toMatchObject({ cmd: 'cancel', sel: '', id: null });
    expect(parse('edit amount 1,800')).toMatchObject({ cmd: 'edit', sel: '', field: 'amount', value: '1,800' });
    expect(parse('edit saman amount 600')).toMatchObject({ cmd: 'edit', sel: 'saman', field: 'amount', value: '600' });
    expect(parse('force')).toMatchObject({ cmd: 'force' });
    expect(parse('create customer Saman 8500')).toEqual({ cmd: 'create', name: 'Saman', amount: 8500, phone: '' });
    expect(parse('create customer Nimal Perera Rs 2,500 0771234567')).toEqual({ cmd: 'create', name: 'Nimal Perera', amount: 2500, phone: '0771234567' });
    expect(parse('how much stock of tap')).toBeNull();
  });
  test('labels are words, not numbers', () => {
    expect(label({ doc_type: 'credit_given', extracted: { customer_name: 'Saman', amount: 1500, date: '2026-10-18' } })).toBe('Saman credit Rs 1,500, 18 Oct');
    expect(label({ doc_type: 'expense_sheet', extracted: { total_expenses: 1700, date: '2026-10-18' } })).toBe('Expenses Rs 1,700, 18 Oct');
  });
});

let pool, inbox, cmd, sent, deps;
beforeAll(async () => {
  const pg = require('pg'); const db = pg.__db.public;
  db.none(`CREATE TABLE customers (id SERIAL PRIMARY KEY, name TEXT, phone TEXT UNIQUE NOT NULL, whatsapp TEXT, notes TEXT)`);
  db.none(`CREATE TABLE credit_customers (id SERIAL PRIMARY KEY, customer_id INT, invoice_date DATE, invoice_no TEXT, amount NUMERIC DEFAULT 0, paid NUMERIC DEFAULT 0, due_date DATE, notes TEXT, quarantined BOOLEAN DEFAULT FALSE)`);
  db.none(`INSERT INTO customers (name, phone) VALUES ('Sam Perera','0771111111'), ('Nimal Silva','0772222222')`);
  pool = new pg.Pool();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'di-'));
  inbox = require('../../routes/document_inbox').createRouter(pool, { inboxRoot: root, fileDaySheet: async () => ({ message: 'x' }) });
  cmd = createInboxCommands({ inbox });
});
beforeEach(async () => { await inbox.list('to_check').catch(() => {}); await pool.query(`UPDATE document_inbox SET status='rejected' WHERE status='to_check'`).catch(() => {}); sent = []; deps = { store: { remember: async () => true, create: async () => ({}) }, adapters: {}, send: async (to, t) => sent.push(t), ownerNumber: '94777999219', inboxCmd: cmd, paper: { hasPending: async () => false, handleText: async () => null } }; });
const say = (text, id = 'm' + Math.random()) => processInbound({ id, from: '94777999219', type: 'text', text }, deps);


const mkVoice = (party, amount, kind = 'credit_given') => inbox.recordVoice({ entry: { kind, party, amount, date: new Date().toISOString().slice(0, 10) }, buffer: Buffer.from('x'), from: '94777999219' });
const rows = async (q) => (await pool.query(q)).rows;

describe('the FIRST word is the command; extra words are chatter; Sinhala and Tamil words', () => {
  test('parse', () => {
    expect(parse('cancel, this is a test')).toMatchObject({ cmd: 'cancel' });
    expect(parse('Ok please')).toMatchObject({ cmd: 'ok' });
    expect(parse('ඔව්')).toMatchObject({ cmd: 'ok', sel: '' });
    expect(parse('හරි')).toMatchObject({ cmd: 'ok' });
    expect(parse('එපා')).toMatchObject({ cmd: 'cancel' });
    expect(parse('அவலங்கு')).toBeNull();
    expect(parse('edit amount rs 1,800 please')).toMatchObject({ field: 'amount', value: 'rs 1,800 please' });
  });
  test('cancel with extra words drops the latest; ok please files it; edit with trailing words; long sentences are not commands', async () => {
    await mkVoice('Sam Perera', 77);
    await say('Cancel, this is a test'); expect(sent[0]).toMatch(/^Cancelled: Sam Perera credit Rs 77/);
    await mkVoice('Sam Perera', 88);
    await say('edit amount 99 please'); expect(sent[1]).toMatch(/Now: Sam Perera credit Rs 99/);
    await say('Yes, please'); expect(sent[2]).toMatch(/^FILED: Sam Perera credit Rs 99/);
    await mkVoice('Nimal Silva', 5);
    await say('ok'); await say('ඔව්');   // nothing left after the first ok: the second is an ordinary message
    await mkVoice('Nimal Silva', 6);
    await say('ඔව්'); expect(sent[sent.length - 1]).toMatch(/^FILED: Nimal Silva credit Rs 6/);
    await mkVoice('Nimal Silva', 7);
    await say('ok that sounds good to me'); expect(sent[sent.length - 1]).toMatch(/did not get that|^$/);   // talk, not a command
    await say('ok nimalx'); expect(sent[sent.length - 1]).toMatch(/Nothing waiting matches "nimalx"\. The latest is: Nimal Silva credit Rs 7/);
  });
});

describe('create customer by message', () => {
  test('draft first, nothing made; a bare ok makes the customer and the opening credit', async () => {
    await say('create customer Saman 8500');
    expect(sent[0]).toMatch(/Draft: New customer Saman, opening credit Rs 8,500\. NOTHING is made yet/); expect(sent[0]).not.toMatch(/#\d/);
    expect(await rows(`SELECT * FROM customers WHERE name='Saman'`)).toHaveLength(0);
    await say('ok');
    expect(sent[1]).toMatch(/FILED: New customer Saman.*Customer Saman made .*opening credit Rs 8500/);
    const c = (await rows(`SELECT * FROM customers WHERE name='Saman'`))[0];
    expect(c.phone).toMatch(/^NOPHONE-/);
    const cc = await rows(`SELECT * FROM credit_customers WHERE customer_id=${c.id}`);
    expect(cc).toHaveLength(1); expect(Number(cc[0].amount)).toBe(8500); expect(cc[0].invoice_no).toMatch(/^OPENING-/);
  });
  test('duplicate name is refused at draft time, similar name warns, force files it', async () => {
    await say('create customer Sam Perera 100'); expect(sent[0]).toMatch(/already a customer/);
    await say('create customer Perera 300'); expect(sent[1]).toMatch(/Similar already there: Sam Perera/);
    await say('ok'); expect(sent[2]).toMatch(/needs your OK first[\s\S]*force/);
    await say('force'); expect(sent[3]).toMatch(/FILED: New customer Perera/);
  });
});

describe('answer drafts without any number', () => {
  test('edit amount changes the latest draft; the reply names it', async () => {
    const d1 = await mkVoice('Sam Perera', 1500);
    await say('edit amount 1800'); expect(sent[0]).toMatch(/Changed\. Now: Sam Perera credit Rs 1,800/);
    await say('edit bank xyz'); expect(sent[1]).toMatch(/you can edit: amount, name/);
    await say('cancel'); expect(sent[2]).toMatch(/Cancelled: Sam Perera credit Rs 1,800/);
    expect(await rows(`SELECT * FROM credit_customers WHERE invoice_no = 'VOICE-${d1.id}'`)).toHaveLength(0);
    await say('ok'); expect(sent[3]).toMatch(/did not get that/);   // nothing waiting: an ordinary ok, not handled here
  });
  test('bare ok files the LATEST draft; "ok sam" picks by name; the reply names what was filed', async () => {
    await mkVoice('Nimal Silva', 20); await mkVoice('Sam Perera', 1500);
    await say('ok nimal'); expect(sent[0]).toBe('FILED: Nimal Silva credit Rs 20, ' + label({ doc_type: 'x', extracted: { date: new Date().toISOString().slice(0, 10) } }).replace(/^x ?/, '').replace(/^, /, '') + '.');
    await say('ok'); expect(sent[1]).toMatch(/^FILED: Sam Perera credit Rs 1,500/);
  });
  test('two matches: one short question, answer 1 or 2', async () => {
    await mkVoice('Sam Perera', 111); await mkVoice('Sam Perera', 222);
    await say('ok sam'); expect(sent[0]).toMatch(/More than one matches\. Reply 1 or 2:\n1\) Sam Perera credit Rs 111.*\n2\) Sam Perera credit Rs 222/);
    await say('2'); expect(sent[1]).toMatch(/^FILED: Sam Perera credit Rs 222/);
    await say('1'); expect(sent[2]).toMatch(/did not get that/);   // the question was used up: a lone "1" is not a command
  });
  test('ok all files every draft from today; drafts lists them', async () => {
    await mkVoice('Sam Perera', 5); await mkVoice('Nimal Silva', 6);
    await say('drafts'); expect(sent[0]).toMatch(/- Sam Perera credit Rs 5.*\n- Nimal Silva credit Rs 6/);
    await say('ok all'); expect(sent[1].split('\n').filter(l => /^FILED/.test(l))).toHaveLength(2);
  });
  test('a draft older than 12 hours is not filed by a bare ok, only by name', async () => {
    const d = await mkVoice('Sam Perera', 9);
    await pool.query(`UPDATE document_inbox SET created_at = NOW() - INTERVAL '30 hours' WHERE id = ${d.id}`);
    await say('ok'); expect(sent[0]).toMatch(/did not get that/);
    await say('ok sam'); expect(sent[1]).toMatch(/^FILED: Sam Perera credit Rs 9/);
  });
  test('a bare ok is left to the paper flow when a paper draft is waiting', async () => {
    await mkVoice('Sam Perera', 10);
    deps.paper = { hasPending: async () => true, handleText: async () => ({ reply: 'paper saved' }) };
    await say('ok'); expect(sent[0]).toBe('paper saved');
    await say('ok sam'); expect(sent[1]).toMatch(/^FILED: Sam Perera/);   // words still reach this module
  });
  test('a stranger cannot use the words', async () => {
    await mkVoice('Sam Perera', 10);
    const r = await processInbound({ id: 'x1', from: '94770000000', type: 'text', text: 'ok all' }, deps);
    expect(r.status).toBe('ignored'); expect(sent).toHaveLength(0);
    expect(await rows(`SELECT * FROM document_inbox WHERE status='to_check'`)).toHaveLength(1);
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

describe('payment reminders (to the owner only)', () => {
  test('lists late customers with a ready text, sends nothing to them', async () => {
    const c = (await rows(`SELECT id FROM customers WHERE name='Sam Perera'`))[0].id;
    await pool.query(`INSERT INTO credit_customers (customer_id, invoice_date, invoice_no, amount, paid, due_date) VALUES (${c}, '2026-08-01', 'OLD-1', 4000, 1000, '2026-09-01')`);
    await say('reminders');
    expect(sent).toHaveLength(1); expect(sent[0]).toMatch(/Sam Perera: Rs 3,000 since 1 Sep/); expect(sent[0]).toMatch(/Text to forward: "Dear Sam Perera, a friendly reminder from Royal Bath Hub/);
  });
});
