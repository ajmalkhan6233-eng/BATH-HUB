'use strict';
// Document Inbox: photos of papers are read, checked by Aj, and only then filed. Reader and day-sheet filer are faked.
jest.mock('pg', () => require('../helpers/pgmock')());

const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const request = require('supertest');
const pg = require('pg');

const db = pg.__db.public;
db.none(`CREATE TABLE suppliers (id SERIAL PRIMARY KEY, name TEXT)`);
db.none(`INSERT INTO suppliers (name) VALUES ('Lanka Tiles')`);
db.none(`CREATE TABLE products (id SERIAL PRIMARY KEY, item_code TEXT, name TEXT)`);
db.none(`INSERT INTO products (item_code, name) VALUES ('1001', 'Marble Tile 60x60'), ('1002', 'Tile Adhesive 20kg')`);
db.none(`CREATE TABLE pos_bills (id SERIAL PRIMARY KEY, bill_number VARCHAR(40) UNIQUE, customer_name TEXT, customer_phone TEXT, subtotal NUMERIC, discount_pct NUMERIC, discount_amount NUMERIC, total NUMERIC, payment_method TEXT, notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), source VARCHAR(20) NOT NULL DEFAULT 'pos', attachment_path TEXT)`);
db.none(`CREATE TABLE pos_bill_items (id SERIAL PRIMARY KEY, bill_id INT, item_name TEXT, qty NUMERIC, unit_price NUMERIC, line_total NUMERIC)`);
db.none(`CREATE TABLE grn_records (id SERIAL PRIMARY KEY, grn_number TEXT, supplier_id INT, supplier_name TEXT, grn_date DATE, item_description TEXT, quantity NUMERIC, unit_cost NUMERIC, total_amount NUMERIC, source_file_path TEXT, status TEXT DEFAULT 'PENDING_REVIEW', notes TEXT)`);
db.none(`CREATE TABLE cheque_register (id SERIAL PRIMARY KEY, cheque_no VARCHAR(50), bank VARCHAR(100), payee VARCHAR(150), amount NUMERIC, due_date DATE, status VARCHAR(20) DEFAULT 'pending', notes TEXT)`);

const { createRouter, sniff } = require('../../routes/document_inbox');

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'docinbox-'));
const JPG = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.alloc(64, 1)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), Buffer.alloc(32, 1)]);

let reading = { document_type: 'manual_bill', confidence: 'medium', bill_number: '1042', date: '2026-09-28', customer_name: 'Nimal', payment_method: 'cash', total: 9000, items: [{ name: 'Marble Tile 60x60', qty: 2, unit_price: 4000, amount: 8000 }, { name: 'Adhesive', qty: 1, unit_price: 1000, amount: 1000 }] };
const ocr = jest.fn(async () => { if (reading instanceof Error) throw reading; return reading; });
const daySheets = [];
const fileDaySheet = jest.fn(async ex => { daySheets.push(ex); return { message: `Saved for ${ex.date}` }; });

const router = createRouter(new pg.Pool(), { ocr, inboxRoot: ROOT, fileDaySheet });   // one router: pg-mem dislikes CREATE IF NOT EXISTS twice
function appAs(role) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.session = role ? { user: { role, username: 'aj' } } : undefined; next(); });
  app.use('/api', router);
  return app;
}
const owner = appAs('owner');
const up = (app, buf = JPG, type, name = 'paper.jpg') => { const r = request(app).post('/api/document-inbox/upload').attach('photo', buf, name); return type ? r.field('doc_type', type) : r; };
const count = t => Number(db.many(`SELECT COUNT(*) AS n FROM ${t}`)[0].n);

afterAll(() => fs.rmSync(ROOT, { recursive: true, force: true }));

describe('who may use it', () => {
  test('owner only', async () => {
    for (const role of ['staff', null]) {
      const a = appAs(role);
      expect((await request(a).get('/api/document-inbox')).status).toBe(403);
      expect((await up(a)).status).toBe(403);
      expect((await request(a).post('/api/document-inbox/1/file').send({})).status).toBe(403);
      expect((await request(a).get('/api/document-inbox/1/photo')).status).toBe(403);
    }
  });
});

