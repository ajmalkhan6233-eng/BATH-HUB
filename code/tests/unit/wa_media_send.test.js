'use strict';
const { sendMediaWithFallback, isMediaGetterError } = require('../../utils/waMediaSend');

class FakeMedia { constructor(mimetype, data, filename) { this.mimetype = mimetype; this.data = data; this.filename = filename; } }
const media = { mimetype: 'image/png', data: 'AAAA', filename: 'receipt.png' };

test('image goes as image when WhatsApp accepts it', async () => {
  const calls = [];
  const send = async (f, o) => { calls.push(o); };
  const r = await sendMediaWithFallback(send, FakeMedia, media, 'Thanks');
  expect(r.sentAs).toBe('image');
  expect(calls).toHaveLength(1);
  expect(calls[0]).toEqual({ caption: 'Thanks' });
});

test('getter error: retries once as a document', async () => {
  const calls = [];
  const send = async (f, o) => {
    calls.push(o);
    if (!o.sendMediaAsDocument) throw new Error('Data passed to getter must include an id property');
  };
  const r = await sendMediaWithFallback(send, FakeMedia, media, 'Thanks');
  expect(r.sentAs).toBe('document');
  expect(calls).toHaveLength(2);
  expect(calls[1].sendMediaAsDocument).toBe(true);
  expect(calls[1].caption).toBe('Thanks');
});

test('both fail: one clear error, no endless retry', async () => {
  let n = 0;
  const send = async () => { n++; throw new Error('Data passed to getter must include an id property'); };
  await expect(sendMediaWithFallback(send, FakeMedia, media, '')).rejects.toThrow(/as image .* as document/);
  expect(n).toBe(2);
});

test('other errors are not retried', async () => {
  let n = 0;
  const send = async () => { n++; throw new Error('not linked'); };
  await expect(sendMediaWithFallback(send, FakeMedia, media, '')).rejects.toThrow('not linked');
  expect(n).toBe(1);
});

test('error matcher', () => {
  expect(isMediaGetterError(new Error('Data passed to getter must include an id property'))).toBe(true);
  expect(isMediaGetterError(new Error('boom'))).toBe(false);
});
