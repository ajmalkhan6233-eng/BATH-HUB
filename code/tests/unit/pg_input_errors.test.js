'use strict';
const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');
const pgInputErrors = require('../../utils/pgInputErrors');

const app = express();
app.use(express.json());
app.use(pgInputErrors);
const fail = (msg, status = 500) => (req, res) => res.status(status).json({ error: msg });
app.get('/bad-int', fail('invalid input syntax for type integer: "abc"'));
app.get('/big-int', fail('value "100000000000000000000" is out of range for type integer'));
app.get('/bad-date', fail('invalid input syntax for type date: "x"'));
app.get('/feb30', fail('date/time field value out of range: "2026-02-30"'));
app.get('/overflow', fail('numeric field overflow'));
app.get('/notnull', fail('null value in column "report_date" of relation "daily_summary" violates not-null constraint'));
app.get('/toolong', fail('value too long for type character varying(150)'));
app.get('/enum', fail('invalid input value for enum status: "zzz"'));
app.get('/missing-col', fail('column "updated_at" of relation "cheques" does not exist'));
app.get('/missing-table', fail('relation "leads" does not exist'));
app.get('/conn', fail('connect ECONNREFUSED 127.0.0.1:5432'));
app.get('/own-400', fail('Enter the supplier', 400));
app.get('/ok', (req, res) => res.json({ ok: true }));
app.get('/extra', (req, res) => res.status(500).json({ error: 'numeric field overflow', keep: 1 }));
app.get('/text', (req, res) => res.status(500).send('invalid input syntax for type integer: "x"'));

describe('Postgres input errors become a 400 with a plain message', () => {
  test.each([
    ['/bad-int', /number or id/], ['/big-int', /number or id/], ['/bad-date', /date in the request/], ['/feb30', /date in the request/],
    ['/overflow', /amount in the request/], ['/notnull', /report date is required/], ['/toolong', /too long/], ['/enum', /not valid/],
  ])('%s', async (url, msg) => {
    const r = await request(app).get(url);
    expect(r.status).toBe(400); expect(r.body.error).toMatch(msg);
    expect(r.body.error).not.toMatch(/invalid input syntax|relation|constraint|character varying|"abc"/);
  });
  test('real server faults stay 500 with their message (missing column or table, connection)', async () => {
    for (const u of ['/missing-col', '/missing-table', '/conn']) { const r = await request(app).get(u); expect(r.status).toBe(500); }
  });
  test('other statuses, successes and extra body keys are untouched', async () => {
    expect((await request(app).get('/own-400')).body.error).toBe('Enter the supplier');
    expect((await request(app).get('/ok')).body).toEqual({ ok: true });
    const r = await request(app).get('/extra'); expect(r.status).toBe(400); expect(r.body.keep).toBe(1);
  });
  test('only res.json is rewritten (plain text 500s are left alone)', async () => {
    expect((await request(app).get('/text')).status).toBe(500);
  });
  test('server.js mounts it before every route file', () => {
    const s = fs.readFileSync(path.join(__dirname, '..', '..', 'server.js'), 'utf8');
    const at = s.indexOf("require('./utils/pgInputErrors')"), first = s.indexOf("require('./routes/");
    expect(at).toBeGreaterThan(0); expect(at).toBeLessThan(first);
    expect(at).toBeGreaterThan(s.indexOf('app.use(bodyParser.urlencoded'));
  });
});
