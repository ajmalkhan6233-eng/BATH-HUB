'use strict';
// LAYLA v2 on the real Postgres-style stores (pg-mem) and through the optional webhook route:
// off by default, signed requests only, owner commands work, customers cannot reach the books, nothing real is sent.
jest.mock('pg', () => require('../helpers/pgmock')());
const express = require('express');
const crypto = require('crypto');
const request = require('supertest');
const pg = require('pg');
const db = pg.__db.public;
const L = require('../../layla_v2');
const { createRouter } = require('../../layla_v2/route');

db.none(`CREATE TABLE products (id SERIAL PRIMARY KEY, item_code TEXT, name TEXT, category TEXT, stock_level NUMERIC DEFAULT 0, reorder_threshold NUMERIC DEFAULT 0, selling_price NUMERIC DEFAULT 0, avg_cost NUMERIC DEFAULT 0, photo_url TEXT, active BOOLEAN DEFAULT true)`);
db.none(`CREATE TABLE site_tiles (id SERIAL PRIMARY KEY, name VARCHAR(80), size VARCHAR(40), finish VARCHAR(12), grp VARCHAR(8), photo_file VARCHAR(60), visible BOOLEAN DEFAULT TRUE)`);
db.none(`CREATE TABLE site_text (key VARCHAR(40) PRIMARY KEY, value TEXT)`);
db.none(`CREATE TABLE discount_rules (id SERIAL PRIMARY KEY, role VARCHAR(30), max_discount_pct NUMERIC, notes TEXT, active BOOLEAN DEFAULT true)`);
db.none(`INSERT INTO products (item_code, name, category, stock_level, selling_price, avg_cost, active) VALUES ('001','Marble White 24 x 24 in','tiles',40,1850,1200,true)`);
db.none(`INSERT INTO site_text VALUES ('address','12 Galle Road, Colombo')`);
db.none(`INSERT INTO discount_rules (role, max_discount_pct) VALUES ('all', 5)`);

const SECRET = 'test-app-secret';
const OWNER = '94770000001', CUST = '94771111111';
const body = (from, text, id) => ({ entry: [{ changes: [{ value: { contacts: [{ wa_id: from, profile: { name: 'Nimal Perera' } }], messages: [{ from, id, type: 'text', text: { body: text } }] } }] }] });
const sign = raw => 'sha256=' + crypto.createHmac('sha256', SECRET).update(raw).digest('hex');

let deps, transport, store;
function build(envExtra = {}) {
    const env = { NODE_ENV: 'test', LAYLA_V2_ENABLED: 'true', WHATSAPP_APP_SECRET: SECRET, LAYLA_V2_VERIFY_TOKEN: 'vt', ...envExtra };
    transport = L.createSimulatorTransport();
    deps = L.createDeps({ pool: new pg.Pool(), env, answerEngine: async t => (/profit/i.test(t) ? { reply: 'SECRET net profit 1,000,000' } : null), documents: L.createSimulatedDocuments() });
    deps.transport = transport; deps.delay = false; deps.rng = () => 0;
    store = deps.store;
    const router = createRouter(deps, { env });
    const app = express(); app.use('/layla-v2', router);
    return { app, router };
}
beforeEach(async () => {   // pg-mem keeps one database for the file: start every test with empty LAYLA tables
    const s = L.createDeps({ pool: new pg.Pool(), env: {} }).store;
    await s.ensureSchema();
    for (const t of ['layla_messages', 'layla_customers', 'layla_state', 'layla_tasks', 'layla_contacts']) db.none('DELETE FROM ' + t);
});
const post = (app, payload, { badSig = false, noSig = false } = {}) => {
    const raw = JSON.stringify(payload);
    const r = request(app).post('/layla-v2/webhook').set('Content-Type', 'application/json');
    if (!noSig) r.set('X-Hub-Signature-256', badSig ? 'sha256=deadbeef' : sign(raw));
    return r.send(raw);
};

test('off by default: everything is 404 and nothing is created', async () => {
    const app = express(); app.use('/layla-v2', createRouter({}, { env: {} }));
    expect((await request(app).post('/layla-v2/webhook').send({})).status).toBe(404);
    expect((await request(app).get('/layla-v2/webhook')).status).toBe(404);
    const app2 = express(); app2.use('/layla-v2', createRouter({}, { env: { LAYLA_V2_ENABLED: 'false' } }));
    expect((await request(app2).post('/layla-v2/webhook').send({})).status).toBe(404);
});

