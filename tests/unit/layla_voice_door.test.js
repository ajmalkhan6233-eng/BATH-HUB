'use strict';
// Sinhala voice reader + the one Layla door. Network, database and the browser are all faked. Nothing here files money.
jest.mock('pg', () => require('../helpers/pgmock')());

const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const request = require('supertest');
const pg = require('pg');

const { cleanVoice, geminiVoice } = require('../../utils/geminiVoice');
const { transcribe } = require('../../layla_owner/transcribe');
const { processInbound } = require('../../layla_owner/inbound');
const door = require('../../public/layla-door.js');

describe('cleanVoice: what Gemini said becomes a safe shape', () => {
  test('an expense list with no stated total is summed from the lines (1,700)', () => {
    const c = cleanVoice({ text: 'x', entry: { kind: 'expense_list', items: [{ name: 'tea', amount: '200' }, { name: 'petrol', amount: '1,500' }] } });
    expect(c.entry.total_expenses).toBe(1700); expect(c.warnings).toEqual([]);
  });
  test('a stated total that disagrees with the lines is flagged, not silently trusted', () => {
    const c = cleanVoice({ text: 'x', entry: { kind: 'expense_list', total_expenses: 2000, items: [{ name: 'tea', amount: 200 }, { name: 'petrol', amount: 1500 }] } });
    expect(c.warnings.join(' ')).toMatch(/add up to 1700/);
  });
  test('an expense list without any amount becomes "none" (never a guessed figure)', () => {
    expect(cleanVoice({ text: 'x', entry: { kind: 'expense_list', items: [{ name: 'tea' }] } }).entry.kind).toBe('none');
  });
  test('a day sheet needs a total sale', () => {
    expect(cleanVoice({ text: 'x', entry: { kind: 'day_sheet', cash_sale: 5000 } }).entry.kind).toBe('none');
    expect(cleanVoice({ text: 'x', entry: { kind: 'day_sheet', total_sale: 150000, cash_sale: '100,000' } }).entry).toMatchObject({ kind: 'day_sheet', total_sale: 150000, cash_sale: 100000 });
  });
  test('negative, text and absurd values never get through; bad input never throws', () => {
    const c = cleanVoice({ text: 'x', entry: { kind: 'day_sheet', total_sale: 1000, cash_sale: -5, card_sale: 'abc' } });
    expect(c.entry.cash_sale).toBeNull(); expect(c.entry.card_sale).toBeNull();
    expect(() => cleanVoice(null)).not.toThrow(); expect(cleanVoice('junk').entry.kind).toBe('none');
  });
  test('a bad date is dropped', () => {
    expect(cleanVoice({ text: 'x', entry: { kind: 'expense_list', date: '18/10/2026', total_expenses: 10 } }).entry.date).toBe('');
  });
});

describe('geminiVoice: one call, never throws', () => {
  const ok = body => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(body) }] } }] }) });
  const listModels = async () => ['gemini-flash-a', 'gemini-flash-b'];
  const good = { text: 'අද තේ 200', english: 'today tea 200', language: 'si', entry: { kind: 'expense_list', items: [{ name: 'tea', amount: 200 }] }, confidence: 'high' };
  test('no key / empty audio', async () => {
    expect((await geminiVoice({ key: '', buffer: Buffer.from('x') })).ok).toBe(false);
    expect((await geminiVoice({ key: 'k', buffer: Buffer.alloc(0) })).ok).toBe(false);
  });
  test('success: Sinhala text, English version and the figures; audio is sent inline as base64', async () => {
    const fetchFn = jest.fn(async () => ok(good));
    const r = await geminiVoice({ key: 'k', buffer: Buffer.from('abc'), mime: 'audio/ogg; codecs=opus', fetchFn, listModels });
    expect(r).toMatchObject({ ok: true, text: 'අද තේ 200', english: 'today tea 200', language: 'si', model: 'gemini:gemini-flash-a' });
    expect(r.entry.total_expenses).toBe(200);
    const sent = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(sent.contents[0].parts[1].inline_data).toEqual({ mime_type: 'audio/ogg', data: Buffer.from('abc').toString('base64') });
  });
  test('a busy model (429) falls through to the next one', async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({ error: { message: 'busy' } }) })
      .mockResolvedValueOnce(ok(good));
    const r = await geminiVoice({ key: 'k', buffer: Buffer.from('abc'), fetchFn, listModels });
    expect(r.ok).toBe(true); expect(r.model).toBe('gemini:gemini-flash-b');
  });
  test('silence / no speech and network errors come back as ok:false', async () => {
    expect((await geminiVoice({ key: 'k', buffer: Buffer.from('a'), listModels, fetchFn: async () => ok({ text: '', entry: {} }) })).reason).toBe('no speech found');
    const r = await geminiVoice({ key: 'k', buffer: Buffer.from('a'), listModels, fetchFn: async () => { throw new Error('network down'); } });
    expect(r.ok).toBe(false);
  });
});

