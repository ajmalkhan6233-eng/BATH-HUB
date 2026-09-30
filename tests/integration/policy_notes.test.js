'use strict';
// M7 Policy watch: isolated test on in-memory Postgres (pg-mem).
const express = require('express');
const request = require('supertest');
const { newDb } = require('pg-mem');
const { createRouter } = require('../../routes/policy_notes');

function makeApp(role) {
    const { Pool } = newDb().adapters.createPg();
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.session = { user: role ? { role } : null }; next(); });
    app.use('/api', createRouter(new Pool()));
    return app;
}
const good = { date: '2026-09-01', topic: 'cess', summary: 'Cess change announced on imported tiles.', price_risk: 'high' };

describe('M7 policy notes', () => {
    test('owner only', async () => {
        expect((await request(makeApp('staff')).get('/api/policy-notes')).status).toBe(403);
        expect((await request(makeApp(null)).post('/api/policy-notes').send(good)).status).toBe(403);
    });

    test('nothing is seeded (no unverified rates on file)', async () => {
        expect((await request(makeApp('owner')).get('/api/policy-notes')).body).toEqual([]);
    });

    test('add starts unverified; validation', async () => {
        const app = makeApp('owner');
        const r = await request(app).post('/api/policy-notes').send({ ...good, verified: true }); // no source -> cannot start verified
        expect(r.status).toBe(400);
        const ok = await request(app).post('/api/policy-notes').send(good);
        expect(ok.status).toBe(201);
        expect(ok.body).toMatchObject({ verified: false, price_risk: 'high', date: '2026-09-01', source_url: '' });
        expect((await request(app).post('/api/policy-notes').send({ ...good, topic: 'vibes' })).status).toBe(400);
        expect((await request(app).post('/api/policy-notes').send({ ...good, price_risk: 'huge' })).status).toBe(400);
        expect((await request(app).post('/api/policy-notes').send({ ...good, date: '1 Sep' })).status).toBe(400);
        expect((await request(app).post('/api/policy-notes').send({ ...good, summary: ' ' })).status).toBe(400);
        expect((await request(app).post('/api/policy-notes').send({ ...good, source_url: 'javascript:alert(1)' })).status).toBe(400);
    });

    test('verify needs a source; editing the summary drops the verified tick', async () => {
        const app = makeApp('admin');
        const n = (await request(app).post('/api/policy-notes').send(good)).body;
        expect((await request(app).put('/api/policy-notes/' + n.id).send({ verified: true })).status).toBe(400);

        const v = await request(app).put('/api/policy-notes/' + n.id).send({ source_url: 'https://example.gov.lk/notice', verified: true });
        expect(v.body).toMatchObject({ verified: true, source_url: 'https://example.gov.lk/notice' });

        const ed = await request(app).put('/api/policy-notes/' + n.id).send({ summary: 'Updated wording.' });
        expect(ed.body).toMatchObject({ verified: false, summary: 'Updated wording.', topic: 'cess' });

        const other = await request(app).put('/api/policy-notes/' + n.id).send({ price_risk: 'low' });   // unrelated edit keeps state
        expect(other.body.price_risk).toBe('low');

        expect((await request(app).put('/api/policy-notes/999').send({ price_risk: 'low' })).status).toBe(404);
        expect((await request(app).delete('/api/policy-notes/' + n.id)).status).toBe(200);
        expect((await request(app).delete('/api/policy-notes/' + n.id)).status).toBe(404);
    });

    test('alerts: high-risk notes and unverified notes, with a count of the dangerous overlap', async () => {
        const app = makeApp('owner');
        const a = (await request(app).post('/api/policy-notes').send({ date: '2026-09-01', topic: 'cess', summary: 'High, unverified', price_risk: 'high' })).body;
        await request(app).post('/api/policy-notes').send({ date: '2026-09-02', topic: 'import duty', summary: 'Low, unverified', price_risk: 'low' });
        const c = (await request(app).post('/api/policy-notes').send({ date: '2026-09-03', topic: 'import ban', summary: 'High, verified', price_risk: 'high', source_url: 'https://example.gov.lk/x' })).body;
        await request(app).put('/api/policy-notes/' + c.id).send({ verified: true });
        const r = await request(app).get('/api/policy-notes/alerts');
        expect(r.status).toBe(200);
        expect(r.body.high_risk.map(n => n.summary).sort()).toEqual(['High, unverified', 'High, verified']);
        expect(r.body.unverified.map(n => n.summary).sort()).toEqual(['High, unverified', 'Low, unverified']);
        expect(r.body.high_risk_unverified).toBe(1);
        expect(a.verified).toBe(false);
        expect((await request(makeApp('staff')).get('/api/policy-notes/alerts')).status).toBe(403);
    });
});