describe('upload', () => {
  test('real file type is checked from the bytes, not the name', async () => {
    expect(sniff(JPG)).toBe('jpg'); expect(sniff(PNG)).toBe('png'); expect(sniff(Buffer.from('%PDF-1.4 xxxx'))).toBe('pdf'); expect(sniff(Buffer.from('hello world, not a photo'))).toBe(null);
    const r = await up(owner, Buffer.from('<script>alert(1)</script> not a photo at all'), undefined, 'evil.jpg');
    expect(r.status).toBe(400);
    expect((await request(owner).post('/api/document-inbox/upload')).status).toBe(400);
    expect((await up(owner, JPG, 'nonsense')).status).toBe(400);
  });

  test('a bill photo is read, kept, and waits for Aj; nothing is filed yet', async () => {
    reading = { ...reading };
    const r = await up(owner);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ doc_type: 'manual_bill', status: 'to_check', source: 'upload', fileable: true, files_to: 'pos_bills' });
    expect(r.body.extracted).toMatchObject({ bill_number: '1042', date: '2026-09-28', customer_name: 'Nimal' });
    expect(r.body.extracted.items).toHaveLength(2);
    expect(count('pos_bills')).toBe(0);
    expect(fs.existsSync(r.body.file_path)).toBe(true);
    expect(path.resolve(r.body.file_path).startsWith(ROOT)).toBe(true);
    const photo = await request(owner).get(`/api/document-inbox/${r.body.id}/photo`);
    expect(photo.status).toBe(200);
    expect((await request(owner).get('/api/document-inbox/9999/photo')).status).toBe(404);
  });

  test('the type picked by Aj wins over what the reader guessed', async () => {
    reading = { document_type: 'manual_bill', items: [] };
    const r = await up(owner, PNG, 'cheque', 'c.png');
    expect(r.body.doc_type).toBe('cheque');
  });

  test('a reader failure still keeps the photo for typing in by hand', async () => {
    reading = new Error('reader is down');
    const r = await up(owner);
    expect(r.status).toBe(201);
    expect(r.body.doc_type).toBe('unknown');
    expect(r.body.reader_note).toMatch(/Could not read/);
    expect(fs.existsSync(r.body.file_path)).toBe(true);
    reading = { document_type: 'manual_bill', items: [] };
  });

  test('a PDF is saved, not read', async () => {
    ocr.mockClear();
    const r = await up(owner, Buffer.from('%PDF-1.4 some pdf bytes here'), 'grn', 'g.pdf');
    expect(r.status).toBe(201);
    expect(ocr).not.toHaveBeenCalled();
    expect(r.body.doc_type).toBe('grn');
    expect(r.body.reader_note).toMatch(/PDF/);
  });
});

