'use strict';
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));
jest.mock('../../layla', () => ({
  pool: { query: jest.fn().mockResolvedValue({ rows: [] }) },
  processMessage: jest.fn(), alertOwner: jest.fn(), getOrCreateCustomer: jest.fn(),
}));
jest.mock('connect-pg-simple', () => (session) => session.MemoryStore);
jest.mock('bcryptjs', () => ({ ...jest.requireActual('bcryptjs'), compare: jest.fn().mockResolvedValue(true) }));

const request = require('supertest');
const app = require('../../server');
const { pool } = require('../../layla');
const bcrypt = require('bcryptjs');

const userRow = { id: 1, username: 'ajmal', name: 'Aj', role: 'admin', staff_id: null, password_hash: 'x' };
async function newDevice(ip) {
  const agent = request.agent(app);
  pool.query.mockResolvedValueOnce({ rows: [userRow] });
  const r = await agent.post('/api/login').set('X-Forwarded-For', ip || '192.168.1.50').send({ username: 'ajmal', password: 'pw' });
  expect(r.status).toBe(200);
  return agent;
}
beforeEach(() => { pool.query.mockReset(); pool.query.mockResolvedValue({ rows: [] }); bcrypt.compare.mockResolvedValue(true); });

describe('several logins at once', () => {
  test('two devices (phone and laptop) are both logged in at the same time', async () => {
    const laptop = await newDevice('192.168.1.88'), phone = await newDevice('192.168.1.204');
    expect((await laptop.get('/api/me')).status).toBe(200);
    expect((await phone.get('/api/me')).status).toBe(200);
  });
  test('logging out on one device leaves the other logged in', async () => {
    const a = await newDevice(), b = await newDevice();
    expect((await a.post('/api/logout')).status).toBe(200);
    expect((await a.get('/api/me')).status).toBe(401);
    expect((await b.get('/api/me')).status).toBe(200);
  });
  test('a wrong password still fails', async () => {
    bcrypt.compare.mockResolvedValueOnce(false);
    pool.query.mockResolvedValueOnce({ rows: [userRow] });
    const r = await request(app).post('/api/login').set('X-Forwarded-For', '192.168.1.60').send({ username: 'ajmal', password: 'wrong' });
    expect(r.status).toBe(401);
  });
  test('every successful login asks the store to keep only the newest 5 sessions of that user', async () => {
    await newDevice();
    const trim = pool.query.mock.calls.find(c => String(c[0]).toLowerCase().includes('from session'));
    expect(trim).toBeTruthy();
    expect(trim[1][0]).toBe('1');
    expect(trim[1][2]).toBe(4);
  });
});

describe('session cookie', () => {
  test('plain http (home network): not marked Secure, so Safari keeps it', async () => {
    pool.query.mockResolvedValueOnce({ rows: [userRow] });
    const r = await request(app).post('/api/login').set('X-Forwarded-For', '192.168.1.204').send({ username: 'ajmal', password: 'pw' });
    const c = String(r.headers['set-cookie']);
    expect(c).toMatch(/connect\.sid=/);
    expect(c).not.toMatch(/;\s*Secure/i);
    expect(c).toMatch(/HttpOnly/i);
  });
  test('behind https (tunnel): marked Secure', async () => {
    pool.query.mockResolvedValueOnce({ rows: [userRow] });
    const r = await request(app).post('/api/login').set('X-Forwarded-Proto', 'https').set('X-Forwarded-For', '203.0.113.7').send({ username: 'ajmal', password: 'pw' });
    expect(String(r.headers['set-cookie'])).toMatch(/;\s*Secure/i);
  });
});

describe('flood guard', () => {
  test('a phone on the shop Wi-Fi is never locked out by loading the app', async () => {
    let last = 0; for (let i = 0; i < 350; i++) last = (await request(app).get('/api/me').set('X-Forwarded-For', '192.168.1.204')).status;
    expect(last).not.toBe(429);
    const login = await newDevice('192.168.1.204');
    expect((await login.get('/api/me')).status).toBe(200);
  }, 60000);
  test('files (scripts, styles) are not counted for a public address', async () => {
    let last = 0; for (let i = 0; i < 350; i++) last = (await request(app).get('/bathhub-design.css').set('X-Forwarded-For', '203.0.113.20')).status;
    expect(last).toBe(200);
  }, 60000);
  test('a public address is still limited per API call', async () => {
    let got429 = false; for (let i = 0; i < 310; i++) { const s = (await request(app).get('/api/me').set('X-Forwarded-For', '203.0.113.30')).status; if (s === 429) { got429 = true; break; } }
    expect(got429).toBe(true);
  }, 60000);
});