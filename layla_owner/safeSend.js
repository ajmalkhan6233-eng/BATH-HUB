'use strict';
/**
 * The only door out to WhatsApp. Live sending goes to the OWNER number and nowhere else; anything addressed to another number is logged as a
 * dry run and NOT sent, even when LAYLA_OWNER_LIVE=true. Numbers in logs are last-3-digits only.
 */
const { normalizeNumber } = require('./ownerGate');
const { last3 } = require('./settings');
function createSafeSend({ settings, sendText, log = console.log, fetchFn }) {
  const cfg = { token: settings.token, phoneId: settings.phoneId, version: settings.version, bridgeUrl: settings.bridgeUrl, live: settings.liveAllowed };
  return async function send(to, text) {
    const dest = normalizeNumber(to || settings.ownerNumber);
    if (!dest) throw new Error('no destination number');
    if (!settings.liveAllowed) return sendText(dest, text, { ...cfg, live: false }, fetchFn);          // dry run: logs, sends nothing
    if (dest !== settings.ownerNumber && !(settings.familyNumbers || []).includes(dest)) { log(`[layla DRY RUN, blocked: not the owner or a family member] to ${last3(dest)}: ${String(text).slice(0, 60).replace(/\n/g, ' ')}`); return { dryRun: true, blocked: true }; }
    return sendText(dest, text, cfg, fetchFn);
  };
}
module.exports = { createSafeSend };
