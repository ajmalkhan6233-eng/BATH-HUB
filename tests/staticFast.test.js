/* Test for middleware/staticFast.js, alone. Bare http server, no Express needed. */
const http = require('http'); const fs = require('fs'); const os = require('os'); const path = require('path'); const zlib = require('zlib');
const staticFast = require('../middleware/staticFast');
let server, port, dir; const big = '<html>' + 'royal bath hub '.repeat(400) + '</html>';
beforeAll(done => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-'));
  fs.writeFileSync(path.join(dir, 'a.html'), big); fs.writeFileSync(path.join(dir, 'tiny.css'), 'a{}');
  fs.writeFileSync(path.join(dir, '.secret.js'), big); fs.writeFileSync(path.join(dir, 'pic.png'), big);
  const mw = staticFast(dir);
  server = http.createServer((req, res) => mw(req, res, () => { res.statusCode = 599; res.end('next'); }));
  server.listen(0, () => { port = server.address().port; done(); });
});
afterAll(done => { if (server.closeAllConnections) server.closeAllConnections(); server.close(() => done()); });
function get(p, headers, method) {
  return new Promise((ok, bad) => { const r = http.request({ port, path: p, headers: headers || {}, method: method || 'GET' }, res => { const c = []; res.on('data', d => c.push(d)); res.on('end', () => ok({ s: res.statusCode, h: res.headers, b: Buffer.concat(c) })); }); r.on('error', bad); r.end(); });
}
const GZ = { 'accept-encoding': 'gzip, deflate' };
test('sends gzip that decompresses to the original', async () => { const r = await get('/a.html', GZ); expect(r.s).toBe(200); expect(r.h['content-encoding']).toBe('gzip'); expect(zlib.gunzipSync(r.b).toString()).toBe(big); expect(r.b.length).toBeLessThan(big.length / 5); });
test('second visit with the ETag answers 304', async () => { const a = await get('/a.html', GZ); const r = await get('/a.html', Object.assign({ 'if-none-match': a.h.etag }, GZ)); expect(r.s).toBe(304); expect(r.b.length).toBe(0); });
test('client without gzip goes to the next handler', async () => { const r = await get('/a.html', {}); expect(r.s).toBe(599); });
test('tiny file, image, dot file and other types go to next', async () => { for (const p of ['/tiny.css', '/pic.png', '/.secret.js', '/missing.js']) expect((await get(p, GZ)).s).toBe(599); });
test('path tricks cannot leave the public folder', async () => { for (const p of ['/..%2fetc%2fpasswd.js', '/%2e%2e/x.html', '/a.html%00.png']) expect((await get(p, GZ)).s).toBe(599); });
test('POST and HEAD: POST goes next, HEAD has headers and no body', async () => { expect((await get('/a.html', GZ, 'POST')).s).toBe(599); const h = await get('/a.html', GZ, 'HEAD'); expect(h.s).toBe(200); expect(h.b.length).toBe(0); });
