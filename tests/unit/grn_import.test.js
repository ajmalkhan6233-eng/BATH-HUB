const G = require('../../public/lib/grn_import');
const JPG = Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9','hex');
const express = require('express');
const request = require('supertest');

describe('GrnImport', () => {
  test('JSON with lines, tolerant names, total matches', () => {
    const r = G.fromText(JSON.stringify({ supplier: 'METRO', invoice_no: 'ME1', date: '09/10/2026', total: 1500,
      items: [{ description: 'Tile A', quantity: 10, rate: 100 }, { name: 'Tap', qty: '1,0', unit_price: 50 }] }), 'x.json');
    expect(r.supplier).toBe('METRO'); expect(r.date).toBe('2026-10-09');
    expect(r.lines).toHaveLength(2); expect(r.lines_total).toBe(1500);
    expect(r.warnings).toEqual([]);
  });
  test('cost derived from line total', () => {
    const r = G.build({ lines: [{ name: 'A', qty: 4, amount: 400 }] });
    expect(r.lines[0].cost).toBe(100);
  });
  test('duplicate name and total mismatch warn', () => {
    const r = G.build({ supplier: 's', date: '2026-10-09', total: 999, lines: [{ name: 'Tile', qty: 1, cost: 10 }, { name: ' tile ', qty: 2, cost: 10 }] });
    expect(r.warnings.join('|')).toMatch(/Same item twice/);
    expect(r.warnings.join('|')).toMatch(/paper total is 999/);
  });
  test('CSV with quotes', () => {
    const r = G.fromText('Item,Qty,Unit Cost\n"Tile, big",2,50\nTap,1,20\n', 'a.csv');
    expect(r.lines[0].name).toBe('Tile, big'); expect(r.lines_total).toBe(120);
  });
  test('missing qty/cost/supplier warn, empty file warns', () => {
    expect(G.build({ lines: [{ name: 'A' }] }).warnings.join('|')).toMatch(/no quantity/);
    expect(G.build({}).warnings.join('|')).toMatch(/No item lines/);
  });
  test('OCR result carries the AI warning', () => {
    const r = G.fromOcr({ supplier_name: 'X', date: '2026-10-09', items: [{ name: 'A', qty: 1, unit_price: 5, amount: 5 }], confidence: 'low', notes: 'blurry' });
    expect(r.warnings[0]).toMatch(/hard to read/); expect(r.warnings.join('|')).toMatch(/misread/);
  });
});

describe('POST /grn-read-photo', () => {
  const mk = ocr => { const a = express(); a.use('/api', require('../../routes/grn_read').createRouter({ ocr })); return a; };
  test('returns lines, saves nothing', async () => {
    const r = await request(mk(async () => ({ document_type: 'grn', supplier_name: 'S', items: [{ name: 'A', qty: 2, unit_price: 5 }] })))
      .post('/api/grn-read-photo').attach('file', JPG, { filename: 'a.jpg', contentType: 'image/jpeg' });
    expect(r.status).toBe(200); expect(r.body.lines[0].name).toBe('A');
  });
  test('rejects pdf, no items, reader failure', async () => {
    let r = await request(mk(async () => ({}))).post('/api/grn-read-photo').attach('file', Buffer.from('x'), { filename: 'a.pdf', contentType: 'application/pdf' });
    expect(r.status).toBe(400);
    r = await request(mk(async () => ({ items: [] }))).post('/api/grn-read-photo').attach('file', JPG, { filename: 'a.jpg', contentType: 'image/jpeg' });
    expect(r.status).toBe(422);
    r = await request(mk(async () => { throw new Error('boom'); })).post('/api/grn-read-photo').attach('file', JPG, { filename: 'a.jpg', contentType: 'image/jpeg' });
    expect(r.status).toBe(502);
  });
});
