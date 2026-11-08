'use strict';
// Settings + menu control on their own (in-memory database): validation, admin only, public subset, menu rules, audit.
jest.mock('pg', () => require('../helpers/pgmock')());

const express = require('express');
const request = require('supertest');
const router = require('../../routes/app_settings');
const S = require('../../utils/appSettings');
const { Pool } = require('pg');

function appAs(role) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.session = { user: { username: 'tester', role } }; next(); });
  app.use('/api', router);
  return app;
}
const admin = appAs('admin'), staff = appAs('staff'), owner = appAs('owner');
const pool = new Pool();

beforeAll(() => new Promise(r => setTimeout(r, 500)));

describe('app settings', () => {
  test('admin sees every key with defaults', async () => {
    const r = await request(admin).get('/api/app-settings');
    expect(r.status).toBe(200);
    expect(r.body.settings.dashboard_sales_target).toBe(100000);
    expect(r.body.settings.whatsapp_draft_only).toBe(true);
    expect(Object.keys(r.body.defaults)).toEqual(expect.arrayContaining(['shop_name', 'tagline', 'shop_phone', 'shop_address', 'opening_hours', 'brand_primary', 'brand_accent']));
  });
  test('staff and owner get 403 on read, save, audit, menu save and reset', async () => {
    for (const a of [staff, owner]) {
      expect((await request(a).get('/api/app-settings')).status).toBe(403);
      expect((await request(a).put('/api/app-settings').send({ shop_name: 'X' })).status).toBe(403);
      expect((await request(a).post('/api/app-settings/flag-audit').send({ key: 'k', enabled: true })).status).toBe(403);
      expect((await request(a).put('/api/menu-config').send([{ item_key: 'stock', label: 'Stock', visible: false, sort_order: 1 }])).status).toBe(403);
      expect((await request(a).post('/api/menu-config/reset')).status).toBe(403);
    }
  });
  test('bad values and unknown keys are refused and nothing is saved', async () => {
    const bad = [{ nope: 1 }, { shop_name: '' }, { shop_name: 'x'.repeat(101) }, { brand_primary: 'red' }, { brand_accent: '#12345' },
      { dashboard_sales_target: -1 }, { dashboard_sales_target: '100' }, { whatsapp_draft_only: 'yes' }, { shop_phone: 5 }];
    for (const b of bad) expect((await request(admin).put('/api/app-settings').send(b)).status).toBe(400);
    expect((await request(admin).put('/api/app-settings').send([])).status).toBe(400);
    const mixed = await request(admin).put('/api/app-settings').send({ shop_name: 'Good', brand_primary: 'nope' });
    expect(mixed.status).toBe(400);
    expect((await request(admin).get('/api/app-settings')).body.settings.shop_name).toBe('Royal Bath Hub');
  });
  test('admin saves; public subset shows only the safe keys to any user', async () => {
    const put = await request(admin).put('/api/app-settings').send({ shop_name: 'Royal Bath Hub Test', brand_primary: '#112233', dashboard_sales_target: 150000, shop_phone: '0300', whatsapp_draft_only: false });
    expect(put.status).toBe(200);
    expect(put.body.changed).toEqual(expect.arrayContaining(['shop_name', 'dashboard_sales_target']));
    const pub = await request(staff).get('/api/app-settings/public');
    expect(pub.status).toBe(200);
    expect(pub.body).toEqual({ shop_name: 'Royal Bath Hub Test', tagline: '', brand_primary: '#112233', brand_accent: '#1F2937', opening_hours: '', dashboard_sales_target: 150000 });
    expect(pub.body.shop_phone).toBeUndefined();
    expect(pub.body.whatsapp_draft_only).toBeUndefined();
  });
  test('getBool: DB value wins, else env, else default', async () => {
    S.clearCache();
    process.env.TEST_FLAG_X = 'true';
    expect(await S.getBool(pool, 'whatsapp_draft_only', 'TEST_FLAG_X', true)).toBe(false);          // DB (false) beats env (true)
    expect(await S.getBool(pool, 'not_saved_key', 'TEST_FLAG_X', false)).toBe(true);                // env beats default
    expect(await S.getBool(pool, 'not_saved_key', 'TEST_FLAG_UNSET', true)).toBe(true);             // default
    expect(await S.getSetting(pool, 'shop_name', 'fallback')).toBe('Royal Bath Hub Test');
    expect(await S.getSetting(pool, 'zzz', 'fallback')).toBe('fallback');
    delete process.env.TEST_FLAG_X;
  });
  test('changes and flag toggles are written to the audit trail', async () => {
    expect((await request(admin).post('/api/app-settings/flag-audit').send({ key: 'some_flag', enabled: false })).status).toBe(200);
    expect((await request(admin).post('/api/app-settings/flag-audit').send({ key: 'some_flag', enabled: 'no' })).status).toBe(400);
    const r = await pool.query(`SELECT action, target_id, actor FROM admin_audit ORDER BY id`);
    const actions = r.rows.map(x => x.action);
    expect(actions).toContain('settings.update');
    expect(actions).toContain('feature_flag.toggle');
    expect(r.rows.find(x => x.action === 'feature_flag.toggle').target_id).toBe('some_flag');
  });
});

