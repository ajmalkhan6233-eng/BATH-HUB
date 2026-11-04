'use strict';
// Voice: "give credit 1500 to Sam" / "Sam paid 1000" become Document Inbox DRAFTS. Confirm files them; the oldest invoices are settled first.
jest.mock('pg', () => require('../helpers/pgmock')());

const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const request = require('supertest');
const pg = require('pg');
const F = require('../../utils/documentFiling');
const { cleanVoice } = require('../../utils/geminiVoice');

describe('allocatePayment: oldest invoice first, never more than owed', () => {
  const inv = [{ id: 2, invoice_no: 'B', invoice_date: '2026-09-10', amount: 900, paid: 0 }, { id: 1, invoice_no: 'A', invoice_date: '2026-09-01', amount: 600, paid: 100 }, { id: 3, invoice_no: 'C', invoice_date: '2026-08-01', amount: 50, paid: 50 }];
  test('settles A (500 left) then part of B', () => {
    const a = F.allocatePayment(inv, 800);
    expect(a.applied).toEqual([{ id: 1, invoice_no: 'A', apply: 500, left: 0 }, { id: 2, invoice_no: 'B', apply: 300, left: 600 }]);
    expect(a.remaining).toBe(0); expect(a.outstanding).toBe(1400);
  });
  test('a payment bigger than everything owed leaves a remainder (the route refuses it)', () => {
    expect(F.allocatePayment(inv, 2000).remaining).toBe(600);
  });
  test('nothing owed / nothing paid / bad input', () => {
    expect(F.allocatePayment([{ id: 1, amount: 10, paid: 10 }], 5).applied).toEqual([]);
    expect(F.allocatePayment(inv, 0).applied).toEqual([]);
    expect(() => F.allocatePayment(null, 10)).not.toThrow();
  });
  test('money is rounded to cents, no float drift', () => {
    const a = F.allocatePayment([{ id: 1, amount: 0.3, paid: 0.1 }], 0.2);
    expect(a.applied[0].apply).toBe(0.2); expect(a.remaining).toBe(0);
  });
});

describe('cleanVoice: credit kinds need a name AND an amount', () => {
  test('both present', () => {
    const c = cleanVoice({ text: 'x', entry: { kind: 'credit_given', party: ' Sam ', amount: '1,500', note: 'tiles' } });
    expect(c.entry).toMatchObject({ kind: 'credit_given', party: 'Sam', amount: 1500, note: 'tiles' });
  });
  test('missing name, zero or missing amount: not an entry (nothing guessed)', () => {
    expect(cleanVoice({ text: 'x', entry: { kind: 'credit_paid', amount: 500 } }).entry.kind).toBe('none');
    expect(cleanVoice({ text: 'x', entry: { kind: 'credit_paid', party: 'Sam', amount: 0 } }).entry.kind).toBe('none');
    expect(cleanVoice({ text: 'x', entry: { kind: 'credit_given', party: 'Sam' } }).entry.kind).toBe('none');
  });
});

