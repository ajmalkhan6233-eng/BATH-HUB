'use strict';
/**
 * Quick win 5: if the shop server stops answering, restart ONLY the pm2 process named apex-server and queue a note for the 06:00 message
 * (rule 11: no instant WhatsApp). The restart itself is immediate. Never touches any other pm2 process (the live system runs there too).
 * check({ url, restart, enqueue, fetchFn, name }) is injectable so tests never touch the real pm2.
 */
const SAFE_NAME = /^apex-[a-z0-9-]+$/;
async function check({ url = 'http://127.0.0.1:3100/health', name = 'apex-server', restart, enqueue, fetchFn = fetch }) {
  if (!SAFE_NAME.test(name)) throw new Error('refusing to restart a process that is not apex-*');
  try {
    const r = await fetchFn(url, { signal: AbortSignal.timeout(5000) });
    if (r.ok) return { up: true };
  } catch (_) { /* fall through: no answer */ }
  let restarted = true;
  try { await restart(name); } catch (_) { restarted = false; }
  await enqueue(`SERVER STOPPED: ${name} did not answer. ${restarted ? 'I restarted it.' : 'Restart FAILED, please check the PC.'}`, 'watchdog');
  return { up: false, restarted };
}
module.exports = { check, SAFE_NAME };
