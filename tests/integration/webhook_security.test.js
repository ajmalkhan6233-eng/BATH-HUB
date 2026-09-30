'use strict';
// Webhook guard: remote callers are refused, the local bridge still works, photo paths are confined.
const express = require('express');
const request = require('supertest');
const path = require('path');
const { webhookAuth, safeInboxPath } = require('../../middleware/webhookAuth');

function makeApp() {
  const app = express();
  app.set('trust proxy', 1);            // same as server.js
  app.post('/webhook/x', webhookAuth, (req, res) => res.json({ ok: true }));
  return app;
}

describe('webhookAuth', () => {
  afterEach(() => { delete process.env.WEBHOOK_SECRET; });

  test('no secret set: direct local caller is accepted', async () => {
    await request(makeApp()).post('/webhook/x').expect(200);
  });

  test('no secret set: tunnelled/proxied caller (X-Forwarded-For) is refused', async () => {
    await request(makeApp()).post('/webhook/x').set('X-Forwarded-For', '8.8.8.8').expect(403);
  });

  test('secret set: missing or wrong secret refused, right secret accepted (even via proxy)', async () => {
    process.env.WEBHOOK_SECRET = 'test-secret-not-real';
    const app = makeApp();
    await request(app).post('/webhook/x').expect(403);
    await request(app).post('/webhook/x').set('x-webhook-secret', 'wrong').expect(403);
    await request(app).post('/webhook/x').set('x-webhook-secret', 'test-secret-not-real').set('X-Forwarded-For', '8.8.8.8').expect(200);
  });
});

describe('safeInboxPath', () => {
  const root = path.resolve('data', 'drop', 'inbox');
  test('accepts an image inside the inbox', () => {
    expect(safeInboxPath(path.join(root, '2026-10-01', '1-whatsapp-94777.jpg'), root)).toBeTruthy();
    expect(safeInboxPath(path.join(root, 'a.PNG'), root)).toBeTruthy();
  });
  test('rejects anything outside the inbox, traversal, non-images and junk', () => {
    expect(safeInboxPath(path.resolve('.env'), root)).toBeNull();
    expect(safeInboxPath(path.join(root, '..', '..', '..', '.env'), root)).toBeNull();
    expect(safeInboxPath(path.join(root, '..', 'inbox-evil', 'a.jpg'), root)).toBeNull();
    expect(safeInboxPath(path.join(root, 'notes.txt'), root)).toBeNull();
    expect(safeInboxPath('', root)).toBeNull();
    expect(safeInboxPath(null, root)).toBeNull();
    expect(safeInboxPath({ a: 1 }, root)).toBeNull();
    expect(safeInboxPath(path.join(root, 'a.jpg\0.txt'), root)).toBeNull();
  });
});
