const crypto = require('crypto');
const G = require('../layla_owner/ownerGate');
test('numbers normalise to digits', () => {
  for (const n of ['0777999219', '+94 77 799 9219', '94777999219', '0094777999219', '777999219']) expect(G.normalizeNumber(n)).toBe('94777999219');
});
test('only the owner passes', () => { expect(G.isOwner('94777999219', '0777999219')).toBe(true); expect(G.isOwner('94771234567', '0777999219')).toBe(false); expect(G.isOwner('x', '')).toBe(false); });
test('signature check', () => {
  const body = Buffer.from('{"a":1}'); const sig = 'sha256=' + crypto.createHmac('sha256', 's3cret').update(body).digest('hex');
  expect(G.verifySignature(body, sig, 's3cret')).toBe(true);
  expect(G.verifySignature(body, sig, 'wrong')).toBe(false);
  expect(G.verifySignature(Buffer.from('{"a":2}'), sig, 's3cret')).toBe(false);
  expect(G.verifySignature(body, undefined, 's3cret')).toBe(false);
  expect(G.verifySignature(body, 'sha256=abc', 's3cret')).toBe(false);
});
test('rate limiter blocks after the limit and recovers', () => {
  let t = 0; const ok = G.createRateLimiter(3, () => t);
  expect([ok(), ok(), ok(), ok()]).toEqual([true, true, true, false]); t = 61000; expect(ok()).toBe(true);
});
