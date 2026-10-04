'use strict';
// Unit test for routes/cheque_register.js — the pool is fully mocked (same
// pattern as tests/integration/daily-summary.test.js), so this never opens
// a real database connection. Mounts ONLY this router in a standalone
// Express app, not the full server.js, so it's independent of server.js
// actually having this route mounted (it deliberately isn't yet — see the
// header comment in routes/cheque_register.js for why).
jest.mock('../../layla', () => ({
  // query needs a resolved-by-default implementation from the very start —
  // the route module calls pool.query(...) at require() time (the
  // migration), before any beforeEach() has a chance to run.
  pool: { query: jest.fn().mockResolvedValue({ rows: [] }), connect: jest.fn() },
}));

const express = require('express');
const request = require('supertest');
const { pool } = require('../../layla');
const router = require('../../routes/cheque_register');

function makeApp() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.use('/', router);
  return app;
}

function makeClient(queryImpl) {
  return {
    query: queryImpl || jest.fn().mockResolvedValue({ rows: [] }),
    release: jest.fn(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [] }); // migration's own top-level pool.query() call
});

describe('GET /api/cheque-register', () => {
  test('maps DB columns to the client\'s own field names', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{
        id: 'chq-1', no: '123456', bank: 'NDB Bank', payee: 'Eskema Ceramic', amount: '390000',
        cheque_date: '2026-07-20', due_date: '2026-07-21', status: 'Pending', notes: '', photo: null,
        updated_at: '2026-07-26T00:00:00Z',
      }],
    });
    const res = await request(makeApp()).get('/api/cheque-register');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{
      id: 'chq-1', no: '123456', bank: 'NDB Bank', payee: 'Eskema Ceramic', amount: 390000,
      chqDate: '2026-07-20', due: '2026-07-21', status: 'Pending', notes: '', photo: null,
    }]);
  });

  test('DB error is a visible 500, not a silent empty list', async () => {
    pool.query.mockRejectedValueOnce(new Error('connection refused'));
    const res = await request(makeApp()).get('/api/cheque-register');
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/connection refused/);
  });
});

describe('POST /api/cheque-register', () => {
  test('rejects a non-array body with a clear 400, not a crash', async () => {
    const res = await request(makeApp()).post('/api/cheque-register').send({ cheques: 'not an array' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/array/);
  });

  test('valid rows are saved inside one transaction (BEGIN...COMMIT), count confirmed back', async () => {
    const calls = [];
    const client = makeClient(jest.fn(async (sql, params) => {
      calls.push({ sql: String(sql).trim().split('\n')[0].trim(), params });
      if (/^SELECT COUNT/.test(sql)) return { rows: [{ n: 2 }] };
      return { rows: [] };
    }));
    pool.connect = jest.fn().mockResolvedValue(client);

    const res = await request(makeApp()).post('/api/cheque-register').send({
      cheques: [
        { id: 'chq-1', no: '123456', bank: 'NDB Bank', payee: 'Eskema Ceramic', amount: 390000, chqDate: '2026-07-20', due: '2026-07-21', status: 'Pending', notes: '', photo: null },
        { id: 'chq-2', no: '789', bank: 'HNB', payee: 'Someone', amount: 5000, chqDate: '2026-07-22', due: '', status: 'Pending', notes: '', photo: null },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, received: 2, saved: 2, skipped: 0, count: 2 });
    expect(calls[0].sql).toBe('BEGIN');
    expect(calls[1].sql).toBe('DELETE FROM cheque_register');
    expect(calls.filter((c) => c.sql.startsWith('INSERT INTO cheque_register')).length).toBe(2);
    expect(calls[calls.length - 1].sql).toBe('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  test('a row with no usable id is skipped and REPORTED, never silently dropped', async () => {
    const client = makeClient(jest.fn(async (sql) => {
      if (/^SELECT COUNT/.test(sql)) return { rows: [{ n: 1 }] };
      return { rows: [] };
    }));
    pool.connect = jest.fn().mockResolvedValue(client);

    const res = await request(makeApp()).post('/api/cheque-register').send({
      cheques: [
        { id: 'chq-1', no: '1', bank: 'NDB Bank', payee: 'A', amount: 100, chqDate: '', due: '', status: 'Pending', notes: '', photo: null },
        { no: '2', bank: 'HNB', payee: 'B', amount: 200 }, // no id — must be skipped, not crash, not silently vanish
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(2);
    expect(res.body.saved).toBe(1);
    expect(res.body.skipped).toBe(1);
    expect(res.body.skippedIndexes).toEqual([1]);
  });

  test('a DB failure mid-save rolls back — never a partial write — and is a visible error', async () => {
    const calls = [];
    const client = makeClient(jest.fn(async (sql) => {
      calls.push(String(sql).trim().split('\n')[0].trim());
      if (sql.startsWith('INSERT')) throw new Error('disk full');
      return { rows: [] };
    }));
    pool.connect = jest.fn().mockResolvedValue(client);

    const res = await request(makeApp()).post('/api/cheque-register').send({
      cheques: [{ id: 'chq-1', no: '1', bank: 'NDB Bank', payee: 'A', amount: 100, chqDate: '', due: '', status: 'Pending', notes: '', photo: null }],
    });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/disk full/);
    expect(calls).toContain('ROLLBACK');
    expect(calls).not.toContain('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  test('photo data survives round-trip through the insert params untouched', async () => {
    const inserted = [];
    const client = makeClient(jest.fn(async (sql, params) => {
      if (sql.startsWith('INSERT')) inserted.push(params);
      if (/^SELECT COUNT/.test(sql)) return { rows: [{ n: 1 }] };
      return { rows: [] };
    }));
    pool.connect = jest.fn().mockResolvedValue(client);

    const fakePhoto = 'data:image/jpeg;base64,' + 'A'.repeat(200);
    await request(makeApp()).post('/api/cheque-register').send({
      cheques: [{ id: 'chq-1', no: '1', bank: 'NDB Bank', payee: 'A', amount: 100, chqDate: '', due: '', status: 'Pending', notes: '', photo: fakePhoto }],
    });

    expect(inserted[0][9]).toBe(fakePhoto); // photo is the 10th positional param ($10)
  });
});

describe('toDateOrNull', () => {
  const { toDateOrNull } = require('../../routes/cheque_register')._internal;
  test('accepts YYYY-MM-DD', () => { expect(toDateOrNull('2026-07-26')).toBe('2026-07-26'); });
  test('rejects empty string, garbage, and non-strings', () => {
    expect(toDateOrNull('')).toBeNull();
    expect(toDateOrNull('not a date')).toBeNull();
    expect(toDateOrNull(undefined)).toBeNull();
    expect(toDateOrNull(12345)).toBeNull();
  });
});
