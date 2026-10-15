'use strict';
/**
 * ONE place for Layla's WhatsApp settings. Everything comes from env (.env on the PC). Nothing secret is ever printed.
 * Three numbers, never mixed:
 *   SHOP   074 035 5536  WhatsApp Business app on AJ's phone. NEVER connected to the Cloud API. Refused here.
 *   LAYLA  LAYLA_WA_NUMBER  the new number on Meta's Cloud API. Shown only as its last 3 digits.
 *   OWNER  OWNER_WA_NUMBER  the only number Layla obeys (code default 0777999219 until AJ confirms).
 */
const { normalizeNumber } = require('./ownerGate');
const SHOP_NUMBER = '0740355536';
const DEFAULT_OWNER = '0777999219';
const last3 = (n) => { const d = String(n || '').replace(/\D/g, ''); return d ? `***${d.slice(-3)}` : '(not set)'; };

function loadSettings(env = process.env) {
  const s = {
    laylaNumber: normalizeNumber(env.LAYLA_WA_NUMBER),
    ownerNumber: normalizeNumber(env.OWNER_WA_NUMBER || DEFAULT_OWNER),
    ownerIsDefault: !env.OWNER_WA_NUMBER,
    live: env.LAYLA_OWNER_LIVE === 'true',               // default OFF: dry run
    customerLive: false,                                 // customer replies are DRY RUN in code; there is no setting to turn them on
    token: env.WA_TOKEN || '', phoneId: env.WA_PHONE_NUMBER_ID || '', appSecret: env.WA_APP_SECRET || '', verifyToken: env.WA_VERIFY_TOKEN || '',
    version: env.WA_API_VERSION || 'v21.0',
  };
  s.errors = validate(s);
  s.liveAllowed = s.live && s.errors.length === 0;      // a bad config silently falls back to dry run, never to a wrong send
  return s;
}
function validate(s) {
  const e = [], shop = normalizeNumber(SHOP_NUMBER);
  if (s.laylaNumber && s.laylaNumber === shop) e.push('LAYLA_WA_NUMBER is the SHOP number: refused. Use the separate Layla number.');
  if (s.ownerNumber === shop) e.push('OWNER_WA_NUMBER is the SHOP number: refused.');
  if (s.laylaNumber && s.laylaNumber === s.ownerNumber) e.push('LAYLA_WA_NUMBER and OWNER_WA_NUMBER are the same number.');
  if (s.live) {
    for (const [k, v] of [['WA_TOKEN', s.token], ['WA_PHONE_NUMBER_ID', s.phoneId], ['WA_APP_SECRET', s.appSecret], ['WA_VERIFY_TOKEN', s.verifyToken], ['LAYLA_WA_NUMBER', s.laylaNumber]]) if (!v) e.push(`${k} is missing`);
  }
  return e;
}
/** Safe to log: numbers masked, secrets reduced to set / not set. */
function describe(s) {
  return { mode: s.liveAllowed ? 'LIVE (owner only)' : 'DRY RUN', layla: last3(s.laylaNumber), owner: last3(s.ownerNumber), ownerIsDefault: s.ownerIsDefault, customerReplies: 'DRY RUN always',
    token: s.token ? 'set' : 'not set', phoneId: s.phoneId ? 'set' : 'not set', appSecret: s.appSecret ? 'set' : 'not set', verifyToken: s.verifyToken ? 'set' : 'not set', errors: s.errors };
}
module.exports = { loadSettings, validate, describe, last3, SHOP_NUMBER, DEFAULT_OWNER };
