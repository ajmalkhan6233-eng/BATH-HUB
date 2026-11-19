'use strict';
// RBH Brain: owner-only notes, [[links]], backlinks, #tags, archive. Fake data only.
jest.mock('pg', () => require('../helpers/pgmock')());
const express = require('express');
const request = require('supertest');
const router = require('../../routes/brain');
const appAs = role => { const a = express(); a.use(express.json()); a.use((q, _r, n) => { q.session = { user: { role } }; n(); }); a.use('/api', router); return a; };
const owner = appAs('owner');
beforeAll(() => new Promise(r => setTimeout(r, 250)));

describe('parsers', () => {
  test('links and tags', () => {
    expect(router._test.parseLinks('see [[Metro Tiles]] and [[metro tiles|again]] [[ B ]]').sort()).toEqual(['b', 'metro tiles']);
    expect(router._test.parseTags('#vendor text #Cash_2 not#this')).toEqual(['vendor', 'cash_2']);
  });
});
describe('access', () => {
  test('staff and cashier are refused', async () => {
    expect((await request(appAs('staff')).get('/api/brain/notes')).status).toBe(403);
    expect((await request(appAs('cashier')).post('/api/brain/notes').send({ title: 'x' })).status).toBe(403);
  });
});
describe('notes', () => {
  let a, b;
  test('create, duplicate title refused, title needed', async () => {
    const r = await request(owner).post('/api/brain/notes').send({ title: 'Metro Tiles', body: 'Good vendor #vendor' });
    expect(r.status).toBe(201); a = r.body.id;
    expect((await request(owner).post('/api/brain/notes').send({ title: 'metro tiles' })).status).toBe(409);
    expect((await request(owner).post('/api/brain/notes').send({ title: '  ' })).status).toBe(400);
  });
  test('link creates a backlink, unresolved link has no id', async () => {
    const r = await request(owner).post('/api/brain/notes').send({ title: 'Call list', body: 'Ring [[Metro Tiles]] and [[Nobody]] #todo' });
    b = r.body.id;
    const n = await request(owner).get('/api/brain/notes/' + a);
    expect(n.body.backlinks.map(x => x.title)).toEqual(['Call list']);
    const m = await request(owner).get('/api/brain/notes/' + b);
    expect(m.body.links.find(l => l.key === 'nobody').id).toBeNull();
    expect(m.body.links.find(l => l.key === 'metro tiles').id).toBe(a);
  });
  test('open creates once, then finds', async () => {
    const x = await request(owner).post('/api/brain/open').send({ title: 'Nobody' });
    expect(x.body.created).toBe(true);
    const y = await request(owner).post('/api/brain/open').send({ title: 'NOBODY' });
    expect(y.body.created).toBe(false); expect(y.body.id).toBe(x.body.id);
  });
  test('search, tag filter, tags list', async () => {
    expect((await request(owner).get('/api/brain/notes?q=vendor')).body.notes.map(n => n.title)).toEqual(['Metro Tiles']);
    expect((await request(owner).get('/api/brain/notes?tag=%23todo')).body.notes.map(n => n.title)).toEqual(['Call list']);
    expect((await request(owner).get('/api/brain/tags')).body.tags.map(t => t.tag).sort()).toEqual(['todo', 'vendor']);
  });
  test('edit updates links and tags; pin sorts first', async () => {
    await request(owner).put('/api/brain/notes/' + b).send({ body: 'No links now' });
    expect((await request(owner).get('/api/brain/notes/' + a)).body.backlinks).toEqual([]);
    await request(owner).put('/api/brain/notes/' + a).send({ pinned: true });
    expect((await request(owner).get('/api/brain/notes')).body.notes[0].id).toBe(a);
  });
  test('html in a note is returned as text, never run by the server', async () => {
    const r = await request(owner).post('/api/brain/notes').send({ title: '<b>x</b>', body: '<script>1</script>' });
    const n = await request(owner).get('/api/brain/notes/' + r.body.id);
    expect(n.body.note.body).toBe('<script>1</script>');
  });
  test('delete archives; export is markdown', async () => {
    await request(owner).delete('/api/brain/notes/' + b);
    expect((await request(owner).get('/api/brain/notes/' + b)).status).toBe(404);
    const e = await request(owner).get('/api/brain/export');
    expect(e.headers['content-type']).toMatch(/markdown/); expect(e.text).toMatch(/# Metro Tiles/); expect(e.text).not.toMatch(/# Call list/);
  });
});

describe('photos', () => {
  const jpeg = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]).toString('base64');
  let id;
  beforeAll(async () => { id = (await request(owner).post('/api/brain/notes').send({ title: 'Photo note' })).body.id; });
  test('staff refused', async () => { expect((await request(appAs('staff')).post('/api/brain/notes/' + id + '/photos').send({ data: jpeg })).status).toBe(403); });
  test('jpeg saved, listed, served as image, deleted', async () => {
    const r = await request(owner).post('/api/brain/notes/' + id + '/photos').send({ data: jpeg }); expect(r.status).toBe(201);
    expect((await request(owner).get('/api/brain/notes/' + id)).body.photos).toEqual([r.body.id]);
    const g = await request(owner).get('/api/brain/photos/' + r.body.id);
    expect(g.headers['content-type']).toBe('image/jpeg'); expect(g.headers['x-content-type-options']).toBe('nosniff');
    await request(owner).delete('/api/brain/photos/' + r.body.id);
    expect((await request(owner).get('/api/brain/notes/' + id)).body.photos).toEqual([]);
  });
  test('not a jpeg, wrong magic bytes, too big, missing note all refused', async () => {
    expect((await request(owner).post('/api/brain/notes/' + id + '/photos').send({ data: 'data:image/svg+xml;base64,PHN2Zz4=' })).status).toBe(400);
    expect((await request(owner).post('/api/brain/notes/' + id + '/photos').send({ data: 'data:image/jpeg;base64,' + Buffer.alloc(300, 7).toString('base64') })).status).toBe(400);
    expect((await request(owner).post('/api/brain/notes/' + id + '/photos').send({ data: 'data:image/jpeg;base64,' + 'A'.repeat(900100) })).status).toBe(413);
    expect((await request(owner).post('/api/brain/notes/99999/photos').send({ data: jpeg })).status).toBe(404);
  });
  test('max 12 photos per note', async () => {
    for (let i = 0; i < 12; i++) await request(owner).post('/api/brain/notes/' + id + '/photos').send({ data: jpeg });
    expect((await request(owner).post('/api/brain/notes/' + id + '/photos').send({ data: jpeg })).status).toBe(409);
  });
});

