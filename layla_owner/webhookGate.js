'use strict';
/**
 * Everything Meta's webhook must pass BEFORE any message is looked at. Pure functions, no network.
 * Order: rate limit -> size -> signature (App Secret) -> valid JSON -> only messages sent TO Layla's phone-number-id.
 * Anything else is rejected. (Who the message is FROM is checked later by the owner gate in inbound.js.)
 */
const { verifySignature } = require('./ownerGate');
const { parseWebhook } = require('./waCloud');
const MAX_BODY = 1024 * 1024;

/** GET /wa verification handshake. Returns the challenge text, or null to reject. */
function verifyChallenge(query, settings) {
  const q = query || {};
  if (q['hub.mode'] === 'subscribe' && settings.verifyToken && q['hub.verify_token'] === settings.verifyToken) return String(q['hub.challenge'] || '');
  return null;
}
/** Keep only the changes that belong to Layla's own phone-number-id (so a message to any other number is dropped). */
function filterForPhone(body, phoneId) {
  if (!phoneId || !body || !Array.isArray(body.entry)) return { entry: [] };
  return { entry: body.entry.map((e) => ({ ...e, changes: (e.changes || []).filter((c) => c && c.value && c.value.metadata && String(c.value.metadata.phone_number_id) === String(phoneId)) })) };
}
/** -> { ok, status, reason, messages }. Never throws. */
function checkWebhook({ raw, signature, settings, limiter }) {
  if (limiter && !limiter()) return { ok: false, status: 429, reason: 'rate_limited', messages: [] };
  if (!Buffer.isBuffer(raw) || raw.length === 0 || raw.length > MAX_BODY) return { ok: false, status: 413, reason: 'bad_size', messages: [] };
  if (!verifySignature(raw, signature, settings.appSecret)) return { ok: false, status: 403, reason: 'bad_signature', messages: [] };
  let body; try { body = JSON.parse(raw.toString('utf8')); } catch (_) { return { ok: false, status: 400, reason: 'bad_json', messages: [] }; }
  if (!settings.phoneId) return { ok: false, status: 403, reason: 'phone_id_not_set', messages: [] };
  return { ok: true, status: 200, reason: 'ok', messages: parseWebhook(filterForPhone(body, settings.phoneId)) };
}
module.exports = { checkWebhook, verifyChallenge, filterForPhone, MAX_BODY };