describe('menu control', () => {
  const row = (k, v, o) => ({ item_key: k, label: k.toUpperCase(), visible: v, sort_order: o });
  test('empty until saved; any logged-in user can read it', async () => {
    const r = await request(staff).get('/api/menu-config');
    expect(r.status).toBe(200);
    expect(r.body).toEqual([]);
  });
  test('dashboard and settings can never be hidden; unknown, duplicate and malformed rows are refused', async () => {
    expect((await request(admin).put('/api/menu-config').send([row('dashboard', false, 1)])).status).toBe(400);
    expect((await request(admin).put('/api/menu-config').send([row('settings', false, 1)])).status).toBe(400);
    expect((await request(admin).put('/api/menu-config').send([row('hackme', true, 1)])).status).toBe(400);
    expect((await request(admin).put('/api/menu-config').send([row('stock', true, 1), row('stock', true, 2)])).status).toBe(400);
    expect((await request(admin).put('/api/menu-config').send([{ item_key: 'stock', label: '', visible: true, sort_order: 1 }])).status).toBe(400);
    expect((await request(admin).put('/api/menu-config').send([{ item_key: 'stock', label: 'S', visible: 'no', sort_order: 1 }])).status).toBe(400);
    expect((await request(admin).put('/api/menu-config').send([{ item_key: 'stock', label: 'S', visible: true, sort_order: 1.5 }])).status).toBe(400);
    expect((await request(admin).put('/api/menu-config').send({})).status).toBe(400);
    expect((await request(staff).get('/api/menu-config')).body).toEqual([]);
  });
  test('admin saves order and hidden items; saving again updates; reset returns to default', async () => {
    const put = await request(admin).put('/api/menu-config').send([row('dashboard', true, 1), row('stock', false, 3), row('pos', true, 2), row('settings', true, 4)]);
    expect(put.status).toBe(200);
    expect(put.body.map(x => x.item_key)).toEqual(['dashboard', 'pos', 'stock', 'settings']);
    const again = await request(admin).put('/api/menu-config').send([row('stock', true, 9)]);
    expect(again.body.find(x => x.item_key === 'stock')).toMatchObject({ visible: true, sort_order: 9 });
    const read = await request(owner).get('/api/menu-config');
    expect(read.body.length).toBe(4);
    const reset = await request(admin).post('/api/menu-config/reset');
    expect(reset.status).toBe(200);
    expect((await request(staff).get('/api/menu-config')).body).toEqual([]);
    const a = await pool.query(`SELECT action FROM admin_audit`);
    expect(a.rows.map(x => x.action)).toEqual(expect.arrayContaining(['menu.update', 'menu.reset']));
  });
  test('the menu list covers all 26 owner-app items', () => {
    expect(router.MENU_ITEMS.length).toBe(26);
  });
});