describe('shop record links (read-only)', () => {
  const db = require('pg').__db.public;
  let id;
  beforeAll(async () => {
    db.none(`CREATE TABLE products (id SERIAL PRIMARY KEY, item_code TEXT, name TEXT, stock_level NUMERIC DEFAULT 0, selling_price NUMERIC DEFAULT 0)`);
    db.none(`CREATE TABLE vendor_bills (id SERIAL PRIMARY KEY, vendor_name TEXT, bill_no TEXT, bill_date DATE, due_date DATE, total NUMERIC, voided BOOLEAN DEFAULT FALSE)`);
    db.none(`CREATE TABLE vendor_payments (id SERIAL PRIMARY KEY, bill_id INT, amount NUMERIC)`);
    db.none(`CREATE TABLE vendor_credit_notes (id SERIAL PRIMARY KEY, bill_id INT, amount NUMERIC)`);
    db.none(`CREATE TABLE cheque_register (id SERIAL PRIMARY KEY, cheque_no TEXT, payee TEXT, amount NUMERIC, due_date DATE, status TEXT DEFAULT 'pending')`);
    db.none(`INSERT INTO products (item_code, name, stock_level, selling_price) VALUES ('A1','Wall Basin White',5,12500)`);
    db.none(`INSERT INTO vendor_bills (vendor_name, bill_no, bill_date, due_date, total) VALUES ('Metro Tiles','M-1','2026-11-01','2026-11-20',100000),('Metro Tiles','M-2','2026-11-02','2026-11-25',50000)`);
    db.none(`INSERT INTO vendor_payments (bill_id, amount) VALUES (1, 30000)`);
    db.none(`INSERT INTO cheque_register (cheque_no, payee, amount, due_date) VALUES ('555','Metro Tiles',70000,'2026-11-20')`);
    id = (await request(owner).post('/api/brain/notes').send({ title: 'Linked note' })).body.id;
  });
  test('staff refused', async () => { expect((await request(appAs('staff')).get('/api/brain/lookup?kind=item&q=ba')).status).toBe(403); });
  test('bad kind refused', async () => { expect((await request(owner).get('/api/brain/lookup?kind=users&q=ba')).status).toBe(400); });
  test('finds an item, vendor, bill and cheque', async () => {
    const f = async (k, t) => (await request(owner).get('/api/brain/lookup?kind=' + k + '&q=' + t)).body.results;
    expect((await f('item', 'basin'))[0].facts).toBe('Stock 5 · Price Rs 12,500');
    expect((await f('vendor', 'metro'))[0].facts).toBe('2 bills · we owe Rs 120,000');
    expect((await f('bill', 'M-2'))[0].label).toBe('Metro Tiles · M-2');
    expect((await f('cheque', '555'))[0].facts).toMatch(/Rs 70,000 .* pending/);
    expect(await f('item', '%')).toEqual([]);
  });
  test('link, no duplicate, shows live facts, unlink', async () => {
    const a = await request(owner).post('/api/brain/notes/' + id + '/refs').send({ kind: 'item', key: 'A1' }); expect(a.status).toBe(201);
    expect((await request(owner).post('/api/brain/notes/' + id + '/refs').send({ kind: 'item', key: 'A1' })).body.existed).toBe(true);
    db.none(`UPDATE products SET stock_level = 2 WHERE item_code = 'A1'`);
    const n = await request(owner).get('/api/brain/notes/' + id);
    expect(n.body.records).toHaveLength(1); expect(n.body.records[0].facts).toBe('Stock 2 · Price Rs 12,500');
    await request(owner).delete('/api/brain/refs/' + a.body.id);
    expect((await request(owner).get('/api/brain/notes/' + id)).body.records).toEqual([]);
  });
  test('unknown record and bad kind are refused; shop tables untouched', async () => {
    expect((await request(owner).post('/api/brain/notes/' + id + '/refs').send({ kind: 'item', key: 'NOPE' })).status).toBe(404);
    expect((await request(owner).post('/api/brain/notes/' + id + '/refs').send({ kind: 'user', key: '1' })).status).toBe(400);
    expect(db.many('SELECT stock_level FROM products')[0].stock_level).toBe(2);
    expect(db.many('SELECT COUNT(*) AS n FROM vendor_bills')[0].n).toBe(2);
  });
});

