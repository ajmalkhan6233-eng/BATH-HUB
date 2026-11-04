'use strict';
/** Security for the owner channel. Only the owner's number is ever answered. Pure functions, easy to test. */
const crypto = require('crypto');
/** Any Sri Lankan style number to digits-only E.164 without plus: 94777999219. */
function normalizeNumber(n) {
  let d = String(n || '').replace(/\D/g, '');
  if (d.startsWith('0094')) d = d.slice(2);
  if (d.startsWith('0') && d.length === 10) d = '94' + d.slice(1);
  if (d.length === 9) d = '94' + d;
  return d;
}
const isOwner = (from, ownerNumber) => !!ownerNumber && normalizeNumber(from) === normalizeNumber(ownerNumber);
/** Meta signs the raw body: header X-Hub-Signature-256 = sha256=<hex hmac with the App Secret>. */
function verifySignature(rawBody, header, appSecret) {
  if (!appSecret || !header || !String(header).startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const got = String(header).slice(7);
  if (got.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}
/** Limits so one bad message cannot hurt: length, media size, and a simple per-minute rate limit. */
const LIMITS = { maxTextChars: 2000, maxMediaBytes: 16 * 1024 * 1024, maxPerMinute: 30 };
function createRateLimiter(max = LIMITS.maxPerMinute, now = () => Date.now()) {
  const hits = [];
  return () => { const t = now(); while (hits.length && t - hits[0] > 60000) hits.shift(); if (hits.length >= max) return false; hits.push(t); return true; };
}
module.exports = { normalizeNumber, isOwner, verifySignature, LIMITS, createRateLimiter };
