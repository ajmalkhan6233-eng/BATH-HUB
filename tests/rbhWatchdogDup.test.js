// 21 Nov startup audit: two apex-server entries in pm2 must end as ONE (the online one kept), and a restart goes by id.
const { runOnce } = require('../utils/rbhWatchdog');
const base = over => Object.assign({ now: () => new Date('2026-11-21T09:00:00Z'), port: 3100, sleep: async () => {}, appendLog: async l => log.push(l), readLog: async () => '', readTail: async () => '', hasLocalConfig: async () => true }, over);
let log;
beforeEach(() => { log = []; });
test('duplicate stopped twin is removed, online copy kept, nothing restarted when healthy', async () => {
  const del = [];
  const r = await runOnce(base({ pm2List: async () => [{ id: 1, name: 'apex-server', status: 'stopped' }, { id: 2, name: 'apex-server', status: 'online' }], health: async () => ({ ok: true }), pm2Delete: async id => del.push(id), pm2Save: async () => {} }));
  expect(del).toEqual([1]); expect(r.state).toBe('up'); expect(log.join(' ')).toMatch(/DUPLICATE .*kept id 2/);
});
test('down app is restarted by its id', async () => {
  const restarted = [];
  let h = 0;
  const r = await runOnce(base({ pm2List: async () => [{ id: 2, name: 'apex-server', status: 'stopped' }], health: async () => ({ ok: ++h > 2 }), pm2Restart: async id => restarted.push(id), pm2Start: async () => { throw new Error('no'); } }));
  expect(restarted).toEqual([2]); expect(r.state).toBe('recovered');
});
test('pm2 not answering at boot: waits and retries before starting a second copy', async () => {
  let calls = 0, started = 0;
  const r = await runOnce(base({ pm2List: async () => { if (++calls < 3) throw new Error('not up'); return [{ id: 0, name: 'apex-server', status: 'online' }]; }, health: async () => ({ ok: true }), pm2Start: async () => { started++; } }));
  expect(calls).toBe(3); expect(started).toBe(0); expect(r.state).toBe('up');
});
