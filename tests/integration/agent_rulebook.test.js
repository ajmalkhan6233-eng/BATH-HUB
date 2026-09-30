'use strict';
// M1 Agent Rulebook: isolated test. In-memory Postgres (pg-mem), no live DB, no server.js.
const express = require('express');
const request = require('supertest');
const { newDb } = require('pg-mem');
const { createRouter, SEED_RULES } = require('../../routes/agent_rulebook');

function makeApp(role) {
    const { Pool } = newDb().adapters.createPg();
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.session = { user: role ? { role } : null }; next(); });
    app.use('/api', createRouter(new Pool()));
    return app;
}

describe('M1 agent rulebook', () => {
    test('staff and anonymous are refused', async () => {
        expect((await request(makeApp('staff')).get('/api/agent/rulebook')).status).toBe(403);
        expect((await request(makeApp(null)).get('/api/agent/rules')).status).toBe(403);
    });

    test('seeds the standing rules; export is plain text of active rules', async () => {
        const app = makeApp('owner');
        const rules = (await request(app).get('/api/agent/rules')).body;
        expect(rules).toHaveLength(SEED_RULES.length);
        const txt = await request(app).get('/api/agent/rulebook');
        expect(txt.type).toBe('text/plain');
        expect(txt.text).toMatch(/weekly, calculated on net sales/);
        expect(txt.text).toMatch(/15-day return window is a soft flag/);
    });

    test('add, edit = new version (old kept inactive), deactivate', async () => {
        const app = makeApp('admin');
        const add = await request(app).post('/api/agent/rules').send({ topic: 'tone', rule_text: 'Replies to Aj are very short.' });
        expect(add.status).toBe(201);
        expect(add.body).toMatchObject({ version: 1, active: true, source: 'taught by Aj' });

        const ed = await request(app).put('/api/agent/rules/' + add.body.id).send({ rule_text: 'Replies to Aj: 5 short lines max.' });
        expect(ed.body).toMatchObject({ version: 2, active: true, rule_key: add.body.rule_key });
        expect(ed.body.id).not.toBe(add.body.id);

        const all = (await request(app).get('/api/agent/rules?all=1')).body.filter(r => r.rule_key === add.body.rule_key);
        expect(all.map(r => [r.version, r.active]).sort()).toEqual([[1, false], [2, true]]);
        expect(all.find(r => r.version === 1).rule_text).toBe('Replies to Aj are very short.'); // never overwritten

        // the old version cannot be edited again
        expect((await request(app).put('/api/agent/rules/' + add.body.id).send({ rule_text: 'x' })).status).toBe(409);

        await request(app).post('/api/agent/rules/' + ed.body.id + '/deactivate').expect(200);
        const txt = (await request(app).get('/api/agent/rulebook')).text;
        expect(txt).not.toMatch(/5 short lines/);
    });

    test('validation', async () => {
        const app = makeApp('owner');
        expect((await request(app).post('/api/agent/rules').send({ topic: 'x' })).status).toBe(400);
        expect((await request(app).put('/api/agent/rules/9999').send({ rule_text: 'x' })).status).toBe(404);
    });
});
