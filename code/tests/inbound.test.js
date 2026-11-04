const { newDb } = require('pg-mem');
const { migrate } = require('../scripts/migrate_layla_owner');
const { migrate: migrateLedger } = require('../scripts/migrate_vendor_ledger');
const createStore = require('../layla_owner/taskStore');
const createAdapters = require('../layla_owner/adapters');
const { processInbound } = require('../layla_owner/inbound');
const W = require('../layla_owner/waCloud');
const { pollOnce } = require('../layla_owner/relayPoller');
const { transcribe } = require('../layla_owner/transcribe');
let store, adapters, sent, deps; const now = () => new Date('2026-10-04T04:30:00Z');
beforeAll(async () => { const { Pool } = newDb().adapters.createPg(); const pool = new Pool(); await migrate(pool); await migrateLedger(pool); store = createStore(pool); adapters = createAdapters({ pool }); });
beforeEach(() => { sent = []; deps = { store, adapters, now, ownerNumber: '0777999219', send: async (to, t) => sent.push([to, t]),
  download: async () => ({ buffer: Buffer.from('x'), mime: 'audio/ogg; codecs=opus' }), transcribe: async () => ({ ok: true, text: 'Fazal Hardware has a bill pending remind me this evening' }), saveMedia: async () => 'uploads/layla-inbox/abc.jpg' }; });

test('a stranger gets no reply and nothing is revealed', async () => {
  const r = await processInbound({ id: 'a1', from: '94771112222', type: 'text', text: 'cheques tomorrow' }, deps);
  expect(r.status).toBe('ignored'); expect(sent).toHaveLength(0);
});
test('owner text is answered', async () => {
  const r = await processInbound({ id: 'a2', from: '94777999219', type: 'text', text: 'remind me to call Pioneer at 4pm' }, deps);
  expect(r.status).toBe('ok'); expect(sent[0][0]).toBe('94777999219'); expect(sent[0][1]).toContain('Reminder set');
});
test('a duplicate delivery is ignored', async () => {
  await processInbound({ id: 'a3', from: '94777999219', type: 'text', text: 'help' }, deps);
  expect((await processInbound({ id: 'a3', from: '94777999219', type: 'text', text: 'help' }, deps)).status).toBe('duplicate'); expect(sent).toHaveLength(1);
});
test('a voice note is transcribed, echoed back, and acted on', async () => {
  const r = await processInbound({ id: 'a4', from: '94777999219', type: 'audio', mediaId: 'm1' }, deps);
  expect(r.status).toBe('ok'); expect(sent[0][1]).toContain('I heard: "Fazal Hardware has a bill pending'); expect(sent[0][1]).toContain('remind you');
});
test('a voice note that cannot be heard asks for a retry', async () => {
  deps.transcribe = async () => ({ ok: false }); const r = await processInbound({ id: 'a5', from: '94777999219', type: 'audio', mediaId: 'm2' }, deps);
  expect(r.status).toBe('transcribe_failed'); expect(sent[0][1]).toContain('could not hear');
});
test('a photo is saved; with a pending-bill caption it makes a reminder', async () => {
  const r = await processInbound({ id: 'a6', from: '94777999219', type: 'image', mediaId: 'm3', caption: 'Eskema bill 213200 not entered in the GRN' }, deps);
  expect(r.status).toBe('ok'); expect(sent[0][1]).toContain('Saved the image'); expect(sent[0][1]).toContain('Eskema');
});
test('a photo without a caption makes a review task', async () => {
  await processInbound({ id: 'a7', from: '94777999219', type: 'image', mediaId: 'm4' }, deps); expect(sent[0][1]).toContain('made task');
});
test('errors never crash or leak', async () => {
  deps.download = async () => { throw new Error('secret token abc'); }; await processInbound({ id: 'a8', from: '94777999219', type: 'audio', mediaId: 'm5' }, deps);
  expect(sent[0][1]).toBe('Something went wrong on my side. Please try again.');
});
test('webhook payloads parse', () => {
  const body = { entry: [{ changes: [{ value: { messages: [{ id: 'w1', from: '94777999219', timestamp: '1', type: 'text', text: { body: 'hi' } }, { id: 'w2', from: '94777999219', type: 'audio', audio: { id: 'A1', mime_type: 'audio/ogg; codecs=opus' } }, { id: 'w3', from: '94777999219', type: 'image', image: { id: 'I1', caption: 'x' } }] } }] }] };
  expect(W.parseWebhook(body).map((x) => [x.type, x.text || x.mediaId])).toEqual([['text', 'hi'], ['audio', 'A1'], ['image', 'I1']]);
});
test('sending is a dry run unless live, and never throws a token', async () => {
  expect(await W.sendText('94777999219', 'hi', { live: false })).toEqual({ dryRun: true });
  const f = async () => ({ ok: false, status: 401 }); await expect(W.sendText('9', 'hi', { live: true, token: 'SECRETTOKEN', phoneId: '1', version: 'v21.0' }, f)).rejects.toThrow('HTTP 401');
});
test('media download enforces the size limit', async () => {
  const f = async (u) => (u.includes('/M1') ? { ok: true, json: async () => ({ url: 'https://x/y', mime_type: 'audio/ogg', file_size: 99999999 }) } : { ok: true, arrayBuffer: async () => new ArrayBuffer(4) });
  await expect(W.downloadMedia('M1', { token: 't', version: 'v21.0' }, 1000, f)).rejects.toThrow('too large');
});
test('relay poller handles items, acks only what succeeded', async () => {
  const ok = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ id: 'r1', from: '94777999219', type: 'text', text: { body: 'help' } }] } }] }] });
  const calls = []; const f = async (u, o) => { calls.push(u); return u.endsWith('/pull') ? { ok: true, json: async () => ({ items: [{ key: 'm:1', body: ok }, { key: 'm:2', body: 'not json' }] }) } : { ok: true }; };
  const handled = []; const r = await pollOnce({ url: 'https://w', secret: 's', fetchFn: f, handle: async (m) => handled.push(m.id) });
  expect(r).toEqual({ pulled: 2, acked: 1 }); expect(handled).toEqual(['r1']); expect(calls).toContain('https://w/ack');
});
test('transcribe never throws when python is missing', async () => {
  const { EventEmitter } = require('events'); const fake = () => { const p = new EventEmitter(); p.stdout = new EventEmitter(); p.kill = () => {}; setImmediate(() => p.emit('error', new Error('ENOENT'))); return p; };
  expect((await transcribe(Buffer.from('x'), 'audio/ogg', { spawnFn: fake })).ok).toBe(false);
});
test('transcribe parses a good result', async () => {
  const { EventEmitter } = require('events'); const fake = () => { const p = new EventEmitter(); p.stdout = new EventEmitter(); p.kill = () => {}; setImmediate(() => { p.stdout.emit('data', '{"text":"hello","language":"en"}'); p.emit('close', 0); }); return p; };
  expect(await transcribe(Buffer.from('x'), 'audio/ogg', { spawnFn: fake })).toEqual({ ok: true, text: 'hello', language: 'en' });
});
