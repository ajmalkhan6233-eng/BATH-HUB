'use strict';
// Daily ledger sync (ported from BATHCO). Uses a fake date far in the future, never today's real date.
jest.mock('pg', () => require('../helpers/pgmock')());

const express = require('express');
const request = require('supertest');
process.env.DAILY_BACKUP_DIR = require('os').tmpdir() + '/bathhub-test-daily';   // never write into the real backups folder
const router = require('../../routes/daily_entry_sync');
const app = express();
app.use(express.json());
app.use('/', router);

const D = '2099-01-01';

beforeAll(async () => { await new Promise(r => setTimeout(r, 50)); });   // let the start-up CREATE TABLE finish

test('rejects a missing or impossible date', async () => {
  expect((await request(app).post('/api/daily-entry/sync').send({})).status).toBe(400);
  expect((await request(app).post('/api/daily-entry/sync').send({ date: '2099-02-30' })).status).toBe(400);
});

test('save then read back, meta shows the writing device', async () => {
  const body = { date: D, rows: [{ inv: 1 }], totals: { cash_in_hand: 100 }, device_id: 'dev-A', staff_salary_total: 500 };
  const save = await request(app).post('/api/daily-entry/sync').send(body);
  expect(save.status).toBe(200);
  const got = await request(app).get('/api/daily-entry/sync/' + D);
  expect(got.status).toBe(200);
  expect(got.body.totals.cash_in_hand).toBe(100);
  expect(got.body.updated_by).toBe('dev-A');
  const meta = await request(app).get('/api/daily-entry/meta/' + D);
  expect(meta.body.updated_by).toBe('dev-A');
});

test('unknown day is 404 and meta is empty', async () => {
  expect((await request(app).get('/api/daily-entry/sync/2099-01-02')).status).toBe(404);
  expect((await request(app).get('/api/daily-entry/meta/2099-01-02')).body.updated_at).toBeNull();
});

test('range: bad input is 400, a saved day comes back, an unsaved day is absent (never invented)', async () => {
  expect((await request(app).get('/api/daily-entry/range?from=2099-01-05&to=2099-01-01')).status).toBe(400);
  expect((await request(app).get('/api/daily-entry/range?from=2099-01-01&to=2101-01-01')).status).toBe(400);
  const r = await request(app).get('/api/daily-entry/range?from=2099-01-01&to=2099-01-03');
  expect(r.status).toBe(200);
  expect(r.body.days.map(d => d.date)).toEqual([D]);
  expect(r.body.days[0].staff_salary_total).toBe(500);
});
