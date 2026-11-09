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
