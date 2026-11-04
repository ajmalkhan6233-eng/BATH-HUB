'use strict';
// M3 Content Calendar: isolated test on in-memory Postgres (pg-mem).
const express = require('express');
const request = require('supertest');
const { newDb } = require('pg-mem');
const { createRouter } = require('../../routes/content_calendar');

function makeApp(role) {
    const { Pool } = newDb().adapters.createPg();
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.session = { user: role ? { role } : null }; next(); });
    app.use('/api', createRouter(new Pool()));
    return app;
}

describe('M3 content calendar', () => {
    test('owner only', async () => {
        expect((await request(makeApp('staff')).get('/api/content-posts')).status).toBe(403);
        expect((await request(makeApp(null)).post('/api/content-posts/plan-week').send({ week_of: '2026-10-05' })).status).toBe(403);
    });

    test('plan-week makes 3 videos + 1 live (Mon-start), and is repeatable', async () => {
        const app = makeApp('owner');
        const p = await request(app).post('/api/content-posts/plan-week').send({ week_of: '2026-10-07' }); // a Wednesday
        expect(p.status).toBe(201);
        expect(p.body.week_start).toBe('2026-10-05');
        expect(p.body.created.map(x => [x.planned_date, x.platform, x.type, x.status])).toEqual([
            ['2026-10-05', 'tiktok', 'price-per-sqm', 'idea'],
            ['2026-10-07', 'tiktok', 'room idea', 'idea'],
            ['2026-10-09', 'tiktok', 'delivery/job clip', 'idea'],
            ['2026-10-10', 'live', 'live', 'idea'],
        ]);
        const again = await request(app).post('/api/content-posts/plan-week').send({ week_of: '2026-10-05' });
        expect(again.body.created).toHaveLength(0);
        expect((await request(app).get('/api/content-posts')).body).toHaveLength(4);
        expect((await request(app).get('/api/content-posts?from=2026-10-09&to=2026-10-31')).body).toHaveLength(2);
        expect((await request(app).post('/api/content-posts/plan-week').send({ week_of: 'soon' })).status).toBe(400);
    });

    test('add, script, move through statuses, record URL, delete', async () => {
        const app = makeApp('admin');
        const add = await request(app).post('/api/content-posts').send({ planned_date: '2026-10-12', platform: 'tiktok', type: 'room idea' });
        expect(add.status).toBe(201);
        expect(add.body).toMatchObject({ status: 'idea', planned_date: '2026-10-12' });
        const id = add.body.id;

        const s = await request(app).put('/api/content-posts/' + id).send({ script_draft: 'Hook: 3 bathroom ideas', status: 'scripted' });
        expect(s.body).toMatchObject({ status: 'scripted', script_draft: 'Hook: 3 bathroom ideas', platform: 'tiktok' });
        const d = await request(app).put('/api/content-posts/' + id).send({ status: 'posted', posted_url: 'https://www.tiktok.com/@x/video/1', enquiries_after: 4 });
        expect(d.body).toMatchObject({ status: 'posted', posted_url: 'https://www.tiktok.com/@x/video/1', enquiries_after: 4, script_draft: 'Hook: 3 bathroom ideas' });

        expect((await request(app).delete('/api/content-posts/' + id)).status).toBe(200);
        expect((await request(app).delete('/api/content-posts/' + id)).status).toBe(404);
    });

    test('validation', async () => {
        const app = makeApp('owner');
        expect((await request(app).post('/api/content-posts').send({ platform: 'tiktok', type: 'live' })).status).toBe(400);
        expect((await request(app).post('/api/content-posts').send({ planned_date: '2026-10-12', platform: 'youtube', type: 'live' })).status).toBe(400);
        expect((await request(app).post('/api/content-posts').send({ planned_date: '2026-10-12', platform: 'tiktok', type: 'meme' })).status).toBe(400);
        expect((await request(app).post('/api/content-posts').send({ planned_date: '2026-10-12', platform: 'tiktok', type: 'live', enquiries_after: -1 })).status).toBe(400);
        expect((await request(app).put('/api/content-posts/999').send({ status: 'posted' })).status).toBe(404);
    });
});
