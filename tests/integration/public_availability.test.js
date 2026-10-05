'use strict';
// Website availability feed: booleans only, published items only, nothing private.
const express = require('express');
const request = require('supertest');
const { newDb } = require('pg-mem');
const { createRouter } = require('../../routes/public_availability');

async function makeApp() {
    const { Pool } = newDb().adapters.createPg();
    const pool = new Pool();
    await pool.query(`CREATE TABLE products (item_code TEXT, name TEXT, stock_level NUMERIC, selling_price NUMERIC, avg_cost NUMERIC, active BOOLEAN, photo_url TEXT)`);
    await pool.query(`CREATE TABLE catalogue_web (item_code TEXT PRIMARY KEY, published BOOLEAN)`);
    await pool.query(`INSERT INTO products VALUES ('001','In stock',12,4500,2999.99,true,'/api/item-photos/a.jpg'),('002','Sold out',0,3000,1888.5,true,NULL),('003','Unpublished',5,1000,777.77,true,NULL),('004','Inactive',9,1000,500.5,false,NULL)`);
    await pool.query(`INSERT INTO catalogue_web VALUES ('001',true),('002',true),('003',false),('004',true)`);
    const app = express();
    app.use('/api', createRouter(pool));
    app.__pool = pool;
    return app;
}

describe('website availability feed', () => {
    test('lists published active items as true/false only', async () => {
        const app = await makeApp();
        const r = await request(app).get('/api/public/availability');
        expect(r.status).toBe(200);
        expect(r.body.items).toEqual([{ code: '001', available: true, photo: '/api/item-photos/a.jpg' }, { code: '002', available: false, photo: null }]);
    });
    test('never leaks stock numbers, prices or costs', async () => {
        const app = await makeApp();
        const r = await request(app).get('/api/public/availability');
        const raw = JSON.stringify(r.body);
        ['12', '4500', '2999', '1888', 'stock', 'price', 'cost', 'In stock'].forEach(s => expect(raw).not.toContain(s));
        expect(r.headers['access-control-allow-origin']).toBe('*');
    });
    test('stock change shows up on the next call', async () => {
        const app = await makeApp();
        await app.__pool.query(`UPDATE products SET stock_level = 0 WHERE item_code = '001'`);
        const r = await request(app).get('/api/public/availability');
        expect(r.body.items[0].available).toBe(false);
    });
    test('answers with an empty list if the web table is missing', async () => {
        const { Pool } = newDb().adapters.createPg();
        const app = express(); app.use('/api', createRouter(new Pool()));
        const r = await request(app).get('/api/public/availability');
        expect(r.status).toBe(200); expect(r.body.items).toEqual([]);
    });
});
