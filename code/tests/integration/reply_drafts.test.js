'use strict';
// M6 Reply drafts: isolated test on in-memory Postgres (pg-mem). Drafts only; nothing is sent.
const express = require('express');
const request = require('supertest');
const { newDb } = require('pg-mem');
const { createRouter, looksLikePrice } = require('../../routes/reply_drafts');

function makeApp(role) {
    const { Pool } = newDb().adapters.createPg();
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.session = { user: role ? { role } : null }; next(); });
    app.use('/api', createRouter(new Pool()));
    return app;
}

describe('M6 reply drafts', () => {
    test('price detection', () => {
        for (const t of ['Rs 4,500 per box', 'LKR4500', 'It is 4500/=', '1,200 Rs', '850 per sqm', 'Rs. 99'])
            expect(looksLikePrice(t)).toBe(true);
        for (const t of ['We are open until 6pm', 'Our shop is on Kandy Road', 'Size 60x60, glossy'])
            expect(looksLikePrice(t)).toBe(false);
    });

    test('owner only', async () => {
        expect((await request(makeApp('staff')).get('/api/reply-drafts')).status).toBe(403);
        expect((await request(makeApp(null)).post('/api/reply-drafts').send({ channel: 'whatsapp', draft_text: 'hi' })).status).toBe(403);
    });

    test('always created as draft; cannot be created pre-approved', async () => {
        const app = makeApp('owner');
        const r = await request(app).post('/api/reply-drafts').send({ channel: 'whatsapp', customer_ref: '0771234567', incoming_text: 'Price of 60x60?', draft_text: 'Rs 4,500 per box.', status: 'approved' });
        expect(r.status).toBe(201);
        expect(r.body).toMatchObject({ status: 'draft', approved_at: null, has_price: true });
        expect((await request(app).post('/api/reply-drafts').send({ channel: 'sms', draft_text: 'x' })).status).toBe(400);
        expect((await request(app).post('/api/reply-drafts').send({ channel: 'email', draft_text: '  ' })).status).toBe(400);
    });

    test('cannot be marked sent without approval; editing after approval resets it', async () => {
        const app = makeApp('admin');
        const d = (await request(app).post('/api/reply-drafts').send({ channel: 'whatsapp', draft_text: 'We open at 9am.' })).body;

        expect((await request(app).post(`/api/reply-drafts/${d.id}/mark-sent`)).status).toBe(409);   // not approved yet

        const ap = await request(app).post(`/api/reply-drafts/${d.id}/approve`);
        expect(ap.body.status).toBe('approved');
        expect(ap.body.approved_at).toBeTruthy();

        const ed = await request(app).put(`/api/reply-drafts/${d.id}`).send({ draft_text: 'We open at 9am. Rs 4,500 per box.' });
        expect(ed.body).toMatchObject({ status: 'draft', approved_at: null, has_price: true });
        expect((await request(app).post(`/api/reply-drafts/${d.id}/mark-sent`)).status).toBe(409);   // edited text needs fresh approval

        await request(app).post(`/api/reply-drafts/${d.id}/approve`).expect(200);
        const sent = await request(app).post(`/api/reply-drafts/${d.id}/mark-sent`);
        expect(sent.body.status).toBe('sent');
        expect((await request(app).put(`/api/reply-drafts/${d.id}`).send({ draft_text: 'changed' })).status).toBe(409);
        expect((await request(app).post(`/api/reply-drafts/${d.id}/reject`)).status).toBe(409);
    });

    test('reject, filter by status, 404', async () => {
        const app = makeApp('owner');
        const a = (await request(app).post('/api/reply-drafts').send({ channel: 'email', draft_text: 'one' })).body;
        await request(app).post('/api/reply-drafts').send({ channel: 'email', draft_text: 'two' });
        expect((await request(app).post(`/api/reply-drafts/${a.id}/reject`)).body.status).toBe('rejected');
        expect((await request(app).get('/api/reply-drafts?status=rejected')).body).toHaveLength(1);
        expect((await request(app).get('/api/reply-drafts?status=draft')).body).toHaveLength(1);
        expect((await request(app).get('/api/reply-drafts?status=bogus')).status).toBe(400);
        expect((await request(app).post('/api/reply-drafts/999/approve')).status).toBe(404);
    });
});
