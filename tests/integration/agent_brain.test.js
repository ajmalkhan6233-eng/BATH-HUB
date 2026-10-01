'use strict';
// M9 Agent Brain end to end on an in-memory database: rules loaded from M1, customer-safe draft saved into M6's
// reply_drafts, the four checks logged in agent_checks, Aj approves / rejects / edits. Nothing is ever sent.
const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');
const { newDb } = require('pg-mem');
const { createRouter } = require('../../routes/agent_brain');

const ROUTE_SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'routes', 'agent_brain.js'), 'utf8');
const UTIL_SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'utils', 'agentBrain.js'), 'utf8');

async function makeApp(role = 'owner', { realEngine = false } = {}) {
  const { Pool } = newDb().adapters.createPg();
  const pool = new Pool();
  await pool.query(`CREATE TABLE agent_rules (id SERIAL PRIMARY KEY, rule_key INT, topic TEXT, rule_text TEXT, source TEXT, version INT DEFAULT 1, active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now())`);
  await pool.query(`INSERT INTO agent_rules (rule_key, topic, rule_text, version, active) VALUES (1,'tone','Be brief.',1,true), (2,'old','Retired rule.',1,false), (3,'prices','Prices are ask-us by default.',2,true)`);
  await pool.query(`CREATE TABLE products (item_code TEXT, name TEXT, selling_price NUMERIC, avg_cost NUMERIC, stock_level NUMERIC)`);
  await pool.query(`INSERT INTO products VALUES ('1001','Marble Floor Tile 60x60',4500,2999,120), ('1002','Glossy Basin',9000,5555,0)`);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.session = { user: role ? { role } : null }; next(); });
  // answer engine stand-in that behaves like LAYLA's: same intents/data shapes, answers from the test tables
  const answerFn = async (p, text) => {
    if (/net profit|sales/i.test(text)) return { intent: 'net_profit_day', reply: 'Sales LKR 415,865, Net Profit LKR 12,540' };
    if (/credit balance/i.test(text)) return { intent: 'credit_balance', reply: 'Kamal owes LKR 90,000' };
    const m = text.match(/\b(\d{4})\b/);
    if (m && /price|cost|stock|available|item/i.test(text)) {
      const r = await p.query('SELECT * FROM products WHERE item_code = $1', [m[1]]);
      if (!r.rows.length) return { intent: 'item_lookup', reply: `No item found with code ${m[1]}.` };
      const x = r.rows[0];
      return { intent: 'item_lookup', reply: `${x.item_code}: Price ${x.selling_price}, Cost ${x.avg_cost}`,
        data: { item_code: x.item_code, name: x.name, stock_level: Number(x.stock_level), selling_price: Number(x.selling_price), avg_cost: Number(x.avg_cost) } };
    }
    return null;
  };
  app.use('/api', realEngine ? createRouter(pool) : createRouter(pool, { answerFn }));
  app.__pool = pool;
  return app;
}
const draft = (app, text, extra = {}) => request(app).post('/api/agent-brain/draft').send({ channel: 'whatsapp', customer_ref: '0771234567', incoming_text: text, ...extra });

