const express = require('express'), request = require('supertest');
const apiGzip = require('../../middleware/apiGzip');
function app() {
  const a = express(); a.use('/api', apiGzip());
  a.get('/api/big', (q, r) => r.json({ rows: Array.from({ length: 400 }, (_, i) => ({ id: i, name: 'Item ' + i })) }));
  a.get('/api/small', (q, r) => r.json({ ok: true }));
  a.get('/api/pdf', (q, r) => { r.type('application/pdf'); r.send(Buffer.alloc(5000, 1)); });
  a.get('/api/sse', (q, r) => { r.type('text/event-stream'); r.send('data: x\n\n'.repeat(300)); });
  return a;
}
test('big JSON is gzipped and decodes to the same data', async () => {
  const res = await request(app()).get('/api/big').set('Accept-Encoding', 'gzip');
  expect(res.headers['content-encoding']).toBe('gzip'); expect(res.headers.vary).toMatch(/Accept-Encoding/);
  expect(res.body.rows.length).toBe(400);   // the client unzips it for us: same data came through
});
test('no gzip header from the phone = plain answer', async () => {
  const res = await request(app()).get('/api/big').set('Accept-Encoding', 'identity'); expect(res.headers['content-encoding']).toBeUndefined(); expect(res.body.rows.length).toBe(400);
});
test('small answers, PDFs and live feeds are left alone', async () => {
  for (const u of ['/api/small', '/api/pdf', '/api/sse']) { const r = await request(app()).get(u).set('Accept-Encoding', 'gzip'); expect(r.headers['content-encoding']).toBeUndefined(); }
});
