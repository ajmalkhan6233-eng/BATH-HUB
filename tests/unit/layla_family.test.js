const { createFamily, familyTick, sourceOf } = require('../../layla_owner/familyBrain');
const { processInbound } = require('../../layla_owner/inbound');
const { loadSettings } = require('../../layla_owner/settings');
const { createSafeSend } = require('../../layla_owner/safeSend');
const { bridgeSendText } = require('../../layla_owner/bridgeSend');

const NOW = new Date('2026-10-15T03:00:00Z'); // 15 Oct 2026, 08:30 Sri Lanka
const WIFE = '0712223344', WIFE_N = '94712223344', OWNER = '0777999219';

// In-memory stores that behave like taskStore + familyStore (same source rules).
function memStores() {
  const tasks = []; let id = 0; const msgs = new Set(); const notes = []; let nid = 0;
  const fam = (t) => String(t.source || 'owner').startsWith('family:');
  const store = {
    tasks,
    async create(t) { const r = { id: ++id, status: 'OPEN', nags_sent: 0, last_sent_at: null, snoozed_until: null, due_at: new Date(t.dueAt), kind: t.kind, title: t.title, source: t.source || 'owner', meta: t.meta, nag_every_min: t.nagEveryMin ?? 60, max_nags: t.maxNags ?? 3 }; tasks.push(r); return r; },
    async listOpen() { return tasks.filter((t) => t.status === 'OPEN' && !fam(t)); },
    async listOpenFor(s) { return tasks.filter((t) => t.status === 'OPEN' && t.source === s); },
    async listOpenFamily() { return tasks.filter((t) => t.status === 'OPEN' && fam(t)); },
    async done(i, s) { const t = tasks.find((x) => x.id === i && x.status === 'OPEN' && (s ? x.source === s : !fam(x))); if (t) t.status = 'DONE'; return t; },
    async snooze(i, until, s) { const t = tasks.find((x) => x.id === i && x.status === 'OPEN' && (s ? x.source === s : !fam(x))); if (t) { t.snoozed_until = until; t.nags_sent = 0; } return t; },
    async markSent(i, at) { const t = tasks.find((x) => x.id === i); t.nags_sent++; t.last_sent_at = at; return t; },
    async remember(waId) { if (waId && msgs.has(waId)) return false; if (waId) msgs.add(waId); return true; },
  };
  const notesStore = {
    notes,
    async add(k, b) { const r = { id: ++nid, k, body: b }; notes.push(r); return r; },
    async count(k) { return notes.filter((n) => n.k === k).length; },
    async list(k) { return notes.filter((n) => n.k === k).reverse(); },
    async find(k, q) { return notes.filter((n) => n.k === k && n.body.toLowerCase().includes(q.toLowerCase())).reverse(); },
    async remove(k, i) { const ix = notes.findIndex((n) => n.k === k && n.id === i); if (ix < 0) return false; notes.splice(ix, 1); return true; },
  };
  return { store, notesStore };
}
function setup() {
  const { store, notesStore } = memStores(); const sent = [];
  const family = createFamily({ numbers: [WIFE], store, notes: notesStore, now: () => NOW });
  const deps = { store, adapters: { stock: async () => { throw new Error('shop data must never be read for family'); }, cashGap: async () => { throw new Error('shop data'); }, payable: async () => { throw new Error('shop data'); } }, ownerNumber: OWNER, family, now: () => NOW, send: async (to, t) => sent.push([to, t]) };
  const wife = (text, id) => processInbound({ id: id || 'w' + Math.random(), from: WIFE_N, type: 'text', text, ts: NOW / 1000 }, deps);
  const owner = (text) => processInbound({ id: 'o' + Math.random(), from: '94777999219', type: 'text', text, ts: NOW / 1000 }, deps);
  return { store, notesStore, sent, wife, owner, family };
}

