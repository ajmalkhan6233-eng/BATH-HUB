'use strict';
jest.mock('../utils/pool', () => ({ connect: jest.fn(), query: jest.fn() }));
jest.mock('../routes/item_catalog', () => ({ createItem: jest.fn() }));
const { validatePackage } = require('../routes/grn_workbench');
const base = () => ({ vendor: { name: 'METRO' }, bill_no: 'ME2026/1797', bill_date: '2026-10-28', received_date: '2026-10-29', credit_days: 90, payment_type: 'BILL',
  lines: [{ vendor_code: 'ME599', name: 'TOWEL BAR', qty: 5, unit_cost: 1400, selling_price: 2500 }, { name: 'SINK TAP', qty: 3, unit_cost: 2800 }] });
test('good package: total, due date = received + 90', () => {
  const r = validatePackage(base());
  expect(r.total).toBe(15400); expect(r.due).toBe('2027-01-27'); expect(r.lines[1].sp).toBeNull();
});
test('total mismatch refused', () => { const p = base(); p.total = 99999; expect(() => validatePackage(p)).toThrow(/does not match/); });
test('duplicate line, zero qty, no bill number refused', () => {
  const a = base(); a.lines[1].name = 'towel bar'; expect(() => validatePackage(a)).toThrow(/twice/);
  const b = base(); b.lines[0].qty = 0; expect(() => validatePackage(b)).toThrow(/quantity/);
  const c = base(); c.bill_no = ''; expect(() => validatePackage(c)).toThrow(/Bill number/);
});

// ---- Generate (/read): plain 429 message + Retry, fuller fill, number helpers ----
const { readFailure, isRateLimit, keyNo } = require('../routes/grn_workbench');
test('429 / quota errors are "busy, press Retry", other errors still offer Retry, never a crash', () => {
  const a = readFailure(Object.assign(new Error('Too Many Requests'), { status: 429 }));
  expect(a.ok).toBe(false); expect(a.retry).toBe(true); expect(a.code).toBe('busy'); expect(a.message).toMatch(/busy/i); expect(a.message).toMatch(/Retry/);
  expect(isRateLimit(new Error('RESOURCE_EXHAUSTED: quota'))).toBe(true);
  expect(isRateLimit(new Error('timeout'))).toBe(false);
  const b = readFailure(new Error('timeout'));
  expect(b.retry).toBe(true); expect(b.code).toBe('error');
});
test('number key: 001 = 01 = 1, paper numbers keep letters', () => {
  expect(keyNo('001')).toBe('1'); expect(keyNo(' 01 ')).toBe('1'); expect(keyNo('000')).toBe('0');
  expect(keyNo('ME2026/1757')).toBe('me20261757'); expect(keyNo('ME2026-1757')).toBe('me20261757');
});

describe('POST /api/grn-workbench/read', () => {
  const express = require('express'), request = require('supertest');
  const create = jest.fn();
  beforeAll(() => {
    jest.doMock('../openrouter.config', () => ({ client: { chat: { completions: { create: (...a) => create(...a) } } } }));
    global.fetch = jest.fn().mockResolvedValue({ json: async () => ({ data: [] }) });
    require('../utils/pool').query.mockResolvedValue({ rows: [{ name: 'Cool Lanka (Pvt) Ltd' }] });
  });
  const app = () => { const a = express(); a.use('/api', require('../routes/grn_workbench')); return a; };
  const photo = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
  test('every free reader answers 429 -> {ok:false, retry:true, code:busy}', async () => {
    create.mockRejectedValue(Object.assign(new Error('429 Too Many Requests'), { status: 429 }));
    const r = await request(app()).post('/api/grn-workbench/read').send({ photo_data_url: photo });
    expect(r.status).toBe(200); expect(r.body).toMatchObject({ ok: false, retry: true, code: 'busy' });
  });
  test('good reading fills vendor, number, date, credit days, total and ALL lines; total from lines if missing', async () => {
    create.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ kind: 'vendor_bill', vendor_name: 'Cool Lanka', bill_number: 'ME2026/1757', bill_date: '2026-10-28', credit_days: 90, total: null,
      items: [{ vendor_code: 'A1', description: 'TAP', qty: 2, unit_cost: 1000 }, { description: 'SINK', qty: 1, amount: 500 }], confidence: 'high' }) } }] });
    const r = await request(app()).post('/api/grn-workbench/read').send({ photo_data_url: photo });
    expect(r.body.ok).toBe(true); expect(r.body.vendor).toBe('Cool Lanka (Pvt) Ltd'); expect(r.body.vendor_known).toBe(true);
    expect(r.body.bill_no).toBe('ME2026/1757'); expect(r.body.bill_date).toBe('2026-10-28'); expect(r.body.credit_days).toBe(90);
    expect(r.body.lines).toHaveLength(2); expect(r.body.lines[1].unit).toBe(500);
    expect(r.body.lines_total).toBe(2500); expect(r.body.total).toBe(2500); expect(r.body.total_from_lines).toBe(true);
  });
});