test('enabled but no app secret: 503, so an unsigned body can never pose as the owner', async () => {
    const { app } = build({ WHATSAPP_APP_SECRET: '' });
    expect((await post(build().app, body(CUST, 'hi', 'x'), { noSig: true })).status).toBe(401);
    const r = await request(app).post('/layla-v2/webhook').send(body(CUST, 'hi', 'x'));
    expect(r.status).toBe(503);
});

test('bad or missing signature is rejected and nothing is handled', async () => {
    const { app, router } = build();
    expect((await post(app, body(CUST, 'hello', 'm1'), { badSig: true })).status).toBe(401);
    expect((await post(app, body(CUST, 'hello', 'm1'), { noSig: true })).status).toBe(401);
    await router.idle();
    expect(transport.outbox).toHaveLength(0);
});

test('Meta verification handshake needs the right token', async () => {
    const { app } = build();
    const ok = await request(app).get('/layla-v2/webhook').query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'vt', 'hub.challenge': '12345' });
    expect(ok.status).toBe(200); expect(ok.text).toBe('12345');
    expect((await request(app).get('/layla-v2/webhook').query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'nope', 'hub.challenge': '1' })).status).toBe(403);
});

test('a signed customer message is answered from the database through the simulator, with the profile name', async () => {
    const { app, router } = build();
    const r = await post(app, body(CUST, 'what is the price of marble white tile?', 'm2'));
    expect(r.status).toBe(200);
    await router.idle();
    const out = transport.textsTo(CUST).join(' ');
    expect(out).toContain('Rs 1,850');
    expect(out).not.toMatch(/1,?200/);
    expect((await store.getCustomer(CUST)).lang).toBe('en');
});

test('the same message id is not handled twice (Meta retries)', async () => {
    const { app, router } = build();
    await post(app, body(CUST, 'hello', 'dup1')); await router.idle();
    const n = transport.textsTo(CUST).length;
    await post(app, body(CUST, 'hello', 'dup1')); await router.idle();
    expect(transport.textsTo(CUST).length).toBe(n);
});

test('owner (in layla_contacts) gets finance and can pause; the same words from a customer get nothing', async () => {
    const { app, router } = build();
    await store.addContact({ phone: OWNER, role: 'owner', name: 'Aj' });
    await post(app, body(OWNER, 'net profit yesterday', 'o1')); await router.idle();
    expect(transport.textsTo(OWNER).join(' ')).toContain('SECRET net profit');
    await post(app, body(CUST, 'net profit yesterday', 'c1')); await router.idle();
    expect(transport.textsTo(CUST).join(' ')).not.toContain('SECRET');
    await post(app, body(OWNER, 'pause LAYLA', 'o2')); await router.idle();
    transport.reset();
    await post(app, body(CUST, 'hello', 'c2')); await router.idle();
    expect(transport.textsTo(CUST)).toEqual([]);
    expect(await store.getState('paused')).toBe('true');
});

test('complaint creates a task in layla_tasks and alerts the owner through the transport (never real)', async () => {
    const { app, router } = build();
    await store.addContact({ phone: OWNER, role: 'owner' });
    await post(app, body(CUST, 'the tiles were broken when delivered', 'c3')); await router.idle();
    const tasks = await store.listOpenTasks();
    expect(tasks[0]).toMatchObject({ kind: 'complaint', phone: CUST });
    expect(transport.textsTo(OWNER).join(' ')).toMatch(/LAYLA: complaint/);
});

test('kill switch LAYLA_V2_DISABLED=true: signed messages are accepted (200) but ignored', async () => {
    const { app, router } = build({ LAYLA_V2_DISABLED: 'true' });
    expect((await post(app, body(CUST, 'hello', 'k1'))).status).toBe(200);
    await router.idle();
    expect(transport.outbox).toHaveLength(0);
});

test('createDeps: transport is a dry run unless WHATSAPP_LIVE=true and the keys exist', () => {
    const pool = new pg.Pool();
    expect(L.createDeps({ pool, env: {} }).transport.name).toBe('dry-run');
    expect(L.createDeps({ pool, env: { WHATSAPP_LIVE: 'true' } }).transport.name).toBe('dry-run');
    expect(L.createDeps({ pool, env: { WHATSAPP_LIVE: 'true', WHATSAPP_API_TOKEN: 'a', WHATSAPP_PHONE_NUMBER_ID: 'b' } }).transport.name).toBe('cloud-api');
    expect(() => L.createDeps({})).toThrow();
});