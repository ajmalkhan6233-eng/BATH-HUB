'use strict';
// GRN smart match: pure matcher + the two routes. Fake data only.
jest.mock('pg', () => require('../helpers/pgmock')());
const express = require('express');
const request = require('supertest');
const db = require('pg').__db.public;
const M = require('../../utils/grnMatch');
db.none(`CREATE TABLE products (id SERIAL PRIMARY KEY, item_code TEXT, name TEXT, stock_level NUMERIC DEFAULT 0, active BOOLEAN DEFAULT TRUE)`);
db.none(`INSERT INTO products (item_code, name) VALUES ('T12','Brass Tap 1/2 inch'),('T34','Brass Tap 3/4 inch'),('B1','Wall Hung Basin White'),('M7','Basin Mixer Chrome'),('OLD','Old Basin'),('S9','Shower Rose 8 inch')`);
db.none(`UPDATE products SET active = false WHERE item_code = 'OLD'`);
const P = [{ item_code: 'T12', name: 'Brass Tap 1/2 inch' }, { item_code: 'T34', name: 'Brass Tap 3/4 inch' }, { item_code: 'B1', name: 'Wall Hung Basin White' }, { item_code: 'M7', name: 'Basin Mixer Chrome' }];
const app = express(); app.use('/api', require('../../routes/grn_match'));
beforeAll(() => new Promise(r => setTimeout(r, 200)));
const match = (lines, vendor = 'Metro') => request(app).post('/api/grn-match').send({ vendor, lines }).then(r => r.body);

describe('matcher', () => {
  test('sizes are normalised and never confused', () => {
    expect(M.norm('1/2" Brass Tap')).toBe(M.norm('half inch brass tap'));
    expect(M.matchLine({ name: '1/2 in Brass Tap' }, P).item.item_code).toBe('T12');
    expect(M.matchLine({ name: 'Brass tap 3/4"' }, P).item.item_code).toBe('T34');
    expect(M.score('Brass Tap 1/2 inch', 'Brass Tap 3/4 inch')).toBeLessThan(M.GREEN);
  });
  test('exact code wins; exact name is green; misspelling is found; rubbish is new', () => {
    expect(M.matchLine({ name: 'anything', code: 'b1' }, P)).toMatchObject({ status: 'green', how: 'code' });
    expect(M.matchLine({ name: 'wall hung basin white' }, P)).toMatchObject({ status: 'green', how: 'name' });
    const r = M.matchLine({ name: 'Wal Hung Basin Wht' }, P); expect(['green', 'amber']).toContain(r.status); expect(r.alts[0].item_code).toBe('B1');
    expect(M.matchLine({ name: 'Cement 50kg bag' }, P).status).toBe('new');
  });
  test('a vague line is amber with choices, not a guess', () => {
    const r = M.matchLine({ name: 'Brass Tap' }, P); expect(r.status).toBe('amber'); expect(r.item).toBeNull(); expect(r.alts.length).toBeGreaterThan(1);
  });
});
describe('routes', () => {
  test('matches a bill, skips inactive items, counts each colour', async () => {
    const r = await match([{ name: 'Brass Tap 1/2"' }, { name: 'Brass Tap' }, { name: 'Old Basin' }, { name: 'Cement' }]);
    expect(r.results[0].item.item_code).toBe('T12'); expect(r.results[1].status).toBe('amber');
    expect((r.results[2].item || {}).item_code).not.toBe('OLD'); expect(r.results[3].status).toBe('new'); expect(r.green).toBeGreaterThanOrEqual(1);
  });
  test('remembering a pick makes it green for that vendor only', async () => {
    expect((await request(app).post('/api/grn-match/remember').send({ vendor: 'Metro', text: 'Brass Tap', item_code: 'T34' })).status).toBe(200);
    expect((await match([{ name: 'brass  tap' }])).results[0]).toMatchObject({ status: 'green', how: 'remembered', item: { item_code: 'T34' } });
    expect((await match([{ name: 'Brass Tap' }], 'Leo')).results[0].status).toBe('amber');
  });
  test('bad input is refused; products are never changed', async () => {
    expect((await request(app).post('/api/grn-match').send({})).status).toBe(400);
    expect((await request(app).post('/api/grn-match/remember').send({ vendor: 'Metro', text: 'x', item_code: 'NOPE' })).status).toBe(404);
    expect((await request(app).post('/api/grn-match/remember').send({ vendor: '', text: 'x', item_code: 'T12' })).status).toBe(400);
    expect(Number(db.many('SELECT COUNT(*) AS n FROM products')[0].n)).toBe(6);
  });
});
