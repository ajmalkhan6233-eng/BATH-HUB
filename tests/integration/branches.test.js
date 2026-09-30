'use strict';
// M8 Branch profile: isolated test on in-memory Postgres (pg-mem).
const express = require('express');
const request = require('supertest');
const { newDb } = require('pg-mem');
const { createRouter } = require('../../routes/branches');

function makeApp(role) {
    const { Pool } = newDb().adapters.createPg();
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.session = { user: role ? { role } : null }; next(); });
    app.use('/api', createRouter(new Pool()));
    return app;
}

describe('M8 branches', () => {
    test('owner only', async () => {
        expect((await request(makeApp('staff')).get('/api/branches')).status).toBe(403);
        expect((await request(makeApp(null)).post('/api/branches').send({ name: 'X' })).status).toBe(403);
    });

    test('new branch is read-only with cap 0, even if the request asks for more', async () => {
        const app = makeApp('owner');
        const r = await request(app).post('/api/branches').send({ name: 'Kandy', agent_allowed_actions: ['read', 'stage_order'], spend_cap_lkr: 500000 });
        expect(r.status).toBe(201);
        expect(r.body).toMatchObject({ name: 'Kandy', agent_allowed_actions: ['read'], spend_cap_lkr: 0, approver: 'Aj' });
        expect((await request(app).post('/api/branches').send({})).status).toBe(400);
    });

    test('widening needs widen_confirm; narrowing does not; cap needs stage_order', async () => {
        const app = makeApp('admin');
        const b = (await request(app).post('/api/branches').send({ name: 'Galle', approver: 'Aj' })).body;
        const url = '/api/branches/' + b.id;

        expect((await request(app).put(url).send({ agent_allowed_actions: ['read', 'draft'] })).status).toBe(400);   // no confirm
        expect((await request(app).put(url).send({ spend_cap_lkr: 1000 })).status).toBe(400);                        // no confirm

        const d = await request(app).put(url).send({ agent_allowed_actions: ['draft'], widen_confirm: true });      // read is always kept
        expect(d.body.agent_allowed_actions).toEqual(['read', 'draft']);

        expect((await request(app).put(url).send({ spend_cap_lkr: 1000, widen_confirm: true })).status).toBe(400);  // needs stage_order
        const s = await request(app).put(url).send({ agent_allowed_actions: ['draft', 'stage_order'], spend_cap_lkr: 25000, widen_confirm: true });
        expect(s.body).toMatchObject({ agent_allowed_actions: ['read', 'draft', 'stage_order'], spend_cap_lkr: 25000 });

        // narrowing back down is allowed without confirm
        const n = await request(app).put(url).send({ agent_allowed_actions: ['read'], spend_cap_lkr: 0 });
        expect(n.body).toMatchObject({ agent_allowed_actions: ['read'], spend_cap_lkr: 0 });

        expect((await request(app).put(url).send({ agent_allowed_actions: ['delete_everything'], widen_confirm: true })).status).toBe(400);
        expect((await request(app).put(url).send({ spend_cap_lkr: -5 })).status).toBe(400);
        expect((await request(app).put(url).send({ approver: ' ' })).status).toBe(400);
        expect((await request(app).put('/api/branches/999').send({ name: 'x' })).status).toBe(404);
    });

    test('can-check: read allowed, everything else off until widened, never without approval', async () => {
        const app = makeApp('owner');
        const b = (await request(app).post('/api/branches').send({ name: 'Nugegoda' })).body;
        const can = async a => (await request(app).get(`/api/branches/${b.id}/can?action=${a}`)).body;
        expect(await can('read')).toMatchObject({ allowed: true, needs_approval: false });
        expect(await can('draft')).toMatchObject({ allowed: false, needs_approval: true });
        await request(app).put('/api/branches/' + b.id).send({ agent_allowed_actions: ['draft'], widen_confirm: true });
        expect(await can('draft')).toMatchObject({ allowed: true, needs_approval: true, approver: 'Aj' });
        expect((await request(app).get(`/api/branches/${b.id}/can?action=pay`)).status).toBe(400);
        expect((await request(app).get('/api/branches/999/can?action=read')).status).toBe(404);
    });
});
