'use strict';
// Platform admin: the gate still holds, and a logged client payment must be a positive amount on a real date.
jest.mock('pg', () => require('../helpers/pgmock')());
jest.mock('../../middleware/auditLogMiddleware', () => ({ logAdminAction: jest.fn().mockResolvedValue() }));
jest.mock('../../utils/trialClientCreator', () => ({ createTrialClient: jest.fn() }));
jest.mock('../../utils/railwayControl', () => ({ performAction: jest.fn(), pingHealth: jest.fn(), controlEnabled: () => false }));

const express = require('express');
const request = require('supertest');
const pg = require('pg');

pg.__db.public.none(`CREATE TABLE client_payments (id SERIAL PRIMARY KEY, tenant_id INT, amount_lkr NUMERIC, bank_reference TEXT UNIQUE, deposit_date DATE, verified_by_admin_id INT, notes TEXT)`);
const router = require('../../routes/apex_admin');

function appAs(session) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.session = session; next(); });
  app.use('/', router);
  return app;
}
const admin = { user: { id: 1, role: 'admin' }, adminUnlocked: true };
const pay = (app, b) => request(app).post('/api/apex/payments').send({ tenant_id: 1, amount_lkr: 25000, bank_reference: 'REF-' + Math.random(), deposit_date: '2026-10-01', ...b });

describe('platform admin payments', () => {
  test('the double gate: no login, non-admin, or PIN not entered are all refused', async () => {
    expect((await pay(appAs({}))).status).toBe(401);
    expect((await pay(appAs({ user: { role: 'owner' }, adminUnlocked: true }))).status).toBe(403);
    expect((await pay(appAs({ user: { role: 'admin' } }))).status).toBe(403);
  });

  test('a valid payment is logged', async () => {
    expect((await pay(appAs(admin))).status).toBe(200);
  });

  test('negative, zero or text amounts and bad dates are refused', async () => {
    const app = appAs(admin);
    expect((await pay(app, { amount_lkr: -25000 })).status).toBe(400);
    expect((await pay(app, { amount_lkr: 'lots' })).status).toBe(400);
    expect((await pay(app, { amount_lkr: '0' })).status).toBe(400);
    expect((await pay(app, { deposit_date: 'last friday' })).status).toBe(400);
    expect(Number(pg.__db.public.many('SELECT COUNT(*) AS n FROM client_payments')[0].n)).toBe(1);
  });
});