test('family member is recognised; others are not', () => { const { family } = setup(); expect(family.isMember(WIFE)).toBe(true); expect(family.isMember('94712223344')).toBe(true); expect(family.isMember('0719998877')).toBe(false); });
test('her reminder is stored under HER source, with her number, and confirmed', async () => {
  const { wife, store, sent } = setup(); const r = await wife('remind me tomorrow morning to call mum'); expect(r.status).toBe('family');
  expect(store.tasks).toHaveLength(1); expect(store.tasks[0].source).toBe(sourceOf(WIFE)); expect(store.tasks[0].meta.number).toBe(WIFE_N); expect(store.tasks[0].title).toMatch(/call mum/i);
  expect(sent[0][0]).toBe(WIFE_N); expect(sent[0][1]).toMatch(/Reminder set for/);
});
test('"12 o\'clock" style times are confirmed back to her in plain time', async () => {
  const { wife, sent } = setup(); await wife('remind me at 12 to take the medicine'); expect(sent[0][1]).toMatch(/Reminder set for 2026-10-15 12:00 pm|Reminder set for 2026-10-16/);
});
test('ISOLATION: the owner never sees her reminders and she never sees his', async () => {
  const { wife, owner, sent, store } = setup();
  await owner('remind me tomorrow evening to pay Eskema'); await wife('remind me tomorrow to call mum');
  sent.length = 0; await owner("what's pending"); expect(sent[0][1]).toMatch(/Eskema/); expect(sent[0][1]).not.toMatch(/mum/);
  sent.length = 0; await wife("what's pending"); expect(sent[0][1]).toMatch(/mum/); expect(sent[0][1]).not.toMatch(/Eskema/);
  expect((await store.listOpen()).some((t) => /mum/.test(t.title))).toBe(false);
});
test('ISOLATION: she cannot close the owner task by id, and the owner cannot close hers', async () => {
  const { wife, owner, sent, store } = setup(); await owner('remind me tomorrow evening to pay Eskema'); await wife('remind me tomorrow to call mum');
  const ownerId = store.tasks.find((t) => t.source === 'owner').id, wifeId = store.tasks.find((t) => t.source !== 'owner').id;
  sent.length = 0; await wife(`done ${ownerId}`); expect(sent[0][1]).toMatch(/could not find/); expect(store.tasks.find((t) => t.id === ownerId).status).toBe('OPEN');
  sent.length = 0; await owner(`done ${wifeId}`); expect(sent[0][1]).toMatch(/could not find/); expect(store.tasks.find((t) => t.id === wifeId).status).toBe('OPEN');
  sent.length = 0; await wife(`done ${wifeId}`); expect(sent[0][1]).toMatch(/Done:/);
});
test('SHOP DATA BLOCKED: stock, cash gap, payable, plans, brief, cheques get one polite line and read nothing', async () => {
  const { wife, sent } = setup();
  for (const q of ['stock of angle valve', 'cash gap', 'how much do we owe Eskema', 'plan 680000 Metro 4 months', 'brief', 'I wrote a 1 million cheque to Metro', 'Fazal Hardware bill pending, remind me by evening']) {
    sent.length = 0; const r = await wife(q); expect(r.status).toBe('family'); expect(sent[0][1]).toMatch(/only keep reminders and notes/);
  }
});
test('notes: save, list, find, delete, and they are private to each person', async () => {
  const { wife, sent, notesStore } = setup();
  await wife('note: plumber Rahim 077 123 4567'); expect(sent[0][1]).toMatch(/Saved note #1/);
  sent.length = 0; await wife('notes'); expect(sent[0][1]).toMatch(/plumber Rahim/);
  sent.length = 0; await wife('find plumber'); expect(sent[0][1]).toMatch(/#1/);
  expect(await notesStore.find('999999999', 'plumber')).toHaveLength(0);                 // another user key sees nothing
  sent.length = 0; await wife('delete note 1'); expect(sent[0][1]).toMatch(/Deleted note #1/);
  sent.length = 0; await wife('notes'); expect(sent[0][1]).toMatch(/No notes yet/);
});
test('"notes" alone is a list request, not a note called "s"', async () => { const { wife, sent, notesStore } = setup(); await wife('notes'); expect(notesStore.notes).toHaveLength(0); expect(sent[0][1]).toMatch(/No notes yet/); });
test('her words are NOT written to the shared message log (remember gets an empty body)', async () => {
  const { store, family, sent } = setup(); const seen = []; store.remember = async (id, dir, kind, body) => { seen.push([kind, body]); return true; };
  await processInbound({ id: 'x1', from: WIFE_N, type: 'text', text: 'note: secret thing', ts: NOW / 1000 }, { store, family, ownerNumber: OWNER, send: async (to, t) => sent.push(t), now: () => NOW });
  expect(seen).toEqual([['family', '']]);
});
test('media from her: text-only answer, nothing downloaded', async () => {
  const { store, family, sent } = setup(); let downloaded = false;
  await processInbound({ id: 'x2', from: WIFE_N, type: 'image', mediaId: 'm', ts: NOW / 1000 }, { store, family, ownerNumber: OWNER, send: async (to, t) => sent.push(t), download: async () => { downloaded = true; }, now: () => NOW });
  expect(downloaded).toBe(false); expect(sent[0]).toMatch(/text messages only/);
});
test('duplicate delivery is ignored; rate limit stops floods', async () => {
  const { family, store, sent } = setup(); const base = { store, family, ownerNumber: OWNER, send: async (to, t) => sent.push(t), now: () => NOW };
  const m = { id: 'dup', from: WIFE_N, type: 'text', text: 'help', ts: NOW / 1000 };
  expect((await processInbound(m, base)).status).toBe('family'); expect((await processInbound(m, base)).status).toBe('duplicate');
  expect((await processInbound({ ...m, id: 'n2' }, { ...base, familyRateLimit: () => false })).status).toBe('rate_limited');
});
test('a stranger is still ignored; the owner path is unchanged', async () => {
  const { store, family, sent } = setup(); const base = { store, family, adapters: {}, ownerNumber: OWNER, send: async (to, t) => sent.push([to, t]), now: () => NOW };
  expect((await processInbound({ id: 's1', from: '94719998877', type: 'text', text: 'help', ts: NOW / 1000 }, base)).status).toBe('ignored'); expect(sent).toHaveLength(0);
  expect((await processInbound({ id: 'o1', from: '94777999219', type: 'text', text: 'help', ts: NOW / 1000 }, base)).status).toBe('ok'); expect(sent[0][1]).toMatch(/Talk to me like a person/);
});
test('REMINDER SENDER: a due family reminder goes to HER number only, once per nag; owner tick never sees it', async () => {
  const { wife, store } = setup(); await wife('remind me today to call mum'); store.tasks[0].due_at = new Date(NOW.getTime() - 60000);
  const sent = []; const r = await familyTick({ store, send: async (to, t) => sent.push([to, t]), now: () => NOW });
  expect(r.sent).toBe(1); expect(sent[0][0]).toBe(WIFE_N); expect(sent[0][1]).toMatch(/call mum/);
  const again = await familyTick({ store, send: async (to, t) => sent.push([to, t]), now: () => NOW }); expect(again.sent).toBe(0);           // spaced nags: not again right away
  expect(await store.listOpen()).toHaveLength(0);
});
test('settings: family numbers parsed, shop/owner/Layla numbers can never be family, masked in describe', () => {
  const S = loadSettings({ FAMILY_WA_NUMBERS: '0712223344, 0740355536 ; 0777999219 , 0712223344', LAYLA_WA_NUMBER: '0771112233' });
  expect(S.familyNumbers).toEqual(['94712223344']);
  const { describe } = require('../../layla_owner/settings'); expect(JSON.stringify(describe(S).family)).toBe('["***344"]');
});
test('sender: live family reminders reach her number; any other number is still blocked', async () => {
  const S = loadSettings({ LAYLA_TRANSPORT: 'bridge', LAYLA_OWNER_LIVE: 'true', FAMILY_WA_NUMBERS: WIFE }); const calls = [];
  const f = async (url, o) => { calls.push(JSON.parse(o.body)); return { ok: true, json: async () => ({}) }; };
  const send = createSafeSend({ settings: S, sendText: bridgeSendText, fetchFn: f, log() {} });
  await send(WIFE_N, 'x'); const blocked = await send('94719998877', 'x');
  expect(calls).toHaveLength(1); expect(calls[0].to).toBe(WIFE_N); expect(blocked).toMatchObject({ blocked: true });
});