describe('map', () => {
  test('nodes and resolved links only; staff refused', async () => {
    const a = (await request(owner).post('/api/brain/notes').send({ title: 'Map A', body: 'to [[Map B]] and [[Missing One]]' })).body.id;
    const b = (await request(owner).post('/api/brain/notes').send({ title: 'Map B', body: 'back [[Map A]]' })).body.id;
    expect((await request(appAs('staff')).get('/api/brain/graph')).status).toBe(403);
    const g = (await request(owner).get('/api/brain/graph')).body;
    expect(g.nodes.map(n => n.id)).toEqual(expect.arrayContaining([a, b]));
    expect(g.edges).toEqual(expect.arrayContaining([{ from: a, to: b }, { from: b, to: a }]));
    expect(g.edges.filter(e => e.from === a)).toHaveLength(1);
  });
});

describe('reminders', () => {
  test('set, due list, clear, bad date refused', async () => {
    const id = (await request(owner).post('/api/brain/notes').send({ title: 'Remind me' })).body.id;
    const fut = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10), past = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);
    expect((await request(owner).put('/api/brain/notes/' + id).send({ remind_on: 'tomorrow' })).status).toBe(400);
    await request(owner).put('/api/brain/notes/' + id).send({ remind_on: fut });
    expect((await request(owner).get('/api/brain/due')).body.notes.map(n => n.id)).not.toContain(id);
    await request(owner).put('/api/brain/notes/' + id).send({ remind_on: past });
    expect((await request(owner).get('/api/brain/due')).body.notes.map(n => n.id)).toContain(id);
    expect((await request(owner).get('/api/brain/notes/' + id)).body.note.remind_on).toBe(past);
    await request(owner).put('/api/brain/notes/' + id).send({ remind_on: '' });
    expect((await request(owner).get('/api/brain/due')).body.notes.map(n => n.id)).not.toContain(id);
    expect((await request(appAs('staff')).get('/api/brain/due')).status).toBe(403);
  });
});