describe('transcribe: Gemini first, the local reader as the backup', () => {
  test('Gemini works: the ENGLISH version feeds the existing parser, the original is kept', async () => {
    const t = await transcribe(Buffer.from('x'), 'audio/ogg', { key: 'k', geminiFn: async () => ({ ok: true, text: 'අද තේ 200', english: 'tea 200 today', language: 'si', entry: { kind: 'none' }, model: 'gemini:x' }) });
    expect(t).toMatchObject({ ok: true, text: 'tea 200 today', original: 'අද තේ 200', language: 'si', engine: 'gemini:x' });
  });
  test('Gemini fails: the local script is used', async () => {
    const spawnFn = () => { const h = {}; return { stdout: { on: (e, f) => { if (e === 'data') setImmediate(() => f(JSON.stringify({ text: 'hello', language: 'en' }))); } }, on: (e, f) => { h[e] = f; if (e === 'close') setImmediate(() => f(0)); }, kill() {} }; };
    const t = await transcribe(Buffer.from('x'), 'audio/ogg', { key: 'k', geminiFn: async () => ({ ok: false, reason: 'quota' }), spawnFn });
    expect(t).toMatchObject({ ok: true, text: 'hello' });
  });
  test('no key: straight to the local script (old behaviour)', async () => {
    const geminiFn = jest.fn();
    const spawnFn = () => ({ stdout: { on() {} }, on: (e, f) => { if (e === 'error') setImmediate(f); }, kill() {} });
    const t = await transcribe(Buffer.from('x'), 'audio/ogg', { key: '', geminiFn, spawnFn });
    expect(geminiFn).not.toHaveBeenCalled(); expect(t.ok).toBe(false);
  });
});

