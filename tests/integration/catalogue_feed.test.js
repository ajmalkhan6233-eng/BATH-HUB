'use strict';
// M5 Catalogue feed: isolated test on in-memory Postgres (pg-mem).
// Key check: the PUBLIC feed never carries cost, price, margin, supplier, stock or item code.
const express = require('express');
const request = require('supertest');
const { newDb } = require('pg-mem');
const { createRouter, toInches } = require('../../routes/catalogue_feed');

async function makeApp(role) {
    const { Pool } = newDb().adapters.createPg();
    const pool = new Pool();
    await pool.query(`CREATE TABLE products (item_code TEXT, name TEXT, category TEXT, stock_level NUMERIC, reorder_threshold NUMERIC,
        selling_price NUMERIC, avg_cost NUMERIC, photo_url TEXT, active BOOLEAN)`);
    await pool.query(`INSERT INTO products VALUES
        ('001','Marble Floor Tile','Tiles',120,10,4500,2999.99,'/api/item-photos/a.jpg',true),
        ('002','Wall Tile No Photo','Tiles',40,10,3000,1888.5,NULL,true),
        ('003','Old Tile','Tiles',0,0,1000,777.77,'/api/item-photos/c.jpg',false)`);
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.session = { user: role ? { role } : null }; next(); });
    app.use('/api', createRouter(pool));
    return app;
}

describe('M5 catalogue feed', () => {
    test('inches conversion', () => {
        expect(toInches('60x60')).toBe('24x24');
        expect(toInches('30x60')).toBe('12x24');
        expect(toInches('')).toBe('');
    });

    test('public feed: nothing published by default, open without login', async () => {
        const app = await makeApp(null);
        const r = await request(app).get('/api/public/catalogue');
        expect(r.status).toBe(200);
        expect(r.body.items).toEqual([]);
        expect(r.headers['access-control-allow-origin']).toBe('*');
    });

    test('owner-only management routes', async () => {
        const app = await makeApp('staff');
        expect((await request(app).get('/api/catalogue-web')).status).toBe(403);
        expect((await request(app).put('/api/catalogue-web/001').send({ published: true })).status).toBe(403);
    });

    test('publish rules and the public payload contains ONLY the whitelisted fields', async () => {
        const app = await makeApp('owner');
        const owner = await request(app).get('/api/catalogue-web');
        expect(owner.body.map(x => x.item_code)).toEqual(['001', '002']);     // inactive 003 not listed
        expect(JSON.stringify(owner.body)).not.toMatch(/2999|4500|1888|cost|price|stock/i);

        // cannot publish without size, or without a photo
        expect((await request(app).put('/api/catalogue-web/001').send({ published: true })).status).toBe(400);
        expect((await request(app).put('/api/catalogue-web/002').send({ size_cm: '30x60', published: true })).status).toBe(400);
        expect((await request(app).put('/api/catalogue-web/001').send({ size_cm: 'big' })).status).toBe(400);
        expect((await request(app).put('/api/catalogue-web/999').send({ size_cm: '60x60' })).status).toBe(404);
        expect((await request(app).put('/api/catalogue-web/003').send({ size_cm: '60x60' })).status).toBe(404);

        const ok = await request(app).put('/api/catalogue-web/001').send({ size_cm: '60 x 60 cm', finish: 'Glossy', use: 'Bathroom floor', published: true });
        expect(ok.status).toBe(200);
        expect(ok.body).toMatchObject({ size_cm: '60x60', published: true });

        const pub = await request(app).get('/api/public/catalogue');
        expect(pub.body.items).toEqual([{
            name: 'Marble Floor Tile', size_cm: '60x60', size_inches: '24x24', finish: 'Glossy', use: 'Bathroom floor', photo: '/api/item-photos/a.jpg',
        }]);
        expect(Object.keys(pub.body.items[0]).sort()).toEqual(['finish', 'name', 'photo', 'size_cm', 'size_inches', 'use']);
        const raw = JSON.stringify(pub.body);
        for (const secret of ['2999', '4500', '1888', '777', 'avg_cost', 'selling_price', 'cost', 'margin', 'supplier', 'stock', 'item_code', '"001"'])
            expect(raw).not.toContain(secret);

        // hiding removes it again
        await request(app).put('/api/catalogue-web/001').send({ published: false }).expect(200);
        expect((await request(app).get('/api/public/catalogue')).body.items).toEqual([]);
    });
});
