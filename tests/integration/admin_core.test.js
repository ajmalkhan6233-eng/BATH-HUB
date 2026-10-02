'use strict';
// Admin core (users + audit log) on its own, in-memory database: role gate, self-protection, last-admin protection, audit rows.
jest.mock('pg', () => require('../helpers/pgmock')());

const express = require('express');
const request = require('supertest');
const router = require('../../routes/admin_core');
const db = require('pg').__db;

function appAs(role, id) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.session = { user: { id, username: 'u' + id, role } }; next(); });
  app.use('/api/admin-core', router);
  return app;
}
const admin = appAs('admin', 1);
const q = sql => db.public.many(sql);

beforeAll(async () => {
  db.public.none(`CREATE TABLE users (id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, name TEXT, password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff', staff_id INT, active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW())`);
  db.public.none(`CREATE TABLE login_audit (id SERIAL PRIMARY KEY, username TEXT, success BOOLEAN, ip TEXT, reason TEXT, attempted_at TIMESTAMPTZ DEFAULT NOW())`);
  db.public.none(`INSERT INTO users (username,name,password_hash,role) VALUES ('u1','Boss','x','admin'),('u2','Staffer','x','staff')`);
  await new Promise(r => setTimeout(r, 500));          // the route creates admin_audit first
});

describe('admin core', () => {
  test('staff and the read-only owner role get 403, admin gets 200', async () => {
    for (const role of ['staff', 'owner']) {
      const a = appAs(role, 9);
      expect((await request(a).get('/api/admin-core/users')).status).toBe(403);
      expect((await request(a).post('/api/admin-core/users/2/disable')).status).toBe(403);
      expect((await request(a).get('/api/admin-core/audit')).status).toBe(403);
      expect((await request(a).get('/api/admin-core/audit/export.csv')).status).toBe(403);
    }
    const r = await request(admin).get('/api/admin-core/users');
    expect(r.status).toBe(200);
    expect(r.body.length).toBe(2);
    expect(r.body[0]).toHaveProperty('active_sessions');
  });

  test('add user needs a 12+ character password and never logs it', async () => {
    expect((await request(admin).post('/api/admin-core/users').send({ username: 'n1', name: 'N', role: 'staff', password: 'short' })).status).toBe(400);
    expect((await request(admin).post('/api/admin-core/users').send({ username: 'n1', name: 'N', role: 'customer', password: 'longenoughpass1' })).status).toBe(400);
    const ok = await request(admin).post('/api/admin-core/users').send({ username: 'n1', name: 'N', role: 'staff', password: 'longenoughpass1' });
    expect(ok.status).toBe(201);
    expect((await request(admin).post('/api/admin-core/users').send({ username: 'n1', name: 'N', role: 'staff', password: 'longenoughpass1' })).status).toBe(409);
    const rows = await q(`SELECT * FROM admin_audit WHERE action='user.create'`);
    expect(rows.length).toBe(1);
    expect(JSON.stringify(rows[0])).not.toMatch(/longenoughpass1/);
  });

  test('an admin cannot disable, demote or force-logout themselves', async () => {
    expect((await request(admin).post('/api/admin-core/users/1/disable')).status).toBe(400);
    expect((await request(admin).patch('/api/admin-core/users/1').send({ role: 'staff' })).status).toBe(400);
    expect((await request(admin).post('/api/admin-core/users/1/force-logout')).status).toBe(400);
    expect((await q(`SELECT active FROM users WHERE id=1`))[0].active).toBe(true);
  });

  test('the last active admin can never be disabled or demoted', async () => {
    const other = appAs('admin', 2);                         // a second admin session, acting on user 1
    expect((await request(other).post('/api/admin-core/users/1/disable')).status).toBe(400);
    expect((await request(other).patch('/api/admin-core/users/1').send({ role: 'staff' })).status).toBe(400);
    expect((await q(`SELECT role, active FROM users WHERE id=1`))[0]).toMatchObject({ role: 'admin', active: true });
  });

  test('disable and enable work, and each change writes an audit row', async () => {
    expect((await request(admin).post('/api/admin-core/users/2/disable')).status).toBe(200);
    expect((await q(`SELECT active FROM users WHERE id=2`))[0].active).toBe(false);
    expect((await request(admin).post('/api/admin-core/users/2/enable')).status).toBe(200);
    expect((await request(admin).patch('/api/admin-core/users/2').send({ name: 'Renamed' })).body.name).toBe('Renamed');
    const rp = await request(admin).post('/api/admin-core/users/2/reset-password').send({ password: 'brandnewpassword1' });
    expect(rp.status).toBe(200);
    expect((await request(admin).post('/api/admin-core/users/2/reset-password').send({ password: 'tiny' })).status).toBe(400);
    expect((await request(admin).post('/api/admin-core/users/2/force-logout')).status).toBe(200);
    const acts = (await q(`SELECT action, actor FROM admin_audit`)).map(r => r.action);
    for (const a of ['user.disable', 'user.enable', 'user.update', 'user.reset_password', 'user.force_logout']) expect(acts).toContain(a);
    expect(JSON.stringify(await q(`SELECT detail FROM admin_audit`))).not.toMatch(/brandnewpassword1/);
  });

  test('login history and audit list (newest first, filter, csv)', async () => {
    db.public.none(`INSERT INTO login_audit (username,success,ip,reason) VALUES ('u2',true,'1.1.1.1',NULL),('u2',false,'1.1.1.1','bad_credentials')`);
    const h = await request(admin).get('/api/admin-core/users/2/login-history');
    expect(h.status).toBe(200);
    expect(h.body.history.length).toBe(2);
    const a = await request(admin).get('/api/admin-core/audit?limit=2');
    expect(a.status).toBe(200);
    expect(a.body.rows.length).toBe(2);
    expect(a.body.rows[0].id).toBeGreaterThan(a.body.rows[1].id);
    const f = await request(admin).get('/api/admin-core/audit?action=user.disable');
    expect(f.body.rows.every(r => r.action === 'user.disable')).toBe(true);
    const csv = await request(admin).get('/api/admin-core/audit/export.csv');
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text).toMatch(/user\.disable/);
  });
});