describe('filing', () => {
  test('manual bill: goes to pos_bills as a paper bill with the paper date, items and photo; cannot be filed twice', async () => {
    reading = { document_type: 'manual_bill', confidence: 'high', bill_number: '77', date: '2026-09-20', customer_name: 'Sunil', payment_method: 'card', total: 9000,
      items: [{ name: 'Marble Tile', qty: 2, unit_price: 4000, amount: 8000 }, { name: 'Adhesive', qty: 1, unit_price: 1000, amount: 1000 }] };
    const id = (await up(owner)).body.id;
    const f = await request(owner).post(`/api/document-inbox/${id}/file`).send({});
    expect(f.status).toBe(200);
    expect(f.body).toMatchObject({ status: 'filed', filed_to: 'pos_bills' });
    const bill = db.many(`SELECT * FROM pos_bills WHERE bill_number = 'MAN-77'`)[0];
    expect(bill).toMatchObject({ source: 'manual_photo', payment_method: 'card', customer_name: 'Sunil' });
    expect(Number(bill.total)).toBe(9000);
    expect(String(bill.attachment_path)).toContain(path.basename(ROOT));
    expect(new Date(bill.created_at).toISOString().slice(0, 10)).toBe('2026-09-20');
    expect(db.many(`SELECT * FROM pos_bill_items WHERE bill_id = ${bill.id}`)).toHaveLength(2);
    expect((await request(owner).post(`/api/document-inbox/${id}/file`).send({})).status).toBe(409);
    expect(count('pos_bills')).toBe(1);
    expect((await request(owner).put(`/api/document-inbox/${id}`).send({ doc_type: 'cheque' })).status).toBe(409);
  });

  test('a total that does not match needs an explicit "file anyway"; the items are what is used', async () => {
    reading = { document_type: 'manual_bill', date: '2026-09-21', total: 5000, items: [{ name: 'Basin', qty: 1, unit_price: 12000, amount: 12000 }] };
    const id = (await up(owner)).body.id;
    const first = await request(owner).post(`/api/document-inbox/${id}/file`).send({});
    expect(first.status).toBe(409);
    expect(first.body.code).toBe('needs_confirmation');
    expect(count('pos_bills')).toBe(1);
    const second = await request(owner).post(`/api/document-inbox/${id}/file`).send({ accept_warnings: true });
    expect(second.status).toBe(200);
    const bill = db.many(`SELECT * FROM pos_bills WHERE id = ${second.body.filed_id}`)[0];
    expect(Number(bill.total)).toBe(12000);
    expect(bill.bill_number).toBe(`MAN-20260921-D${id}`);
  });

  test('missing details are refused with a plain message and nothing is saved', async () => {
    reading = { document_type: 'manual_bill', items: [] };
    const id = (await up(owner)).body.id;
    const before = count('pos_bills');
    const f = await request(owner).post(`/api/document-inbox/${id}/file`).send({});
    expect(f.status).toBe(400);
    expect(f.body.error).toMatch(/date|item/i);
    expect(count('pos_bills')).toBe(before);
    expect(db.many(`SELECT status FROM document_inbox WHERE id = ${id}`)[0].status).toBe('to_check');
  });

  test('Aj can correct the fields before filing', async () => {
    reading = { document_type: 'manual_bill', items: [] };
    const id = (await up(owner)).body.id;
    const put = await request(owner).put(`/api/document-inbox/${id}`).send({ extracted: { date: '2026-09-22', customer_name: 'Kamal', payment_method: 'cash', items: [{ name: 'Tap', qty: '3', unit_price: '1500' }] } });
    expect(put.status).toBe(200);
    expect(put.body.extracted.items[0]).toMatchObject({ name: 'Tap', qty: 3, unit_price: 1500 });
    const f = await request(owner).post(`/api/document-inbox/${id}/file`).send({});
    expect(f.status).toBe(200);
    expect(Number(db.many(`SELECT total FROM pos_bills WHERE id = ${f.body.filed_id}`)[0].total)).toBe(4500);
  });

  test('GRN: supplier and items are matched to the catalogue by item code; one row per item, pending review, no stock touched', async () => {
    reading = { document_type: 'grn', grn_number: 'G-55', date: '2026-09-25', supplier_name: 'lanka tiles', total: 30000,
      items: [{ item_code: '1001', description: 'tile big', qty: 10, unit_cost: 2000, amount: 20000 }, { item_code: '1002', qty: 10, unit_cost: 1000, amount: 10000 }] };
    const up1 = await up(owner);
    expect(up1.body.match.supplier).toMatchObject({ name: 'Lanka Tiles' });
    expect(up1.body.match.items.map(m => m.matched && m.matched.name)).toEqual(['Marble Tile 60x60', 'Tile Adhesive 20kg']);
    const f = await request(owner).post(`/api/document-inbox/${up1.body.id}/file`).send({});
    expect(f.status).toBe(200);
    expect(f.body.filed_to).toBe('grn_records');
    const rows = db.many(`SELECT * FROM grn_records WHERE grn_number = 'G-55' ORDER BY id`);
    expect(rows).toHaveLength(2);
    expect(rows.every(r => r.status === 'PENDING_REVIEW' && r.supplier_id === 1 && r.supplier_name === 'Lanka Tiles')).toBe(true);
    expect(rows.map(r => r.item_description)).toEqual(['1001 - tile big', '1002 - Tile Adhesive 20kg']);   // code first; a line with no written name takes the catalogue name
    expect(rows.map(r => Number(r.total_amount))).toEqual([20000, 10000]);
  });

  test('GRN: an item code that is not in the catalogue, or an unknown supplier, needs "file anyway"', async () => {
    reading = { document_type: 'grn', grn_number: 'G-56', date: '2026-09-26', supplier_name: 'Woos Trading', items: [{ item_code: '9999', description: 'mystery', qty: 1, unit_cost: 500 }] };
    const id = (await up(owner)).body.id;
    const first = await request(owner).post(`/api/document-inbox/${id}/file`).send({});
    expect(first.status).toBe(409);
    expect(first.body.warnings.join(' ')).toMatch(/9999.*not in your catalogue/);
    expect(first.body.warnings.join(' ')).toMatch(/Woos Trading.*not in your Suppliers/);
    expect(db.many(`SELECT * FROM grn_records WHERE grn_number = 'G-56'`)).toHaveLength(0);
    expect((await request(owner).post(`/api/document-inbox/${id}/file`).send({ accept_warnings: true })).status).toBe(200);
    expect(db.many(`SELECT supplier_id, item_description FROM grn_records WHERE grn_number = 'G-56'`)[0]).toMatchObject({ supplier_id: null, item_description: '9999 - mystery' });
  });

  test('a supplier invoice has no home: refused until the type is changed', async () => {
    reading = { document_type: 'invoice', supplier_name: 'X', total: 100 };
    const id = (await up(owner)).body.id;
    const f = await request(owner).post(`/api/document-inbox/${id}/file`).send({});
    expect(f.status).toBe(400);
    expect(f.body.error).toMatch(/GRN/);
  });

  test('cheque: goes to the cheque register as pending', async () => {
    reading = { document_type: 'cheque_note', cheque_number: '000123', bank: 'BOC', payee: 'Lanka Tiles', amount: 45000.5, due_date: '2026-10-10', direction: 'given' };
    const r = await up(owner);
    expect(r.body.doc_type).toBe('cheque');
    const f = await request(owner).post(`/api/document-inbox/${r.body.id}/file`).send({});
    expect(f.status).toBe(200);
    const c = db.many(`SELECT * FROM cheque_register WHERE cheque_no = '000123'`)[0];
    expect(c).toMatchObject({ payee: 'Lanka Tiles', status: 'pending', bank: 'BOC' });
    expect(Number(c.amount)).toBe(45000.5);
  });

  test('daily sales sheet: handed to the careful day-sheet filer, not written directly', async () => {
    reading = { document_type: 'day_sheet', date: '2026-09-27', total_sale: 150000, cash_sale: 100000, card_sale: 50000 };
    const r = await up(owner);
    expect(r.body.doc_type).toBe('day_sheet');
    const f = await request(owner).post(`/api/document-inbox/${r.body.id}/file`).send({});
    expect(f.status).toBe(200);
    expect(f.body.filed_to).toBe('daily_summary');
    expect(daySheets).toHaveLength(1);
    expect(daySheets[0]).toMatchObject({ date: '2026-09-27', total_sale: 150000 });
  });

  test('if the day-sheet filer refuses, the paper stays in To check', async () => {
    fileDaySheet.mockRejectedValueOnce(Object.assign(new Error("Can't save: bad figures"), { status: 400 }));
    reading = { document_type: 'day_sheet', date: '2026-09-26', total_sale: 10 };
    const id = (await up(owner)).body.id;
    const f = await request(owner).post(`/api/document-inbox/${id}/file`).send({});
    expect(f.status).toBe(400);
    expect(db.many(`SELECT status FROM document_inbox WHERE id = ${id}`)[0].status).toBe('to_check');
  });
});

