'use strict';
// LAYLA used to run the owner-facing answer engine (profit, credit balances, cheques, item COST) for ANY sender.
// A customer asking "net profit yesterday" or "cost of item 1001" would have got the real figures back.
// Now only the owner's own number reaches it.
jest.mock('pg', () => require('../helpers/pgmock')());
jest.mock('axios', () => ({ post: jest.fn().mockRejectedValue(new Error('no network in tests')) }));
jest.mock('../../openrouter.config', () => ({
  client: { chat: { completions: { create: jest.fn().mockRejectedValue(new Error('no AI in tests')) } } }, DEFAULT_MODEL: 'test',
}));
jest.mock('../../scripts/layla_answer_engine', () => ({
  classifyAndAnswer: jest.fn(async () => ({ intent: 'net_profit_day', reply: 'SECRET: Net Profit LKR 12,540, Cost LKR 2,999' })),
}));

process.env.WHATSAPP_TEST_WHITELIST = '+94 77 000 0000';       // the owner's number
const pg = require('pg');
const db = pg.__db.public;
db.none(`CREATE TABLE customers (id SERIAL PRIMARY KEY, name TEXT, phone TEXT, whatsapp TEXT, location TEXT, source TEXT, notes TEXT, last_contact TIMESTAMPTZ DEFAULT NOW(), created_at TIMESTAMPTZ DEFAULT NOW())`);
db.none(`CREATE TABLE conversations (id SERIAL PRIMARY KEY, customer_id INT, channel TEXT, agent TEXT, messages JSONB DEFAULT '[]', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`);
db.none(`CREATE TABLE alerts (id SERIAL PRIMARY KEY, type TEXT, message TEXT, priority TEXT, read BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW())`);

const { classifyAndAnswer } = require('../../scripts/layla_answer_engine');
const { processMessage } = require('../../layla');

beforeEach(() => classifyAndAnswer.mockClear());

describe('who can reach the owner-facing answer engine', () => {
  test('a customer never does, and never receives its figures', async () => {
    for (const msg of ['What was net profit yesterday?', 'cost of item 1001', 'credit balance of Kamal', 'hello, are you open today?']) {
      const r = await processMessage('94771234567', msg);
      expect(r.message).not.toMatch(/SECRET|12,540|2,999/);
    }
    expect(classifyAndAnswer).not.toHaveBeenCalled();
  });

  test("the owner's own number still gets business answers (it is how the owner checks the shop)", async () => {
    const r = await processMessage('94770000000', 'net profit yesterday');
    expect(classifyAndAnswer).toHaveBeenCalledTimes(1);
    expect(r.message).toMatch(/Net Profit LKR 12,540/);
  });

  test('with no owner number configured, nobody is treated as the owner', async () => {
    jest.resetModules();
    const saved = process.env.WHATSAPP_TEST_WHITELIST;
    process.env.WHATSAPP_TEST_WHITELIST = '';
    const pg2 = require('pg');                                   // fresh in-memory database after the module reset
    pg2.__db.public.none(`CREATE TABLE customers (id SERIAL PRIMARY KEY, name TEXT, phone TEXT, whatsapp TEXT, location TEXT, source TEXT, notes TEXT, last_contact TIMESTAMPTZ DEFAULT NOW(), created_at TIMESTAMPTZ DEFAULT NOW())`);
    pg2.__db.public.none(`CREATE TABLE conversations (id SERIAL PRIMARY KEY, customer_id INT, channel TEXT, agent TEXT, messages JSONB DEFAULT '[]', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`);
    pg2.__db.public.none(`CREATE TABLE alerts (id SERIAL PRIMARY KEY, type TEXT, message TEXT, priority TEXT, read BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW())`);
    const again = require('../../layla');
    const engine = require('../../scripts/layla_answer_engine').classifyAndAnswer;
    await again.processMessage('94770000000', 'net profit yesterday');
    expect(engine).not.toHaveBeenCalled();
    process.env.WHATSAPP_TEST_WHITELIST = saved;
  });
});
