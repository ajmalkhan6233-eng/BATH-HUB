'use strict';
// Back-dated POS sale: owner only, real day, never in the future. Normal sales unchanged.
jest.mock('pg', () => require('../helpers/pgmock')());
const express = require('express');
const request = require('supertest');
const router = require('../../routes/pos_bills');
const mk = role => { const a = express(); a.use(express.json()); a.use((q, s, n) => { q.session = { user: { username: 'u', role } }; n(); }); a.use('/api', router); return a; };
beforeAll(() => new Promise(r => setTimeout(r, 500)));
const item = { items: [{ item_name: 'Basin', qty: 1, unit_price: 1000 }] };
test('staff cannot back-date', async () => { const r = await request(mk('staff')).post('/api/pos-bills').send({ ...item, sale_date: '2026-11-01' }); expect(r.status).toBe(403); });
test('owner: future day refused', async () => { const r = await request(mk('owner')).post('/api/pos-bills').send({ ...item, sale_date: '2999-01-01' }); expect(r.status).toBe(400); });
test('owner: junk date refused', async () => { const r = await request(mk('owner')).post('/api/pos-bills').send({ ...item, sale_date: 'yesterday' }); expect(r.status).toBe(400); });
test('owner: past day accepted', async () => { const r = await request(mk('owner')).post('/api/pos-bills').send({ ...item, sale_date: '2026-11-01' }); expect(r.status).toBe(200); });
test('no date: normal sale still works', async () => { const r = await request(mk('staff')).post('/api/pos-bills').send(item); expect(r.status).toBe(200); });
