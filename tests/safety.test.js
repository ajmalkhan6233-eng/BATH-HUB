const { errorHandler, installProcessGuards, _resetForTests } = require('../utils/safety');
const res = () => { const r = { headersSent: false }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; r.type = () => r; r.send = (b) => { r.text = b; return r; }; return r; };
test('api error becomes calm JSON, no stack', () => {
  const r = res(); errorHandler(new Error('db password wrong'), { method: 'GET', originalUrl: '/api/x?a=1' }, r, () => {});
  expect(r.code).toBe(500); expect(r.body.error).toBe('Something went wrong. Please try again.'); expect(JSON.stringify(r.body)).not.toMatch(/password/);
});
test('bad JSON body gives 400, too big gives 413', () => {
  let r = res(); errorHandler({ status: 400, message: 'x' }, { method: 'POST', originalUrl: '/api/x' }, r, () => {}); expect(r.code).toBe(400);
  r = res(); errorHandler({ statusCode: 413 }, { method: 'POST', originalUrl: '/api/x' }, r, () => {}); expect(r.code).toBe(413);
});
test('non-api gets plain text', () => {
  const r = res(); errorHandler(new Error('x'), { method: 'GET', originalUrl: '/page' }, r, () => {}); expect(r.text).toBeTruthy();
});
test('SIGTERM closes server and pool then exits 0; installs once', async () => {
  _resetForTests();
  const h = {}; const proc = { on: (e, f) => { h[e] = f; } };
  let closed = false, ended = false, code = null;
  const server = { close: (cb) => { closed = true; cb(); } }; const pool = { end: async () => { ended = true; } };
  expect(installProcessGuards({ server, pool, exit: (c) => { code = c; }, proc })).toBe(true);
  expect(installProcessGuards({ server, pool, exit: () => {}, proc })).toBe(false);
  h.SIGTERM(); await new Promise((r) => setTimeout(r, 50));
  expect(closed && ended && code).toBeTruthy === undefined; expect(closed).toBe(true); expect(ended).toBe(true); expect(code).toBe(0);
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {}); h.unhandledRejection(new Error('boom')); expect(spy).toHaveBeenCalled(); spy.mockRestore();
});
