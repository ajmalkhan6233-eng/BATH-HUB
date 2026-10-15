'use strict';
/**
 * Customer chats on Layla's number are DRY RUN ONLY: she works out what she WOULD say, logs it (numbers masked), and sends nothing.
 * She may only reply inside WhatsApp's 24-hour window (24 h after the customer's last message); outside it she stays silent.
 * English only here. A Sinhala/Tamil version needs a native reader before it is ever added.
 */
const { last3 } = require('./settings');
const WINDOW_MS = 24 * 3600 * 1000;
const inWindow = (lastInboundMs, nowMs) => Number.isFinite(lastInboundMs) && lastInboundMs > 0 && nowMs - lastInboundMs >= 0 && nowMs - lastInboundMs <= WINDOW_MS;
const GREETING = 'Welcome to Royal Bath Hub, No. 173/1, Kandy Road, Thihariya. Are you building a new bathroom or renovating one? We have tiles, taps, showers and accessories, the latest designs, honest prices and free advice.';
function createCustomerHandler({ compose = () => GREETING, log = console.log, now = () => Date.now(), onWouldReply, onInbound } = {}) {
  return async function customer(m) {
    if (!m || m.type !== 'text' || !String(m.text || '').trim()) return { status: 'customer_skipped', sent: false };
    if (onInbound) await onInbound(m);                                   // every customer text reaches the owner's 6 am digest, so no enquiry is lost
    const lastMs = (Number(m.ts) || 0) * 1000;
    if (!inWindow(lastMs, now())) { log(`[layla CUSTOMER DRY RUN] ${last3(m.from)}: outside the 24-hour window, no reply`); return { status: 'customer_dry_run', sent: false, inWindow: false, wouldReply: null }; }
    const wouldReply = String(await compose(m)).slice(0, 1000);
    log(`[layla CUSTOMER DRY RUN] ${last3(m.from)} would get: ${wouldReply.slice(0, 80).replace(/\n/g, ' ')}`);
    if (onWouldReply) await onWouldReply(m, wouldReply);
    return { status: 'customer_dry_run', sent: false, inWindow: true, wouldReply };
  };
}
module.exports = { createCustomerHandler, inWindow, WINDOW_MS, GREETING };
