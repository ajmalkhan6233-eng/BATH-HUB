'use strict';
// One place for "tell the owner on WhatsApp". layla_owner/boot.js plugs in the sender; until then (or in tests) nothing is sent.
let sender = null;
const setSender = (fn) => { sender = typeof fn === 'function' ? fn : null; };
/** Fire and forget: never throws, never blocks the caller. Returns true if a sender was plugged in. */
function notifyOwner(text) {
  if (!sender) return false;
  Promise.resolve().then(() => sender(text)).catch((e) => console.error('[owner-notify]', e.message));
  return true;
}
module.exports = { setSender, notifyOwner };
