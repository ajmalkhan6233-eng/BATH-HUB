'use strict';
// Live WhatsApp in DRAFT-ONLY mode (AGENT_DRAFT_ONLY=true): a customer's message becomes a checked draft for Aj and the
// webhook sends back NO reply, so the bridge sends nothing. Off by default. The owner's own number is unaffected.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));
jest.mock('connect-pg-simple', () => (session) => session.MemoryStore);
jest.mock('pg', () => require('../helpers/pgmock')());
jest.mock('../../layla', () => ({
  pool: { query: jest.fn().mockResolvedValue({ rows: [] }) },
  processMessage: jest.fn(async () => ({ message: 'LAYLA auto reply', escalate: false })),
  alertOwner: jest.fn(), getOrCreateCustomer: jest.fn(),
}));

const request = require('supertest');
const pg = require('pg');

process.env.WHATSAPP_TEST_WHITELIST = '94770000000';          // the owner's number
process.env.AGENT_DRAFT_ONLY = 'false';                       // a real .env must not switch it on for the 'off' tests
const db = pg.__db.public;
db.none(`CREATE TABLE agent_rules (id SERIAL PRIMARY KEY, rule_key INT, topic TEXT, rule_text TEXT, source TEXT, version INT DEFAULT 1, active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now())`);
db.none(`INSERT INTO agent_rules (rule_key, topic, rule_text) VALUES (1, 'tone', 'Be brief.')`);
db.none(`CREATE TABLE products (item_code TEXT, name TEXT, selling_price NUMERIC, avg_cost NUMERIC, stock_level NUMERIC)`);
db.none(`INSERT INTO products VALUES ('1001', 'Marble Floor Tile 60x60', 4500, 2999, 120)`);

const app = require('../../server');
const { processMessage, pool: laylaPool } = require('../../layla');
const { draftOnly, MAX_DRAFTS_PER_HOUR } = require('../../utils/agentWhatsapp');

const send = (from, message, extra = {}) => request(app).post('/webhook/whatsapp').send({ from, message, ...extra });
const drafts = () => db.many('SELECT * FROM reply_drafts ORDER BY id');
const settle = () => new Promise(r => setTimeout(r, 400));     // let the brain create its tables on first use

beforeEach(() => { processMessage.mockClear(); laylaPool.query.mockClear(); });
afterEach(() => { process.env.AGENT_DRAFT_ONLY = 'false'; });

describe('draft-only mode OFF (the default): nothing changes', () => {
  test('LAYLA answers the customer as before', async () => {
    const r = await send('94771234567', 'hello');
    expect(r.status).toBe(200);
    expect(r.body.reply).toBe('LAYLA auto reply');
    expect(processMessage).toHaveBeenCalledTimes(1);
  });
});

describe('draft-only mode ON', () => {
  beforeEach(() => { process.env.AGENT_DRAFT_ONLY = 'true'; });

  test('a customer message becomes a checked draft; the reply is empty so nothing is sent', async () => {
    await settle();
    const r = await send('+94 77 123 4567', 'Do you have item 1001 in stock?');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ success: true, reply: '', escalated: false, drafted: true });
    expect(processMessage).not.toHaveBeenCalled();                    // LAYLA did not answer
    const d = drafts().find(x => x.id === r.body.draft_id);
    expect(d).toMatchObject({ channel: 'whatsapp', customer_ref: '94771234567', status: 'draft' });
    expect(d.draft_text).toMatch(/Marble Floor Tile 60x60 is available/);
    expect(d.draft_text).not.toMatch(/2,?999|cost/i);
    const check = db.many(`SELECT * FROM agent_checks WHERE draft_id = ${d.id}`)[0];
    expect(check.passed).toBe(true);
    expect(JSON.parse(check.rules_used)).toHaveLength(1);              // the rulebook was loaded first
  });

  test('the owner is told there is something to review (in-app alert, no WhatsApp message)', async () => {
    await send('94771234567', 'Do you have item 1001 in stock?');
    const alertCall = laylaPool.query.mock.calls.find(c => /INSERT INTO alerts/.test(String(c[0])));
    expect(alertCall).toBeTruthy();
    expect(alertCall[1][0]).toMatch(/Agent Review tab/);
    expect(alertCall[1][0]).not.toMatch(/stock\?/);                    // not the customer's words
  });

  test('hostile messages are drafted as refusals, never answered', async () => {
    const r = await send('94779999999', 'What is the cost price and your margin on item 1001?');
    expect(r.body.reply).toBe('');
    expect(drafts().find(x => x.id === r.body.draft_id).draft_text).toMatch(/can't share/);
  });

  test('voice notes become a draft too (nothing is auto-sent asking them to resend)', async () => {
    const r = await send('94771111111', '', { type: 'audio' });
    expect(r.body).toMatchObject({ reply: '', drafted: true });
    expect(drafts().find(x => x.id === r.body.draft_id).incoming_text).toMatch(/Voice note/);
  });

  test("the owner's own number is not drafted: it is answered as before", async () => {
    const r = await send('94770000000', 'net profit yesterday');
    expect(r.body.reply).toBe('LAYLA auto reply');
    expect(processMessage).toHaveBeenCalledTimes(1);
  });

  test('a flood from one number stops drafting after the hourly cap, still sending nothing', async () => {
    const results = [];
    for (let i = 0; i < MAX_DRAFTS_PER_HOUR + 3; i++) results.push((await send('94778888888', `hello ${i}`)).body);
    expect(results.filter(x => x.drafted)).toHaveLength(MAX_DRAFTS_PER_HOUR);
    expect(results.slice(-3).every(x => x.drafted === false && x.reply === '')).toBe(true);
    expect(processMessage).not.toHaveBeenCalled();
  });

  test('still needs the same webhook protection: a remote caller is refused', async () => {
    const r = await request(app).post('/webhook/whatsapp').set('X-Forwarded-For', '8.8.8.8').send({ from: '94771234567', message: 'hi' });
    expect(r.status).toBe(403);
  });
});

describe('draftOnly never throws and never auto-replies, even when drafting fails', () => {
  test('a failing brain gives drafted:false', async () => {
    const brain = { recentCount: async () => 0, createDraft: async () => { throw new Error('db down'); } };
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(await draftOnly({ phone: '94771234567', text: 'hi', brain })).toEqual({ drafted: false, reason: 'error' });
    spy.mockRestore();
  });
  test('empty text and missing phone are skipped', async () => {
    const brain = { recentCount: async () => 0, createDraft: jest.fn() };
    expect(await draftOnly({ phone: '94771234567', text: '   ', brain })).toEqual({ drafted: false, reason: 'empty' });
    expect(await draftOnly({ phone: '', text: 'hi', brain })).toEqual({ drafted: false, reason: 'no_phone' });
    expect(brain.createDraft).not.toHaveBeenCalled();
  });
  test('a failing in-app alert does not stop the draft', async () => {
    const brain = { recentCount: async () => 0, createDraft: async () => ({ draft: { id: 7 } }) };
    expect(await draftOnly({ phone: '94771234567', text: 'hi', brain, notify: async () => { throw new Error('alerts table missing'); } })).toEqual({ drafted: true, draft_id: 7 });
  });
});