describe('inbound: a dictated day becomes a DRAFT, never a filing', () => {
  const { newDb } = require('pg-mem');
  const { migrate } = require('../../scripts/migrate_layla_owner');
  const createStore = require('../../layla_owner/taskStore');
  const createAdapters = require('../../layla_owner/adapters');
  let deps, sent, drafts;
  beforeAll(async () => {
    const { Pool } = newDb().adapters.createPg(); const pool = new Pool(); await migrate(pool);
    const store = createStore(pool), adapters = createAdapters({ pool });
    deps = { store, adapters, now: () => new Date('2026-10-18T04:30:00Z'), ownerNumber: '0777999219' };
  });
  beforeEach(() => {
    sent = []; drafts = [];
    deps.send = async (to, t) => sent.push(t);
    deps.download = async () => ({ buffer: Buffer.from('x'), mime: 'audio/ogg' });
    deps.voiceDraft = async a => { drafts.push(a); return { id: 7, extracted: { date: '2026-10-18' } }; };
  });
  test('expenses spoken in Sinhala: one draft, reply says nothing is filed, original wording shown', async () => {
    deps.transcribe = async () => ({ ok: true, text: 'tea 200 petrol 1500', original: 'තේ 200 පෙට්‍රල් 1500', entry: { kind: 'expense_list', total_expenses: 1700, items: [] }, warnings: [], confidence: 'high', engine: 'gemini:x' });
    const r = await processInbound({ id: 'v1', from: '94777999219', type: 'audio', mediaId: 'm' }, deps);
    expect(r).toMatchObject({ status: 'ok', intent: 'voice_draft', draftId: 7 });
    expect(drafts).toHaveLength(1);
    expect(sent[0]).toContain('I heard: "තේ 200 පෙට්‍රල් 1500"'); expect(sent[0]).toContain('draft #7'); expect(sent[0]).toContain('NOTHING is filed yet'); expect(sent[0]).toContain('Rs 1,700');
  });
  test('a low-confidence number is called out', async () => {
    deps.transcribe = async () => ({ ok: true, text: 'x', entry: { kind: 'day_sheet', total_sale: 90000 }, warnings: ['check both'], confidence: 'low' });
    await processInbound({ id: 'v2', from: '94777999219', type: 'audio', mediaId: 'm' }, deps);
    expect(sent[0]).toContain('not sure about some numbers'); expect(sent[0]).toContain('check both'); expect(sent[0]).toContain('Sales draft');
  });
  test('an ordinary voice note (a reminder) still goes the old way and makes no draft', async () => {
    deps.transcribe = async () => ({ ok: true, text: 'remind me to call Pioneer at 4pm', entry: { kind: 'none' } });
    const r = await processInbound({ id: 'v3', from: '94777999219', type: 'audio', mediaId: 'm' }, deps);
    expect(r.status).toBe('ok'); expect(drafts).toHaveLength(0); expect(sent[0]).toContain('Reminder set');
  });
  test('a stranger voice note is ignored and never listened to', async () => {
    deps.transcribe = jest.fn();
    const r = await processInbound({ id: 'v4', from: '94771112222', type: 'audio', mediaId: 'm' }, deps);
    expect(r.status).toBe('ignored'); expect(deps.transcribe).not.toHaveBeenCalled(); expect(drafts).toHaveLength(0);
  });
});

