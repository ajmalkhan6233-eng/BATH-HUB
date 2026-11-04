'use strict';
// M4 Competitor Watch: isolated test on in-memory Postgres (pg-mem).
const express = require('express');
const request = require('supertest');
const { newDb } = require('pg-mem');
const { createRouter, SEED } = require('../../routes/competitors');

function makeApp(role) {
    const { Pool } = newDb().adapters.createPg();
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.session = { user: role ? { role } : null }; next(); });
    app.use('/api', createRouter(new Pool()));
    return app;
}

describe('M4 competitors', () => {
    test('owner only', async () => {
        expect((await request(makeApp('staff')).get('/api/competitors')).status).toBe(403);
        expect((await request(makeApp(null)).get('/api/competitors/checklist')).status).toBe(403);
    });

    test('seeded with the 13 handoff competitors, unknowns left blank', async () => {
        const app = makeApp('owner');
        const rows = (await request(app).get('/api/competitors')).body;
        expect(rows).toHaveLength(13);
        expect(SEED).toHaveLength(13);
        const by = Object.fromEntries(rows.map(r => [r.name, r]));
        expect(by['New Sun Ceramics'].area).toBe('nawala');
        expect(by['Thihariya Tile Center & Granite Designers'].area).toBe('thihariya strip');
        expect(by['Tile Mahagedara'].notes).toMatch(/unconfirmed/i);
        expect(by['Greenly'].notes).toMatch(/not found/i);
        expect(by['Sonic Ceramic'].channels).toBe('');
        expect(by['Sonic Ceramic'].last_checked).toBeNull();
    });

    test('add, edit, validate channels, delete', async () => {
        const app = makeApp('admin');
        const add = await request(app).post('/api/competitors').send({ name: 'Test Tiles', area: 'island-wide', channels: 'TikTok, site' });
        expect(add.status).toBe(201);
        expect(add.body.channels).toBe('tiktok,site');
        const ed = await request(app).put('/api/competitors/' + add.body.id).send({ notes: 'Big on lives' });
        expect(ed.body).toMatchObject({ notes: 'Big on lives', area: 'island-wide', channels: 'tiktok,site' });
        expect((await request(app).post('/api/competitors').send({ name: 'X', channels: 'myspace' })).status).toBe(400);
        expect((await request(app).post('/api/competitors').send({ channels: 'site' })).status).toBe(400);
        expect((await request(app).put('/api/competitors/9999').send({ notes: 'x' })).status).toBe(404);
        expect((await request(app).delete('/api/competitors/' + add.body.id)).status).toBe(200);
        expect((await request(app).delete('/api/competitors/' + add.body.id)).status).toBe(404);
    });

    test('monthly checklist: check recorded, last_checked stamped, other months unaffected', async () => {
        const app = makeApp('owner');
        const id = (await request(app).get('/api/competitors')).body.find(r => r.name === 'Tile City').id;
        const c = await request(app).post(`/api/competitors/${id}/checks`).send({ checked_on: '2026-10-03', posts: true, goes_live: false, online_store: true, promotions: '10% off floor tiles' });
        expect(c.status).toBe(201);
        expect(c.body).toMatchObject({ posts: true, goes_live: false, online_store: true, promotions: '10% off floor tiles' });

        const oct = (await request(app).get('/api/competitors/checklist?month=2026-10')).body;
        expect(oct.items).toHaveLength(13);
        const row = oct.items.find(r => r.id === id);
        expect(row.last_checked).toBe('2026-10-03');
        expect(row.check.promotions).toBe('10% off floor tiles');
        expect(oct.items.filter(r => r.check).length).toBe(1);
        expect((await request(app).get('/api/competitors/checklist?month=2026-11')).body.items.filter(r => r.check).length).toBe(0);

        expect((await request(app).post(`/api/competitors/${id}/checks`).send({ checked_on: 'yesterday' })).status).toBe(400);
        expect((await request(app).post(`/api/competitors/${id}/checks`).send({ posts: 'yes' })).status).toBe(400);
        expect((await request(app).post('/api/competitors/9999/checks').send({})).status).toBe(404);
        expect((await request(app).get('/api/competitors/checklist?month=10')).status).toBe(400);
    });

    test('due-check lists never-checked and stale competitors, not recently checked ones', async () => {
        const app = makeApp('owner');
        const rows = (await request(app).get('/api/competitors')).body;
        const id = n => rows.find(r => r.name === n).id;
        const ago = d => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
        await request(app).post(`/api/competitors/${id('Tile City')}/checks`).send({ checked_on: ago(3) });
        await request(app).post(`/api/competitors/${id('Ultra Tiles')}/checks`).send({ checked_on: ago(60) });
        const r = await request(app).get('/api/competitors/due-check');
        expect(r.status).toBe(200);
        const names = r.body.competitors.map(c => c.name);
        expect(names).not.toContain('Tile City');
        expect(names).toContain('Ultra Tiles');
        expect(r.body.never_checked).toBe(11);
        expect(names[names.length - 1]).toBe('Ultra Tiles');
        expect((await request(app).get('/api/competitors/due-check?days=90')).body.competitors.map(c => c.name)).not.toContain('Ultra Tiles');
        expect((await request(makeApp('staff')).get('/api/competitors/due-check')).status).toBe(403);
    });
});
