'use strict';
// The real server.js wiring: webhooks refuse remote callers and confine photo paths.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));
jest.mock('connect-pg-simple', () => (session) => session.MemoryStore);
jest.mock('../../layla', () => ({
  pool: { query: jest.fn().mockResolvedValue({ rows: [] }) },
  processMessage: jest.fn().mockResolvedValue({ message: 'hi', escalate: false }),
  alertOwner: jest.fn(),
  getOrCreateCustomer: jest.fn(),
}));

const request = require('supertest');
const path = require('path');
const app = require('../../server');

describe('server webhooks', () => {
  test('remote caller (via proxy header) cannot post a fake customer message', async () => {
    const r = await request(app).post('/webhook/whatsapp').set('X-Forwarded-For', '8.8.8.8').send({ from: '94771234567', message: 'YES' });
    expect(r.status).toBe(403);
  });

  test('remote caller cannot stage a photo or name a server file', async () => {
    const r = await request(app).post('/webhook/whatsapp-photo').set('X-Forwarded-For', '8.8.8.8').send({ from: '1', filePath: path.resolve('.env') });
    expect(r.status).toBe(403);
  });

  test('local bridge call still works', async () => {
    const r = await request(app).post('/webhook/whatsapp').send({ from: '94771234567', message: 'hello' });
    expect(r.status).toBe(200);
    expect(r.body.reply).toBe('hi');
  });

  test('local caller naming a file outside the inbox is refused', async () => {
    const r = await request(app).post('/webhook/whatsapp-photo').send({ from: '1', filePath: path.resolve('package.json') });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/inbox/i);
  });
});