describe('Document Inbox route: voice notes and PDFs', () => {
  const db = pg.__db.public;
  const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'voiceinbox-'));
  const { createRouter, sniff } = require('../../routes/document_inbox');
  let voiceAnswer, ocrAnswer;
  const voice = jest.fn(async () => voiceAnswer);
  const ocr = jest.fn(async () => ocrAnswer);
  const router = createRouter(new pg.Pool(), { ocr, inboxRoot: ROOT, voice, fileDaySheet: async () => ({ message: 'x' }) });
  const mk = role => { const a = express(); a.use(express.json()); a.use((req, _r, n) => { req.session = role ? { user: { role, username: 'aj' } } : undefined; n(); }); a.use('/api', router); return a; };
  const owner = mk('owner');
  const OGG = Buffer.concat([Buffer.from('OggS'), Buffer.alloc(40, 1)]);
  const M4A = Buffer.concat([Buffer.alloc(4), Buffer.from('ftypM4A '), Buffer.alloc(40, 1)]);
  const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(40, 1)]);
  afterAll(() => fs.rmSync(ROOT, { recursive: true, force: true }));

  test('sniff recognises voice-note formats by their bytes, and still refuses other files', () => {
    expect(sniff(OGG)).toBe('ogg'); expect(sniff(M4A)).toBe('m4a');
    expect(sniff(Buffer.concat([Buffer.from('ID3'), Buffer.alloc(40)]))).toBe('mp3');
    expect(sniff(Buffer.from('MZ not a paper at all, just some text bytes here'))).toBeNull();
  });
  test('staff cannot upload a voice note', async () => {
    expect((await request(mk('staff')).post('/api/document-inbox/upload').attach('photo', OGG, 'v.ogg')).status).toBe(403);
  });
  test('a dictated expense list becomes ONE expense_sheet draft with the audio kept to play back', async () => {
    voiceAnswer = { ok: true, text: 'තේ 200 පෙට්‍රල් 1500', english: 'tea 200 petrol 1500', model: 'gemini:x', confidence: 'high', warnings: [], entry: { kind: 'expense_list', date: '', total_expenses: 1700, items: [{ name: 'tea', amount: 200 }, { name: 'petrol', amount: 1500 }] } };
    const r = await request(owner).post('/api/document-inbox/upload').attach('photo', OGG, 'v.ogg');
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ source: 'voice', doc_type: 'expense_sheet', status: 'to_check', fileable: true });
    expect(r.body.extracted).toMatchObject({ total_expenses: 1700, expense_items: 'tea 200; petrol 1500' });
    expect(r.body.extracted.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.body.reader_note).toContain('තේ 200'); expect(r.body.reader_note).toContain('today was used');
    expect(r.body.file_path).toMatch(/\.ogg$/);
    const played = await request(owner).get(`/api/document-inbox/${r.body.id}/photo`);
    expect(played.status).toBe(200); expect(String(played.headers['content-type'])).toMatch(/ogg|audio|octet/);
    // nothing was filed: it waits for Confirm
    expect(db.many(`SELECT status FROM document_inbox WHERE id = ${r.body.id}`)[0].status).toBe('to_check');
  });
  test('a voice note that is not a list is kept, not guessed: unknown type, what was heard shown', async () => {
    voiceAnswer = { ok: true, text: 'Pioneer ekata call karanna', english: 'call Pioneer', entry: { kind: 'none' } };
    const r = await request(owner).post('/api/document-inbox/upload').attach('photo', M4A, 'v.m4a');
    expect(r.status).toBe(201); expect(r.body.doc_type).toBe('unknown'); expect(r.body.fileable).toBe(false);
    expect(r.body.reader_note).toContain('Heard: "Pioneer ekata call karanna"');
  });
  test('a voice note that cannot be heard is still kept, with the reason', async () => {
    voiceAnswer = { ok: false, reason: 'quota' };
    const r = await request(owner).post('/api/document-inbox/upload').attach('photo', OGG, 'v.ogg');
    expect(r.status).toBe(201); expect(r.body.reader_note).toContain('Could not listen');
  });
  test('a PDF is now READ (it used to be saved unread) when a reader is available', async () => {
    ocrAnswer = { document_type: 'grn', confidence: 'high', grn_number: 'G-1', date: '2026-10-17', supplier_name: 'Lanka Tiles', total: 1000, items: [{ item_code: '1001', description: 'Marble Tile 60x60', qty: 2, unit_cost: 500, amount: 1000 }] };
    const r = await request(owner).post('/api/document-inbox/upload').attach('photo', PDF, 'inv.pdf');
    expect(r.status).toBe(201); expect(r.body.doc_type).toBe('grn'); expect(r.body.extracted.items).toHaveLength(1);
    expect(r.body.status).toBe('to_check');
  });
});

describe('layla-door.js: what the screen says', () => {
  test('success says it was read as a type and that NOTHING is filed', () => {
    const o = door.describe('', 201, { id: 9, type_label: 'GRN (goods received)', reader_note: '' });
    expect(o.ok).toBe(true); expect(o.text).toContain('#9'); expect(o.text).toContain('GRN (goods received)'); expect(o.text).toContain('Nothing is filed yet');
  });
  test('non-owner, offline and server errors are plain words', () => {
    expect(door.describe('', 403, {}).text).toMatch(/Only the owner/);
    expect(door.describe('offline').text).toMatch(/No connection/);
    expect(door.describe('', 400, { error: 'That file is not a photo' }).text).toBe('That file is not a photo');
    expect(door.describe('', 500, {}).ok).toBe(false);
  });
});