describe('review actions', () => {
  test('list filters, reject, and read again', async () => {
    reading = { document_type: 'unknown' };
    const id = (await up(owner)).body.id;
    expect((await request(owner).get('/api/document-inbox?status=bogus')).status).toBe(400);
    reading = { document_type: 'grn', supplier_name: 'S', date: '2026-09-01', items: [{ description: 'a', qty: 1, unit_cost: 5 }] };
    const re = await request(owner).post(`/api/document-inbox/${id}/reread`);
    expect(re.status).toBe(200);
    expect(re.body.doc_type).toBe('grn');
    const rej = await request(owner).post(`/api/document-inbox/${id}/reject`);
    expect(rej.body.status).toBe('rejected');
    expect((await request(owner).post(`/api/document-inbox/${id}/reject`)).status).toBe(409);
    const rejected = (await request(owner).get('/api/document-inbox?status=rejected')).body;
    expect(rejected.some(x => x.id === id)).toBe(true);
    expect((await request(owner).get('/api/document-inbox?status=to_check')).body.some(x => x.id === id)).toBe(false);
  });

  test('a photo path outside the inbox folder is never served', async () => {
    const outside = path.join(os.tmpdir(), 'secret-outside.jpg');
    fs.writeFileSync(outside, JPG);
    db.none(`INSERT INTO document_inbox (file_path) VALUES ('${outside.replace(/\\/g, '\\\\')}')`);
    const id = db.many(`SELECT MAX(id) AS id FROM document_inbox`)[0].id;
    expect((await request(owner).get(`/api/document-inbox/${id}/photo`)).status).toBe(404);
    fs.rmSync(outside, { force: true });
  });
});
