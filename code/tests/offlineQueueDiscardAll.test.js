'use strict';
// "Save a copy and discard all" and "Clear and try again" on the SYNC ERROR panel: removes only refused items, clears the error.
global.window = global; global.self = global;
require('../public/offline-queue.js');
const OQ = global.OfflineQueue;
const mk = () => OQ.create({ adapter: OQ.memoryAdapter(), fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({}), text: async () => '' }) });
test('discardAllRejected removes refused items only and returns them', async () => {
  const q = mk(); await q.ready;
  const a = await q.adapter.add({ state: 'rejected', method: 'POST', url: '/api/a', error: 'bad' });
  await q.adapter.add({ state: 'rejected', method: 'POST', url: '/api/b', error: 'bad' });
  await q.adapter.add({ state: 'waiting', method: 'POST', url: '/api/c' });
  await q.refresh();
  expect(q.status().state).toBe('error');
  const gone = await q.discardAllRejected();
  expect(gone.length).toBe(2);
  const left = await q.adapter.all();
  expect(left.map(i => i.url)).toEqual(['/api/c']);
  expect(q.status().rejected).toBe(0);
});
