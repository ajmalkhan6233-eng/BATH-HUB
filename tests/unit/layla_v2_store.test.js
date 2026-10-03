'use strict';
// The memory store and the Postgres store must behave the same. Postgres runs on pg-mem here.
jest.mock('pg', () => require('../helpers/pgmock')());
const { Pool } = require('pg');
const { createPgStore } = require('../../layla_v2/store_pg');
const { createMemoryStore } = require('../../layla_v2/store_memory');

const makers = {
    memory: () => createMemoryStore(),
    pg: () => createPgStore(new Pool()),
};

describe.each(Object.keys(makers))('LAYLA v2 store (%s)', name => {
    let s;
    beforeEach(async () => {
        s = makers[name]();
        if (name === 'pg') {   // pg-mem keeps one database for the whole file: empty the tables between tests
            await s.ensureSchema();
            for (const t of ['layla_messages', 'layla_customers', 'layla_state', 'layla_tasks', 'layla_contacts']) await require('pg').__db.public.none('DELETE FROM ' + t);
        }
    });

    test('contacts start EMPTY, add / lookup / remove (digits only)', async () => {
        expect(await s.listContacts()).toEqual([]);
        expect(await s.getContact('94771234567')).toBeNull();
        await s.addContact({ phone: '+94 77 123 4567', role: 'owner', name: 'Aj' });
        const c = await s.getContact('94771234567');
        expect(c).toMatchObject({ role: 'owner', name: 'Aj' });
        await s.addContact({ phone: '94770000001', role: 'staff' });
        expect((await s.listContacts('staff')).map(x => x.phone)).toEqual(['94770000001']);
        await s.removeContact('94771234567');
        expect(await s.getContact('94771234567')).toBeNull();
    });

    test('tasks: create, list open newest first, close once', async () => {
        const a = await s.createTask({ kind: 'unknown_fact', phone: '94771234567', name: 'Nimal', summary: 'Asked about X' });
        const b = await s.createTask({ kind: 'complaint', summary: 'Broken tile', payload: { box: 3 } });
        const open = await s.listOpenTasks();
        expect(open.map(t => t.id)).toEqual([b, a]);
        expect(await s.closeTask(a, 'owner')).toBe(true);
        expect(await s.closeTask(a, 'owner')).toBe(false);
        expect((await s.listOpenTasks()).map(t => t.id)).toEqual([b]);
        const t = await s.getTask(b);
        expect(JSON.parse(t.payload)).toEqual({ box: 3 });
    });

    test('state flags', async () => {
        expect(await s.getState('paused')).toBeNull();
        await s.setState('paused', 'true');
        expect(await s.getState('paused')).toBe('true');
        await s.setState('paused', 'false');
        expect(await s.getState('paused')).toBe('false');
    });

    test('customer name / language are remembered and not wiped by partial saves', async () => {
        await s.saveCustomer('94771234567', { name: 'Nimal', lang: 'si' });
        await s.saveCustomer('94771234567', { lang: 'en' });
        expect(await s.getCustomer('94771234567')).toMatchObject({ name: 'Nimal', lang: 'en' });
        expect(await s.getCustomer('94779999999')).toBeNull();
    });

    test('recent messages: latest N in order, per phone', async () => {
        for (let i = 1; i <= 25; i++) await s.addMessage('94771234567', i % 2 ? 'in' : 'out', 'm' + i);
        await s.addMessage('94770000002', 'in', 'other');
        const r = await s.recentMessages('94771234567', 20);
        expect(r).toHaveLength(20);
        expect(r[0].body).toBe('m6');
        expect(r[19].body).toBe('m25');
        expect((await s.recentMessages('94770000002')).map(m => m.body)).toEqual(['other']);
    });
});

test('migration files: up creates only layla_ tables, down drops them', () => {
    const fs = require('fs'), path = require('path');
    const up = fs.readFileSync(path.join(__dirname, '../../layla_v2/migrations/001_layla_v2.sql'), 'utf8');
    const down = fs.readFileSync(path.join(__dirname, '../../layla_v2/migrations/001_layla_v2_down.sql'), 'utf8');
    const created = [...up.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map(m => m[1]);
    const dropped = [...down.matchAll(/DROP TABLE IF EXISTS (\w+)/g)].map(m => m[1]);
    expect(created.length).toBe(5);
    created.forEach(t => expect(t).toMatch(/^layla_/));
    expect(dropped.sort()).toEqual(created.sort());
    expect(up).not.toMatch(/ALTER TABLE|DROP /i);
});