describe('the bridge inbox folder: voice notes and PDFs are allowed for Layla chat only', () => {
  const { safeInboxPath, safeInboxMediaPath } = require('../../middleware/webhookAuth');
  const root = path.join(os.tmpdir(), 'inbox-root-x');
  test('the exact file the bridge saved for a voice note is accepted (this was the 17:30 failure)', () => {
    expect(safeInboxMediaPath(path.join(root, '2026-10-18', '1792324828724-layla-audio.ogg'), root)).toBeTruthy();
    for (const e of ['opus', 'm4a', 'mp3', 'wav', 'pdf', 'jpg', 'png']) expect(safeInboxMediaPath(path.join(root, `a.${e}`), root)).toBeTruthy();
  });
  test('still refuses anything outside the folder, odd types and tricks', () => {
    expect(safeInboxMediaPath(path.resolve('.env'), root)).toBeNull();
    expect(safeInboxMediaPath(path.join(root, '..', 'evil', 'a.ogg'), root)).toBeNull();
    expect(safeInboxMediaPath(path.join(root, '..', '..', 'a.ogg'), root)).toBeNull();
    expect(safeInboxMediaPath(path.join(root, 'a.exe'), root)).toBeNull();
    expect(safeInboxMediaPath(path.join(root, 'a.ogg\0.txt'), root)).toBeNull();
    expect(safeInboxMediaPath('', root)).toBeNull(); expect(safeInboxMediaPath(null, root)).toBeNull();
  });
  test('the PHOTO webhook still refuses audio and PDFs (they must never reach the photo reader)', () => {
    expect(safeInboxPath(path.join(root, 'a.ogg'), root)).toBeNull(); expect(safeInboxPath(path.join(root, 'a.pdf'), root)).toBeNull();
    expect(safeInboxPath(path.join(root, 'a.jpg'), root)).toBeTruthy();
  });
  test('end to end: a bridge voice note reaches the voice draft instead of "media path not allowed"', async () => {
    const { createBridgeIn } = require('../../layla_owner/bridgeIn');
    const { newDb } = require('pg-mem'); const { migrate } = require('../../scripts/migrate_layla_owner');
    const createStore = require('../../layla_owner/taskStore'); const createAdapters = require('../../layla_owner/adapters');
    const { Pool } = newDb().adapters.createPg(); const pool = new Pool(); await migrate(pool);
    const file = path.join(root, '2026-10-18', 'v.ogg'); const drafts = [];
    const bridgeIn = createBridgeIn({ inboxRoot: root, safeInboxPath: safeInboxMediaPath, readFile: async () => Buffer.from('x'), stat: async () => ({ size: 10 }),
      deps: () => ({ store: createStore(pool), adapters: createAdapters({ pool }), ownerNumber: '0777999219',
        transcribe: async () => ({ ok: true, text: 'tea 200 petrol 1500', original: 'tea 200 petrol 1500', entry: { kind: 'expense_list', total_expenses: 1700, items: [] } }),
        voiceDraft: async a => { drafts.push(a); return { id: 3, extracted: { date: '2026-10-18' } }; }, saveMedia: async () => file }) });
    const r = await bridgeIn({ from: '94777999219', id: 'bv1', type: 'audio', filePath: file, mime: 'audio/ogg; codecs=opus' });
    expect(r.status).toBe('ok'); expect(drafts).toHaveLength(1); expect(r.replies.join('\n')).toContain('draft #3');
    expect(r.replies.join('\n')).not.toContain('Something went wrong');
  });
});

describe('geminiVoice under overload (503)', () => {
  const { geminiVoice } = require('../../utils/geminiVoice');
  const ok = { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ text: 'tea 200', english: 'tea 200', language: 'en', entry: { kind: 'none' }, confidence: 'high' }) }] } }] }) };
  test('retries the next model after a 503 and waits between tries', async () => {
    const calls = []; const waits = [];
    const fetchFn = async (url) => { calls.push(url); return calls.length < 3 ? { ok: false, status: 503, json: async () => ({ error: { message: 'high demand' } }) } : ok; };
    const r = await geminiVoice({ key: 'k', buffer: Buffer.from('a'), mime: 'audio/ogg', fetchFn, listModels: async () => ['m1', 'm2', 'm3', 'm4'], sleep: async ms => waits.push(ms) });
    expect(r.ok).toBe(true); expect(calls.length).toBe(3); expect(waits.length).toBe(2); expect(r.model).toBe('gemini:m3');
  });
  test('gives up inside its time budget instead of hanging', async () => {
    const fetchFn = async () => ({ ok: false, status: 503, json: async () => ({ error: { message: 'high demand' } }) });
    const r = await geminiVoice({ key: 'k', buffer: Buffer.from('a'), mime: 'audio/ogg', fetchFn, listModels: async () => ['m1', 'm2'], sleep: async () => {}, budgetMs: 3000 });
    expect(r.ok).toBe(false);
  });
});