describe('Document Inbox: credit drafts', () => {
  const db = pg.__db.public;
  db.none(`CREATE TABLE customers (id SERIAL PRIMARY KEY, name TEXT, phone TEXT)`);
  db.none(`INSERT INTO customers (name, phone) VALUES ('Sam Perera', '0771111111'), ('Nimal Silva', '0772222222'), ('Nimal Fernando', '0773333333'), ('Debtfree', '0774444444')`);
  db.none(`CREATE TABLE credit_customers (id SERIAL PRIMARY KEY, customer_id INT, invoice_date DATE, invoice_no TEXT, amount NUMERIC, paid NUMERIC DEFAULT 0, due_date DATE, notes TEXT, quarantined BOOLEAN DEFAULT FALSE)`);
  db.none(`INSERT INTO credit_customers (customer_id, invoice_date, invoice_no, amount, paid) VALUES (1,'2026-09-10','B',900,0), (1,'2026-09-01','A',600,0), (4,'2026-09-01','Z',100,100)`);
  const { createRouter } = require('../../routes/document_inbox');
  const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'creditvoice-'));
  const router = createRouter(new pg.Pool(), { inboxRoot: ROOT, fileDaySheet: async () => ({ message: 'x' }) });
  const mk = role => { const a = express(); a.use(express.json()); a.use((req, _r, n) => { req.session = role ? { user: { role, username: 'aj' } } : undefined; n(); }); a.use('/api', router); return a; };
  const owner = mk('owner');
  afterAll(() => fs.rmSync(ROOT, { recursive: true, force: true }));
  const draft = (kind, party, amount, note = '') => router.recordVoice({ entry: { kind, party, amount, note, date: '' }, buffer: Buffer.from('ogg'), original: `${kind} ${party} ${amount}`, english: '', warnings: [], confidence: 'high', from: '9477' });
  const paid = id => db.many(`SELECT invoice_no, paid FROM credit_customers ORDER BY id`).map(r => `${r.invoice_no}:${Number(r.paid)}`).join(' ');
  const count = () => Number(db.many(`SELECT COUNT(*) AS n FROM credit_customers`)[0].n);

  test('a spoken credit becomes a draft with the customer matched, and nothing is saved yet', async () => {
    const before = count();
    const d = await draft('credit_given', 'Sam', 1500, 'tiles');
    expect(d).toMatchObject({ doc_type: 'credit_given', source: 'voice', status: 'to_check', fileable: true });
    expect(d.extracted).toMatchObject({ customer_name: 'Sam', amount: 1500, notes: 'tiles' });
    const list = (await request(owner).get('/api/document-inbox')).body.find(x => x.id === d.id);
    expect(list.match).toMatchObject({ found: 'one', outstanding: 1500 }); expect(list.match.customers[0].name).toBe('Sam Perera');
    expect(count()).toBe(before);
  });
  test('Confirm files the credit as a new credit_customers row (paid 0) against the right customer', async () => {
    const d = await draft('credit_given', 'Sam Perera', 2500, 'bathroom set');
    const r = await request(owner).post(`/api/document-inbox/${d.id}/file`).send({});
    expect(r.status).toBe(200); expect(r.body.status).toBe('filed'); expect(r.body.filed_to).toBe('credit_customers');
    const row = db.many(`SELECT * FROM credit_customers WHERE invoice_no = 'VOICE-${d.id}'`)[0];
    expect(row).toMatchObject({ customer_id: 1 }); expect(Number(row.amount)).toBe(2500); expect(Number(row.paid)).toBe(0);
  });
  test('a payment settles the OLDEST invoice first (A before B) and says so; the preview shows it before Confirm', async () => {
    const d = await draft('credit_paid', 'Sam', 700);
    const list = (await request(owner).get('/api/document-inbox')).body.find(x => x.id === d.id);
    expect(list.match.applied.map(a => `${a.invoice_no}:${a.apply}`)).toEqual(['A:600', 'B:100']);
    const r = await request(owner).post(`/api/document-inbox/${d.id}/file`).send({});
    expect(r.status).toBe(200); expect(r.body.filed_note).toContain('A (600)'); expect(r.body.filed_note).toContain('NOT added to the day');
    expect(paid()).toContain('A:600'); expect(paid()).toContain('B:100');
  });
  test('paying MORE than owed is refused and changes nothing', async () => {
    const before = paid();
    const d = await draft('credit_paid', 'Sam', 999999);
    const r = await request(owner).post(`/api/document-inbox/${d.id}/file`).send({});
    expect(r.status).toBe(400); expect(r.body.error).toMatch(/owes only/); expect(paid()).toBe(before);
    expect(db.many(`SELECT status FROM document_inbox WHERE id = ${d.id}`)[0].status).toBe('to_check');
  });
  test('a customer who owes nothing, an unknown name and an ambiguous name are all refused', async () => {
    for (const [party, re] of [['Debtfree', /owes nothing/], ['Kamal Unknown', /not in your Customers/], ['Nimal', /More than one customer/]]) {
      const d = await draft('credit_paid', party, 10);
      const r = await request(owner).post(`/api/document-inbox/${d.id}/file`).send({});
      expect(r.status).toBe(400); expect(r.body.error).toMatch(re);
    }
  });
  test('only the owner may file, and a filed draft cannot be filed twice', async () => {
    const d = await draft('credit_given', 'Sam', 100);
    expect((await request(mk('staff')).post(`/api/document-inbox/${d.id}/file`).send({})).status).toBe(403);
    expect((await request(owner).post(`/api/document-inbox/${d.id}/file`).send({})).status).toBe(200);
    const n = count();
    expect((await request(owner).post(`/api/document-inbox/${d.id}/file`).send({})).status).toBe(409);
    expect(count()).toBe(n);
  });
  test('the owner can fix a wrong name in the screen before Confirm', async () => {
    const d = await draft('credit_given', 'Kamal', 300);
    const put = await request(owner).put(`/api/document-inbox/${d.id}`).send({ doc_type: 'credit_given', extracted: { customer_name: 'Nimal Silva', amount: 300, date: '2026-10-18' } });
    expect(put.status).toBe(200);
    const r = await request(owner).post(`/api/document-inbox/${d.id}/file`).send({});
    expect(r.status).toBe(200); expect(db.many(`SELECT customer_id FROM credit_customers WHERE invoice_no = 'VOICE-${d.id}'`)[0].customer_id).toBe(2);
  });
});

test('allocatePayment orders real Date objects (what the database driver returns) as dates, not as text', () => {
  const a = F.allocatePayment([
    { id: 9, invoice_no: 'NEW', invoice_date: new Date('2026-10-18'), amount: 700, paid: 0 },
    { id: 1, invoice_no: 'OLD', invoice_date: new Date('2026-09-01'), amount: 700, paid: 0 }], 700);
  expect(a.applied.map(x => x.invoice_no)).toEqual(['OLD']);
});
