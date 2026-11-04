'use strict';
/**
 * Waiting messages for slow Layla replies (AJ, 22 Oct 2026).
 * While Layla thinks, the customer sees the "typing..." sign, then at most 3 short texts:
 *   8 s "One moment...", 30 s "Still working...", 60 s "We will reply shortly."
 * Own file, no app imports: the bridge hands in two small functions.
 *   typing()  -> show the typing sign (async, errors are swallowed)
 *   send(txt) -> send one text (async, errors are swallowed)
 * stop() cancels everything; nothing is sent after stop(). English only on purpose.
 */
const DEFAULT_STEPS = [
  { afterMs: 8000, text: 'One moment, I am checking this for you.' },
  { afterMs: 30000, text: 'Still working on it, thank you for waiting.' },
  { afterMs: 60000, text: 'We will reply to you shortly.' },
];
const DEFAULT_TYPING_EVERY_MS = 15000;
const MAX_TEXTS = 3;

function startWaiting(opts) {
  const o = opts || {};
  const steps = (Array.isArray(o.steps) ? o.steps : DEFAULT_STEPS).slice(0, MAX_TEXTS);
  const typingEvery = o.typingEveryMs || DEFAULT_TYPING_EVERY_MS;
  const setT = o.setTimeoutFn || setTimeout, clearT = o.clearTimeoutFn || clearTimeout;
  const setI = o.setIntervalFn || setInterval, clearI = o.clearIntervalFn || clearInterval;
  let stopped = false; let sent = 0; const timers = []; let ticker = null;

  const safe = async (fn, arg) => { try { if (typeof fn === 'function') await fn(arg); } catch (e) { /* never let a waiting message break the real reply */ } };

  safe(o.typing);                                   // instant typing sign
  ticker = setI(() => { if (!stopped) safe(o.typing); }, typingEvery);
  if (ticker && ticker.unref) ticker.unref();
  for (const s of steps) {
    const t = setT(() => { if (stopped || sent >= MAX_TEXTS) return; sent += 1; safe(o.send, s.text); }, s.afterMs);
    if (t && t.unref) t.unref();
    timers.push(t);
  }
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      timers.forEach((t) => clearT(t));
      if (ticker) clearI(ticker);
      safe(o.clearTyping);
    },
    sentCount() { return sent; },
    isStopped() { return stopped; },
  };
}

module.exports = { startWaiting, DEFAULT_STEPS, MAX_TEXTS };
