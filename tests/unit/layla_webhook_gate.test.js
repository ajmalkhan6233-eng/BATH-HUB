const crypto = require('crypto');
const { checkWebhook, verifyChallenge, filterForPhone } = require('../../layla_owner/webhookGate');
const { createRateLimiter } = require('../../layla_owner/ownerGate');
const settings = { appSecret: 'secret', phoneId: '555', verifyToken: 'vt' };
const body = (phoneId, from = '94777999219') => ({ entry: [{ changes: [{ value: { metadata: { phone_number_id: phoneId }, messages: [{ id: 'm1', from, type: 'text', timestamp: '1', text: { body: 'help' } }] } }] }] });
const sign = (raw) => 'sha256=' + crypto.createHmac('sha256', 'secret').update(raw).digest('hex');
const send = (b, over = {}) => { const raw = Buffer.from(JSON.stringify(b)); return checkWebhook({ raw, signature: sign(raw), settings, ...over }); };
test('good signed message to Layla passes', () => { const g = send(body('555')); expect(g.ok).toBe(true); expect(g.messages).toHaveLength(1); });
test('wrong signature rejected', () => { const raw = Buffer.from(JSON.stringify(body('555'))); expect(checkWebhook({ raw, signature: 'sha256=00', settings }).status).toBe(403); expect(checkWebhook({ raw, signature: undefined, settings }).status).toBe(403); });
test('message to any OTHER phone number id is dropped (shop number can never leak in)', () => { const g = send(body('999')); expect(g.ok).toBe(true); expect(g.messages).toHaveLength(0); });
test('no phone id configured = reject all', () => { const raw = Buffer.from(JSON.stringify(body('555'))); expect(checkWebhook({ raw, signature: sign(raw), settings: { ...settings, phoneId: '' } }).status).toBe(403); });
test('bad json, empty, oversize rejected', () => {
  const raw = Buffer.from('not json'); expect(checkWebhook({ raw, signature: sign(raw), settings }).status).toBe(400);
  expect(checkWebhook({ raw: Buffer.alloc(0), signature: '', settings }).status).toBe(413);
  const big = Buffer.alloc(1024 * 1024 + 1, 'a'); expect(checkWebhook({ raw: big, signature: sign(big), settings }).status).toBe(413);
});
test('rate limit applies before anything else', () => { const lim = createRateLimiter(2, () => 0); expect(send(body('555'), { limiter: lim }).ok).toBe(true); send(body('555'), { limiter: lim }); expect(send(body('555'), { limiter: lim }).status).toBe(429); });
test('verify handshake needs the right token', () => {
  expect(verifyChallenge({ 'hub.mode': 'subscribe', 'hub.verify_token': 'vt', 'hub.challenge': '42' }, settings)).toBe('42');
  expect(verifyChallenge({ 'hub.mode': 'subscribe', 'hub.verify_token': 'x', 'hub.challenge': '42' }, settings)).toBeNull();
  expect(verifyChallenge({ 'hub.mode': 'subscribe', 'hub.verify_token': '', 'hub.challenge': '42' }, { verifyToken: '' })).toBeNull();
});
test('filterForPhone handles junk', () => { expect(filterForPhone(null, '1')).toEqual({ entry: [] }); expect(filterForPhone({ entry: 'x' }, '1')).toEqual({ entry: [] }); });