describe('M9 agent brain', () => {
  test('owner only', async () => {
    expect((await draft(await makeApp('staff'), 'hi')).status).toBe(403);
    expect((await request(await makeApp(null)).get('/api/agent-brain/reviews')).status).toBe(403);
  });

  test('item question: customer-safe reply, no cost, price "ask us", rules loaded, checks logged', async () => {
    const app = await makeApp();
    const r = await draft(app, 'Do you have item 1001 in stock?');
    expect(r.status).toBe(201);
    expect(r.body.draft.status).toBe('draft');
    expect(r.body.draft.draft_text).toBe('Marble Floor Tile 60x60 is available. For the price, please ask us and Aj will confirm.');
    expect(r.body.draft.draft_text).not.toMatch(/2999|cost/i);
    expect(r.body.check.passed).toBe(true);
    expect(r.body.check.checks.map(c => [c.id, c.pass])).toEqual([['no_internal_data', true], ['price_marked', true], ['halal', true], ['says_dont_know', true]]);
    expect(r.body.check.intent).toBe('item_lookup');
    // only the ACTIVE rules, with their versions
    expect(r.body.check.rules_used.map(x => `${x.topic}:v${x.version}`).sort()).toEqual(['prices:v2', 'tone:v1']);
    expect(r.body.check.reasoning).toMatch(/Loaded 2 active rule/);
    expect(r.body.check.reasoning).toMatch(/cost is left out/);
    // saved in the log table too
    expect(Number((await app.__pool.query('SELECT COUNT(*) AS n FROM agent_checks')).rows[0].n)).toBe(1);
  });

  test("with LAYLA's real answer engine: its owner-facing reply (which contains the cost) never reaches the customer", async () => {
    const app = await makeApp('owner', { realEngine: true });
    const engine = await require('../../scripts/layla_answer_engine').classifyAndAnswer(app.__pool, 'Do you have item 1001 in stock?');
    expect(engine.reply).toMatch(/Cost LKR 2,999/);                                   // the engine itself does reveal cost to the owner
    const r = await draft(app, 'Do you have item 1001 in stock?');
    expect(r.body.draft.draft_text).toBe('Marble Floor Tile 60x60 is available. For the price, please ask us and Aj will confirm.');
    expect(r.body.draft.draft_text).not.toMatch(/2,?999|cost/i);
    expect(r.body.check.passed).toBe(true);
    const profit = await draft(app, 'what was net profit yesterday');                 // real engine hits daily_summary: missing table => no data
    expect(profit.body.draft.draft_text).not.toMatch(/Net Profit LKR|\d{2,3},\d{3}/);
    expect(profit.body.check.passed).toBe(true);
  });

  test('out of stock is said plainly', async () => {
    const r = await draft(await makeApp(), 'is item 1002 available?');
    expect(r.body.draft.draft_text).toMatch(/Glossy Basin is out of stock/);
  });

  test('a price is only included when asked for, and then it is marked "needs Aj approval"', async () => {
    const r = await draft(await makeApp(), 'price of item 1001 please', { allow_price: true });
    expect(r.body.draft.draft_text).toMatch(/needs Aj approval/i);
    expect(r.body.draft.draft_text).toMatch(/LKR 4,500/);
    expect(r.body.draft.draft_text).not.toMatch(/2999/);
    expect(r.body.check.passed).toBe(true);
    expect(r.body.check.reasoning).toMatch(/marked "needs Aj approval"/);
    expect(r.body.customer_text).toBe('Marble Floor Tile 60x60 is available. Price: LKR 4,500.');   // what Aj copies: no internal mark
  });

  test('internal questions (profit, credit balances) are refused, never answered', async () => {
    const app = await makeApp();
    for (const q of ['what was net profit yesterday', 'credit balance of Kamal']) {
      const r = await draft(app, q);
      expect(r.body.draft.draft_text).toBe("I'm sorry, I can't share that. Aj will be happy to help you directly.");
      expect(r.body.draft.draft_text).not.toMatch(/415|12,540|90,000/);
      expect(r.body.check.passed).toBe(true);
      expect(r.body.check.reasoning).toMatch(/internal/i);
    }
  });

  test("unknown questions and missing items say \"I don't know\" instead of guessing", async () => {
    const app = await makeApp();
    const a = await draft(app, 'when will the new stock arrive?');
    expect(a.body.draft.draft_text).toMatch(/I don't know/);
    expect(a.body.check.checks.find(c => c.id === 'says_dont_know').detail).toMatch(/says so/);
    const b = await draft(app, 'price of item 9999');
    expect(b.body.draft.draft_text).toMatch(/I don't know/);
    expect(b.body.check.passed).toBe(true);
  });

  test('validation', async () => {
    const app = await makeApp();
    expect((await draft(app, '   ')).status).toBe(400);
    expect((await draft(app, 'hi', { channel: 'sms' })).status).toBe(400);
    expect((await draft(app, 'x'.repeat(2001))).status).toBe(400);
  });

  test('review list, approve (does not send), reject, and the lists by status', async () => {
    const app = await makeApp();
    const a = (await draft(app, 'item 1001 in stock?')).body.draft;
    const b = (await draft(app, 'what was net profit yesterday')).body.draft;
    const list = await request(app).get('/api/agent-brain/reviews');
    expect(list.body.map(d => d.id)).toEqual([b.id, a.id]);                         // newest first
    expect(list.body[0].check.checks).toHaveLength(4);

    const ok = await request(app).post(`/api/agent-brain/drafts/${a.id}/approve`);
    expect(ok.status).toBe(200);
    expect(ok.body.draft.status).toBe('approved');
    expect(ok.body.draft.approved_at).toBeTruthy();
    expect(ok.body.note).toMatch(/Nothing was sent/);
    expect((await request(app).post(`/api/agent-brain/drafts/${a.id}/approve`)).status).toBe(409);   // already approved

    expect((await request(app).post(`/api/agent-brain/drafts/${b.id}/reject`)).body.draft.status).toBe('rejected');
    expect((await request(app).get('/api/agent-brain/reviews?status=approved')).body.map(d => d.id)).toEqual([a.id]);
    expect((await request(app).get('/api/agent-brain/reviews?status=rejected')).body.map(d => d.id)).toEqual([b.id]);
    expect((await request(app).get('/api/agent-brain/reviews?status=draft')).body).toEqual([]);
    expect((await request(app).get('/api/agent-brain/reviews?status=bogus')).status).toBe(400);
    expect((await request(app).post('/api/agent-brain/drafts/999/approve')).status).toBe(404);
  });

  test('editing re-runs the checks: a draft that fails cannot be approved, a fixed one can', async () => {
    const app = await makeApp();
    const a = (await draft(app, 'item 1001 in stock?')).body.draft;

    const bad = await request(app).put(`/api/agent-brain/drafts/${a.id}`).send({ draft_text: 'Our cost price is 2999 and the margin is good. Pay with 5% interest.' });
    expect(bad.status).toBe(200);
    expect(bad.body.check.passed).toBe(false);
    expect(bad.body.check.kind).toBe('edited');
    expect(bad.body.check.checks.filter(c => !c.pass).map(c => c.id)).toEqual(['no_internal_data', 'halal']);
    const blocked = await request(app).post(`/api/agent-brain/drafts/${a.id}/approve`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toMatch(/checks failed/);

    const priced = await request(app).put(`/api/agent-brain/drafts/${a.id}`).send({ draft_text: 'The tile is Rs 4,500 per box.' });
    expect(priced.body.draft.draft_text).toMatch(/needs Aj approval/i);             // the mark is added for Aj
    expect(priced.body.check.passed).toBe(true);
    expect((await request(app).post(`/api/agent-brain/drafts/${a.id}/approve`)).status).toBe(200);

    const history = (await request(app).get(`/api/agent-brain/drafts/${a.id}/checks`)).body;
    expect(history.map(h => [h.kind, h.passed])).toEqual([['created', true], ['edited', false], ['edited', true]]);
    expect((await request(app).get('/api/agent-brain/drafts/999/checks')).status).toBe(404);
    expect((await request(app).put(`/api/agent-brain/drafts/${a.id}`).send({ draft_text: '  ' })).status).toBe(400);
  });

  test("an edit on an \"I don't know\" draft that starts guessing fails the check", async () => {
    const app = await makeApp();
    const a = (await draft(app, 'when will the new stock arrive?')).body.draft;
    const r = await request(app).put(`/api/agent-brain/drafts/${a.id}`).send({ draft_text: 'It will arrive in about 3 days.' });
    expect(r.body.check.passed).toBe(false);
    expect(r.body.check.checks.find(c => c.id === 'says_dont_know').pass).toBe(false);
  });

  test('it can never send: no network or messaging code in the module', () => {
    for (const src of [ROUTE_SRC, UTIL_SRC]) {
      expect(src).not.toMatch(/require\(['"](axios|node-fetch|whatsapp-web\.js|nodemailer|https?)['"]\)/);
      expect(src).not.toMatch(/\bfetch\(|\/send\b|sendMessage|WHATSAPP_API_URL|\.reply\(/);
    }
    // the only status it ever writes is draft / approved / rejected, never sent
    expect(ROUTE_SRC).not.toMatch(/status\s*=\s*'sent'/);
  });
});
