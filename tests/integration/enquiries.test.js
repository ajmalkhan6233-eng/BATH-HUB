'use strict';
// M2 Enquiry Tracker: isolated test on in-memory Postgres (pg-mem).
const express = require('express');
const request = require('supertest');
const { newDb } = require('pg-mem');
const { createRouter } = require('../../routes/enquiries');

function makeApp(role) {
    const { Pool } = newDb().adapters.createPg();
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.session = { user: role ? { role } : null }; next(); });
    app.use('/api', createRouter(new Pool()));
    return app;
}

describe('M2 enquiries', () => {
    test('owner only', async () => {
        expect((await request(makeApp('staff')).get('/api/enquiries')).status).toBe(403);
        expect((await request(makeApp(null)).post('/api/enquiries').send({ channel: 'tiktok' })).status).toBe(403);
    });

    test('quick add defaults (today, status new) and validation', async () => {
        const app = makeApp('owner');
        const ok = await request(app).post('/api/enquiries').send({ channel: 'tiktok', product_interest: 'floor tile 60x60', how_found_us: 'live' });
        expect(ok.status).toBe(201);
        expect(ok.body).toMatchObject({ channel: 'tiktok', status: 'new', product_interest: 'floor tile 60x60' });
        expect(ok.body.date).toBeTruthy();
        expect((await request(app).post('/api/enquiries').send({ channel: 'radio' })).status).toBe(400);
        expect((await request(app).post('/api/enquiries').send({ channel: 'google', date: '1/2/26' })).status).toBe(400);
        expect((await request(app).post('/api/enquiries').send({ channel: 'google', status: 'maybe' })).status).toBe(400);
    });

    test('status update and weekly counts by channel', async () => {
        const app = makeApp('admin');
        const a = (await request(app).post('/api/enquiries').send({ channel: 'tiktok' })).body;
        await request(app).post('/api/enquiries').send({ channel: 'tiktok' });
        await request(app).post('/api/enquiries').send({ channel: 'walk-in' });
        const up = await request(app).put('/api/enquiries/' + a.id + '/status').send({ status: 'won' });
        expect(up.body.status).toBe('won');
        expect((await request(app).put('/api/enquiries/999/status').send({ status: 'won' })).status).toBe(404);
        expect((await request(app).put('/api/enquiries/' + a.id + '/status').send({ status: 'x' })).status).toBe(400);

        const wkRes = await request(app).get('/api/enquiries/weekly'); if (wkRes.status !== 200) throw new Error(JSON.stringify(wkRes.body)); const wk = wkRes.body;
        const by = Object.fromEntries(wk.map(x => [x.channel, x.n]));
        expect(by).toEqual({ tiktok: 2, 'walk-in': 1 });
        expect(new Set(wk.map(x => x.week_start)).size).toBe(1);
        expect((await request(app).get('/api/enquiries')).body).toHaveLength(3);
    });
});
