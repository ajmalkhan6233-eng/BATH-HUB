test('the same save pressed twice is sent once; reads are not touched', async () => {
  let sent = 0; let release;
  const root = { fetch: () => { sent++; return new Promise((ok) => { release = () => ok({ clone() { return this; }, ok: true }); }); } };
  global.window = root; require('../../public/one-click.js');
  const a = root.fetch('/api/x', { method: 'POST', body: '{"a":1}' });
  const b = root.fetch('/api/x', { method: 'POST', body: '{"a":1}' });
  expect(sent).toBe(1);
  release(); await Promise.all([a, b]);
  await Promise.resolve();
  root.fetch('/api/x', { method: 'POST', body: '{"a":1}' }); expect(sent).toBe(2);
  root.fetch('/api/x'); root.fetch('/api/x'); expect(sent).toBe(4);
  delete global.window;
});
