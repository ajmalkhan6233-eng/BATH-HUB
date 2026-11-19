'use strict';
const fs = require('fs'); const os = require('os'); const path = require('path');
const stt = require('../utils/stt');
const lp = require('../utils/laylaPhoto');

describe('speech to text adapter', () => {
  test('off when no command is set', async () => { expect(stt.enabled('')).toBe(false); expect(await stt.transcribe('/x/a.ogg', { cmd: '' })).toBeNull(); });
  test('runs the command and returns the words', async () => {
    const run = (cmd, o, cb) => cb(null, '  mata  tile eka   ona \n');
    expect(await stt.transcribe('/tmp/a.ogg', { cmd: 'say "{file}"', run })).toBe('mata tile eka ona');
  });
  test('failure or empty gives null, and an unsafe file name is refused', async () => {
    expect(await stt.transcribe('/tmp/a.ogg', { cmd: 'x {file}', run: (c, o, cb) => cb(new Error('boom')) })).toBeNull();
    expect(await stt.transcribe('/tmp/a.ogg', { cmd: 'x {file}', run: (c, o, cb) => cb(null, ' ') })).toBeNull();
    let ran = false; expect(await stt.transcribe('/tmp/a.ogg; rm -rf /', { cmd: 'x {file}', run: () => { ran = true; } })).toBeNull(); expect(ran).toBe(false);
  });
});

describe('photo request', () => {
  test('detects a photo request and the item words', () => {
    expect(lp.isPhotoRequest('Can you send me a photo of the white basin?')).toBe(true);
    expect(lp.isPhotoRequest('what time do you open')).toBe(false);
    expect(lp.tokensOf('send me a photo of the white basin please')).toEqual(['white', 'basin']);
  });
  test('sends at most the found, published photos with name and code only', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ph-')); fs.writeFileSync(path.join(dir, 'a.jpg'), Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]));
    const pool = { query: async (sql, args) => { expect(sql).toMatch(/published = TRUE/); return { rows: [{ item_code: 'B-1', name: 'White basin', photo_url: '/api/item-photos/a.jpg' }, { item_code: 'B-2', name: 'Gone', photo_url: '/api/item-photos/missing.jpg' }, { item_code: 'B-3', name: 'Evil', photo_url: '/api/item-photos/../../etc/passwd' }] }; } };
    const sent = []; const r = await lp.handlePhotoRequest({ pool, dir, text: 'photo of white basin', send: async (m, c) => sent.push([m.mimetype, c]) });
    expect(sent).toEqual([['image/jpeg', 'White basin (B-1)']]);
    expect(r.message).toMatch(/team will confirm/); expect(r.message).not.toMatch(/Rs|price of/i);
  });
  test('not a photo request, or nothing found = null (normal answer carries on)', async () => {
    expect(await lp.handlePhotoRequest({ pool: {}, text: 'hello', send: async () => {} })).toBeNull();
    expect(await lp.handlePhotoRequest({ pool: { query: async () => ({ rows: [] }) }, text: 'photo of unicorn', send: async () => {} })).toBeNull();
    expect(await lp.handlePhotoRequest({ pool: { query: async () => { throw new Error('no table'); } }, text: 'photo of basin', send: async () => {} })).toBeNull();
  });
});
