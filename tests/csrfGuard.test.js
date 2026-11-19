const { csrfGuard } = require('../utils/csrfGuard');
const run = (mw, { method = 'POST', origin, cookie, host = 'shop.local:3100', xfh } = {}) => {
  const h = { origin, host, cookie, 'x-forwarded-host': xfh };
  const req = { method, originalUrl: '/api/x', headers: h, get: (k) => h[k.toLowerCase()] };
  const out = {}; const res = { status: (c) => { out.code = c; return res; }, json: (b) => { out.body = b; return res; } };
  let passed = false; mw(req, res, () => { passed = true; }); return { passed, ...out };
};
const mw = csrfGuard({ allowed: 'https://friend.example' });
test('same site with login cookie passes', () => expect(run(mw, { origin: 'http://shop.local:3100', cookie: 'connect.sid=abc' }).passed).toBe(true));
test('other site with login cookie is refused', () => { const r = run(mw, { origin: 'https://evil.com', cookie: 'connect.sid=abc' }); expect(r.passed).toBe(false); expect(r.code).toBe(403); });
test('other site without login cookie passes (public forms)', () => expect(run(mw, { origin: 'https://site.netlify.app' }).passed).toBe(true));
test('no Origin header passes (webhooks, scripts)', () => expect(run(mw, { cookie: 'connect.sid=abc' }).passed).toBe(true));
test('GET always passes', () => expect(run(mw, { method: 'GET', origin: 'https://evil.com', cookie: 'connect.sid=abc' }).passed).toBe(true));
test('tunnel host via x-forwarded-host passes', () => expect(run(mw, { origin: 'https://rbh.example.com', cookie: 'connect.sid=a', xfh: 'rbh.example.com' }).passed).toBe(true));
test('allowed list passes', () => expect(run(mw, { origin: 'https://friend.example', cookie: 'connect.sid=a' }).passed).toBe(true));
